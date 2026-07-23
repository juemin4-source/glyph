use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::State;
use uuid::Uuid;

use crate::db::Database;
use crate::fs_models::*;
use crate::fs_watcher::FileWatcher;

// ============================================================================
//  Path Validation
// ============================================================================

/// Convert a project-relative path into a safe lexical path.
/// Gate A targets Windows and therefore rejects absolute paths, drive prefixes,
/// parent traversal, and characters that would become drive separators there.
fn validate_relative_path(sub_path: &str) -> Result<PathBuf, String> {
    let normalized = sub_path.replace('\\', "/");
    let source = Path::new(&normalized);
    if source.is_absolute() {
        return Err("PATH_ESCAPE: absolute paths are not allowed".to_string());
    }

    let mut relative = PathBuf::new();
    for component in source.components() {
        match component {
            Component::Normal(part) => {
                if part.to_string_lossy().contains(':') {
                    return Err("PATH_ESCAPE: drive-prefixed paths are not allowed".to_string());
                }
                relative.push(part);
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("PATH_ESCAPE: path escapes project root".to_string());
            }
        }
    }

    if relative.as_os_str().is_empty() {
        return Err("INVALID_PATH: empty path".to_string());
    }
    Ok(relative)
}

/// Validate that `sub_path` resolves inside `project_root`.
/// Non-existent nested paths are allowed when their nearest existing ancestor
/// remains inside the canonical project root.
fn resolve_project_path(project_root: &str, sub_path: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(project_root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    let relative = validate_relative_path(sub_path)?;
    let joined = root.join(relative);

    if joined.exists() {
        let target = fs::canonicalize(&joined)
            .map_err(|_| format!("PATH_NOT_FOUND: {}", sub_path))?;
        if !target.starts_with(&root) {
            return Err("PATH_ESCAPE: path escapes project root".to_string());
        }
        return Ok(target);
    }

    let mut ancestor = joined.parent();
    while let Some(candidate) = ancestor {
        if candidate.exists() {
            let canonical = fs::canonicalize(candidate)
                .map_err(|e| format!("INVALID_PARENT_PATH: {}", e))?;
            if !canonical.starts_with(&root) {
                return Err("PATH_ESCAPE: path escapes project root".to_string());
            }
            return Ok(joined);
        }
        ancestor = candidate.parent();
    }

    Err("INVALID_PARENT_PATH: no existing ancestor".to_string())
}

/// Validate that a path exists and is within the project root.
fn resolve_existing_path(project_root: &str, sub_path: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(project_root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    let relative = validate_relative_path(sub_path)?;
    let target = fs::canonicalize(root.join(relative))
        .map_err(|_| format!("PATH_NOT_FOUND: {}", sub_path))?;
    if !target.starts_with(&root) {
        return Err("PATH_ESCAPE: path escapes project root".to_string());
    }
    Ok(target)
}

/// Get the relative path within a project root using forward slashes.
fn relative_path(project_root: &str, abs_path: &Path) -> String {
    let root = project_root.replace('\\', "/").trim_end_matches('/').to_string();
    let absolute = abs_path.to_string_lossy().replace('\\', "/");

    #[cfg(windows)]
    let matches_root = absolute.to_lowercase().starts_with(&(root.to_lowercase() + "/"));
    #[cfg(not(windows))]
    let matches_root = absolute.starts_with(&(root.clone() + "/"));
    #[cfg(windows)]
    let equals_root = absolute.eq_ignore_ascii_case(&root);
    #[cfg(not(windows))]
    let equals_root = absolute == root;

    if matches_root {
        absolute[root.len() + 1..].to_string()
    } else if equals_root {
        String::new()
    } else {
        absolute
    }
}

/// Get file metadata (modification time as epoch millis)
fn modified_at(metadata: &fs::Metadata) -> i64 {
    metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Replace `path` with `temp_path` while keeping the operation inside one directory.
#[cfg(windows)]
fn replace_file(temp_path: &Path, path: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let from: Vec<u16> = temp_path.as_os_str().encode_wide().chain(Some(0)).collect();
    let to: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let ok = unsafe {
        MoveFileExW(
            from.as_ptr(),
            to.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok == 0 {
        return Err(format!(
            "REPLACE_ERROR: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_file(temp_path: &Path, path: &Path) -> Result<(), String> {
    fs::rename(temp_path, path).map_err(|e| format!("REPLACE_ERROR: {}", e))
}

fn prepare_temp_file(path: &Path, content: &str) -> Result<tempfile::NamedTempFile, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "WRITE_ERROR: target has no parent".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|e| format!("WRITE_ERROR: cannot create parent: {}", e))?;

    let mut temp = tempfile::Builder::new()
        .prefix(".glyph-write-")
        .tempfile_in(parent)
        .map_err(|e| format!("WRITE_ERROR: cannot create temp file: {}", e))?;
    temp.write_all(content.as_bytes())
        .map_err(|e| format!("WRITE_ERROR: {}", e))?;
    temp.as_file()
        .sync_all()
        .map_err(|e| format!("WRITE_ERROR: cannot flush temp file: {}", e))?;
    Ok(temp)
}

/// Atomically replace a file using a unique temporary file in the same directory.
fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let temp = prepare_temp_file(path, content)?;
    let temp_path = temp.into_temp_path();
    replace_file(temp_path.as_ref(), path)
}

/// Create a new file while refusing to overwrite a path that appeared concurrently.
fn atomic_create(path: &Path, content: &str) -> Result<(), String> {
    let temp = prepare_temp_file(path, content)?;
    temp.persist_noclobber(path)
        .map(|_| ())
        .map_err(|error| {
            if path.exists() {
                "FILE_EXISTS: file already exists".to_string()
            } else {
                format!("CREATE_ERROR: {}", error.error)
            }
        })
}

/// Prepare the replacement first, then compare the current disk content as
/// close as possible to the atomic swap. This narrows the external-editor race.
fn atomic_write_checked(
    path: &Path,
    content: &str,
    expected_version: Option<&str>,
) -> Result<(), String> {
    let temp = prepare_temp_file(path, content)?;
    if let Some(expected) = expected_version {
        if !path.exists() {
            return Err("FILE_MISSING: target file no longer exists".to_string());
        }
        let current = fs::read_to_string(path)
            .map_err(|e| format!("READ_ERROR: {}", e))?;
        let current_version = content_version(&current);
        if current_version != expected {
            return Err(format!(
                "EXTERNAL_MODIFICATION: expected {}, found {}",
                expected, current_version
            ));
        }
    }
    let temp_path = temp.into_temp_path();
    replace_file(temp_path.as_ref(), path)
}

// ============================================================================
//  Project Commands
// ============================================================================

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}


fn safe_internal_directory(root: &Path, name: &str, create: bool) -> Result<PathBuf, String> {
    let canonical_root = fs::canonicalize(root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    let directory = canonical_root.join(name);

    if directory.exists() {
        let metadata = fs::symlink_metadata(&directory)
            .map_err(|e| format!("METADATA_ERROR: {}", e))?;
        if metadata.file_type().is_symlink() {
            return Err(format!("UNSAFE_INTERNAL_PATH: {} must not be a symbolic link", name));
        }
        if !metadata.is_dir() {
            return Err(format!("UNSAFE_INTERNAL_PATH: {} is not a directory", name));
        }
        let canonical = fs::canonicalize(&directory)
            .map_err(|e| format!("INVALID_INTERNAL_PATH: {}", e))?;
        if !canonical.starts_with(&canonical_root) {
            return Err(format!("UNSAFE_INTERNAL_PATH: {} escapes project root", name));
        }
        return Ok(canonical);
    }

    if !create {
        return Ok(directory);
    }
    fs::create_dir(&directory)
        .map_err(|e| format!("CREATE_ERROR: cannot create {}: {}", name, e))?;
    Ok(directory)
}

fn write_project_metadata(
    meta_path: &Path,
    project_id: &str,
    name: &str,
    genre: &str,
    created_at: i64,
    last_opened_at: i64,
) -> Result<(), String> {
    let project_meta = serde_json::json!({
        "glyphVersion": "0.4.1",
        "projectId": project_id,
        "name": name,
        "genre": genre,
        "createdAt": created_at,
        "lastOpenedAt": last_opened_at
    });
    let content = serde_json::to_string_pretty(&project_meta)
        .map_err(|e| format!("SERIALIZE_ERROR: {}", e))?;
    atomic_write(meta_path, &content)
}

fn write_default_session(project_root: &Path, last_open_file_path: Option<&str>) -> Result<(), String> {
    let now = now_millis();
    let session = SessionState {
        last_open_file_path: last_open_file_path.map(str::to_string),
        last_cursor_line: Some(0),
        last_cursor_column: Some(0),
        last_scroll_position: Some(0),
        open_file_paths: last_open_file_path.map(|p| vec![p.to_string()]).unwrap_or_default(),
        sidebar_width: None,
        focus_mode: Some(false),
        last_edit_mode: Some("markdown".to_string()),
        last_session_at: now,
    };
    let session_path = project_root.join(".glyph").join("session.json");
    let content = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("SERIALIZE_ERROR: {}", e))?;
    atomic_write(&session_path, &content)
}

fn derive_project_name(root: &Path) -> String {
    root.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "未命名作品".to_string())
}

fn adopt_project_directory(
    root: &Path,
    glyph_dir: &Path,
    meta_path: &Path,
    now: i64,
) -> Result<(String, String, String, i64), String> {
    fs::create_dir_all(glyph_dir)
        .map_err(|e| format!("CREATE_ERROR: cannot create .glyph directory: {}", e))?;
    let project_id = Uuid::new_v4().to_string();
    let name = derive_project_name(root);
    let genre = String::new();
    write_project_metadata(meta_path, &project_id, &name, &genre, now, now)?;
    if !glyph_dir.join("session.json").exists() {
        write_default_session(root, None)?;
    }
    Ok((project_id, name, genre, now))
}

/// Create a new local project. The supplied root path is the final project directory.
/// Gate A deliberately creates only one initial Markdown document and isolated metadata.
#[tauri::command]
pub fn create_fs_project(
    db: State<'_, Database>,
    name: String,
    root_path: String,
    genre: Option<String>,
) -> Result<CreateFsProjectOutput, String> {
    if name.trim().is_empty() {
        return Err("INVALID_PROJECT_NAME: name cannot be empty".to_string());
    }
    let requested_root = PathBuf::from(&root_path);
    if !requested_root.is_absolute() {
        return Err("PROJECT_PATH_MUST_BE_ABSOLUTE".to_string());
    }
    let root_existed = requested_root.exists();
    if root_existed {
        if !requested_root.is_dir() {
            return Err("PROJECT_PATH_NOT_DIRECTORY".to_string());
        }
        let mut entries = fs::read_dir(&requested_root).map_err(|e| format!("READ_ERROR: {}", e))?;
        if entries.next().is_some() {
            return Err("PROJECT_DIRECTORY_NOT_EMPTY".to_string());
        }
    } else {
        fs::create_dir_all(&requested_root)
            .map_err(|e| format!("CREATE_ERROR: cannot create project directory: {}", e))?;
    }

    let operation = (|| -> Result<CreateFsProjectOutput, String> {
        let root = requested_root
            .canonicalize()
            .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
        let glyph_dir = root.join(".glyph");
        fs::create_dir_all(&glyph_dir)
            .map_err(|e| format!("CREATE_ERROR: cannot create .glyph directory: {}", e))?;

        let project_id = Uuid::new_v4().to_string();
        let now = now_millis();
        let genre_val = genre.unwrap_or_default();
        write_project_metadata(
            &glyph_dir.join("project.json"),
            &project_id,
            &name,
            &genre_val,
            now,
            now,
        )?;

        let initial_file = "正文.md";
        atomic_write(&root.join(initial_file), &format!("# {}\n\n", name))?;
        write_default_session(&root, Some(initial_file))?;

        let normalized_root = root.to_string_lossy().replace('\\', "/");
        db.create_fs_project(&project_id, &name, &normalized_root, &genre_val, now)
            .map_err(|e| format!("DB_ERROR: {}", e))?;

        let project = FsProject {
            id: project_id,
            name,
            root_path: normalized_root,
            genre: genre_val,
            created_at: now,
            last_opened_at: now,
            updated_at: now,
        };

        Ok(CreateFsProjectOutput {
            project,
            created_directories: Vec::new(),
            created_files: vec![initial_file.to_string()],
        })
    })();

    if operation.is_err() {
        let _ = fs::remove_file(requested_root.join("正文.md"));
        let _ = fs::remove_dir_all(requested_root.join(".glyph"));
        if !root_existed {
            let _ = fs::remove_dir(&requested_root);
        }
    }
    operation
}

/// Open any existing directory as a local project.
/// If it has no Glyph metadata yet, explicit opening adopts it without restructuring user files.
#[tauri::command]
pub fn open_fs_project(
    db: State<'_, Database>,
    root_path: String,
) -> Result<FsProject, String> {
    let root = PathBuf::from(&root_path)
        .canonicalize()
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    if !root.is_dir() {
        return Err("NOT_A_DIRECTORY: project root is not a directory".to_string());
    }

    let glyph_dir = safe_internal_directory(&root, ".glyph", true)?;
    let meta_path = glyph_dir.join("project.json");
    let now = now_millis();

    let (project_id, name, genre, created_at) = if meta_path.exists() {
        let existing = fs::read_to_string(&meta_path)
            .ok()
            .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
            .and_then(|mut meta| {
                let project_id = meta.get("projectId")?.as_str()?.to_string();
                let name = meta
                    .get("name")
                    .and_then(|value| value.as_str())
                    .map(str::to_string)
                    .unwrap_or_else(|| derive_project_name(&root));
                let genre = meta
                    .get("genre")
                    .and_then(|value| value.as_str())
                    .unwrap_or("")
                    .to_string();
                let created_at = meta
                    .get("createdAt")
                    .and_then(|value| value.as_i64())
                    .unwrap_or(now);
                meta["lastOpenedAt"] = serde_json::json!(now);
                Some((project_id, name, genre, created_at, meta))
            });

        if let Some((project_id, name, genre, created_at, meta)) = existing {
            let updated = serde_json::to_string_pretty(&meta)
                .map_err(|e| format!("SERIALIZE_ERROR: {}", e))?;
            atomic_write(&meta_path, &updated)?;
            (project_id, name, genre, created_at)
        } else {
            // Corrupt auxiliary metadata must never block the user's real work.
            let backup = glyph_dir.join(format!("project.corrupt-{}.json", now));
            let _ = fs::rename(&meta_path, backup);
            adopt_project_directory(&root, &glyph_dir, &meta_path, now)?
        }
    } else {
        adopt_project_directory(&root, &glyph_dir, &meta_path, now)?
    };

    let normalized_root = root.to_string_lossy().replace('\\', "/");
    db.upsert_fs_project(
        &project_id,
        &name,
        &normalized_root,
        &genre,
        created_at,
        now,
        now,
    )
    .map_err(|e| format!("DB_ERROR: {}", e))?;

    Ok(FsProject {
        id: project_id,
        name,
        root_path: normalized_root,
        genre,
        created_at,
        last_opened_at: now,
        updated_at: now,
    })
}

/// List all registered filesystem projects.
#[tauri::command]
pub fn list_fs_projects(
    db: State<'_, Database>,
) -> Result<Vec<FsProject>, String> {
    db.list_fs_projects().map_err(|e| e.to_string())
}

/// Remove a project from the registry (does NOT delete files).
#[tauri::command]
pub fn remove_fs_project(
    db: State<'_, Database>,
    project_id: String,
) -> Result<(), String> {
    db.remove_fs_project(&project_id).map_err(|e| e.to_string())
}

// ============================================================================
//  File/Directory Listing
// ============================================================================

/// List contents of a directory within a project.
#[tauri::command]
pub fn list_directory(
    project_root: String,
    sub_path: Option<String>,
) -> Result<Vec<DirEntry>, String> {
    let target = match &sub_path {
        Some(p) if !p.is_empty() && p != "." => resolve_existing_path(&project_root, p)?,
        _ => {
            let root = fs::canonicalize(&project_root)
                .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
            root
        }
    };

    if !target.is_dir() {
        return Err("NOT_A_DIRECTORY: path is not a directory".to_string());
    }

    let read_dir = fs::read_dir(&target)
        .map_err(|e| format!("READ_ERROR: {}", e))?;

    let mut entries: Vec<DirEntry> = Vec::new();

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("READ_ERROR: {}", e))?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/directories (starting with .)
        if name.starts_with('.') {
            continue;
        }

        let metadata = entry.metadata().map_err(|e| format!("METADATA_ERROR: {}", e))?;
        let abs_path = entry.path();
        let rel_path = relative_path(&project_root, &abs_path);

        entries.push(DirEntry {
            name,
            path: rel_path,
            is_dir: metadata.is_dir(),
            extension: abs_path.extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default(),
            size: metadata.len() as i64,
            modified_at: modified_at(&metadata),
        });
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            b.is_dir.cmp(&a.is_dir) // dirs first
        } else {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        }
    });

    Ok(entries)
}

// ============================================================================
//  File Read / Write
// ============================================================================

fn content_version(content: &str) -> String {
    // Deterministic FNV-1a fingerprint. It avoids millisecond timestamp races
    // without adding a cryptographic dependency to the local editor path.
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in content.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}:{}", hash, content.len())
}

fn read_text_file(project_root: &str, path: &str) -> Result<(PathBuf, String, i64, String), String> {
    let target = resolve_existing_path(project_root, path)?;
    if !target.is_file() {
        return Err("NOT_A_FILE: path is not a file".to_string());
    }
    let metadata = target.metadata().map_err(|e| format!("METADATA_ERROR: {}", e))?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err("FILE_TOO_LARGE: file exceeds 10MB limit".to_string());
    }
    let modified = modified_at(&metadata);
    let content = fs::read_to_string(&target).map_err(|e| format!("READ_ERROR: {}", e))?;
    let version = content_version(&content);
    Ok((target, content, modified, version))
}

/// Read a text file from the project (UTF-8), retained for read-only tools.
#[tauri::command]
pub fn read_file(project_root: String, path: String) -> Result<String, String> {
    let (_, content, _, _) = read_text_file(&project_root, &path)?;
    Ok(content)
}

/// Read a file with its disk version for conflict-safe editing.
#[tauri::command]
pub fn read_file_state(
    project_root: String,
    path: String,
) -> Result<FileReadResult, String> {
    let (_, content, modified, version) = read_text_file(&project_root, &path)?;
    Ok(FileReadResult {
        content,
        modified_at: modified,
        version,
    })
}

fn checked_write(
    project_root: &str,
    path: &str,
    content: &str,
    expected_version: Option<String>,
) -> Result<FileWriteResult, String> {
    let target = resolve_project_path(project_root, path)?;

    atomic_write_checked(&target, content, expected_version.as_deref())?;
    let modified = target
        .metadata()
        .map_err(|e| format!("METADATA_ERROR: {}", e))
        .map(|m| modified_at(&m))?;
    Ok(FileWriteResult {
        modified_at: modified,
        version: content_version(content),
    })
}

/// Write content without a version precondition. Used by explicit creation and legacy tools.
#[tauri::command]
pub fn write_file(
    project_root: String,
    path: String,
    content: String,
) -> Result<(), String> {
    checked_write(&project_root, &path, &content, None)?;
    Ok(())
}

/// Conflict-safe editor write. The write is rejected when the disk version changed.
#[tauri::command]
pub fn write_file_checked(
    project_root: String,
    path: String,
    content: String,
    expected_version: Option<String>,
) -> Result<FileWriteResult, String> {
    checked_write(
        &project_root,
        &path,
        &content,
        expected_version,
    )
}

/// Create a new text file without ever overwriting an existing path.
#[tauri::command]
pub fn create_text_file(
    project_root: String,
    path: String,
    content: String,
) -> Result<FileWriteResult, String> {
    let target = resolve_project_path(&project_root, &path)?;
    if target.exists() {
        return Err("FILE_EXISTS: file already exists".to_string());
    }
    atomic_create(&target, &content)?;
    let modified = target
        .metadata()
        .map_err(|e| format!("METADATA_ERROR: {}", e))
        .map(|metadata| modified_at(&metadata))?;
    Ok(FileWriteResult {
        modified_at: modified,
        version: content_version(&content),
    })
}

/// Create a new empty file.
#[tauri::command]
pub fn create_file(
    project_root: String,
    path: String,
) -> Result<(), String> {
    let target = resolve_project_path(&project_root, &path)?;

    if target.exists() {
        return Err("FILE_EXISTS: file already exists".to_string());
    }

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("CREATE_ERROR: {}", e))?;
    }

    atomic_create(&target, "")?;

    Ok(())
}

/// Create a new directory.
#[tauri::command]
pub fn create_directory(
    project_root: String,
    path: String,
) -> Result<(), String> {
    let target = resolve_project_path(&project_root, &path)?;

    if target.exists() {
        return Err("DIR_EXISTS: directory already exists".to_string());
    }

    fs::create_dir_all(&target)
        .map_err(|e| format!("CREATE_ERROR: {}", e))?;

    Ok(())
}

// ============================================================================
//  File Operations
// ============================================================================

/// Rename or move a file/directory.
#[tauri::command]
pub fn rename_file(
    project_root: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let old_target = resolve_existing_path(&project_root, &old_path)?;
    let new_target = resolve_project_path(&project_root, &new_path)?;

    if new_target.exists() {
        return Err("TARGET_EXISTS: target path already exists".to_string());
    }

    // Ensure parent of new path exists
    if let Some(parent) = new_target.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("CREATE_ERROR: {}", e))?;
        }
    }

    fs::rename(&old_target, &new_target)
        .map_err(|e| format!("RENAME_ERROR: {}", e))?;

    Ok(())
}

/// Delete a file (moves to .glyph-trash/ for recoverability).
#[tauri::command]
pub fn delete_file(
    project_root: String,
    path: String,
) -> Result<(), String> {
    let target = resolve_existing_path(&project_root, &path)?;

    if target.is_dir() {
        return Err("IS_DIRECTORY: use delete_directory for directories".to_string());
    }

    let project_root_path = fs::canonicalize(&project_root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    let trash_dir = safe_internal_directory(&project_root_path, ".glyph-trash", true)
        .map_err(|e| format!("TRASH_ERROR: {}", e))?;

    let trash_name = format!(
        "{}_{}_{}",
        target.file_name().unwrap_or_default().to_string_lossy(),
        now_millis(),
        Uuid::new_v4()
    );
    let trash_path = trash_dir.join(&trash_name);

    fs::rename(&target, &trash_path)
        .map_err(|e| format!("DELETE_ERROR: {}", e))?;

    Ok(())
}

/// Delete an empty directory.
#[tauri::command]
pub fn delete_directory(
    project_root: String,
    path: String,
) -> Result<(), String> {
    let target = resolve_existing_path(&project_root, &path)?;

    if !target.is_dir() {
        return Err("NOT_A_DIRECTORY: path is not a directory".to_string());
    }

    // Only allow deleting empty directories in phase 1
    let mut contents = fs::read_dir(&target)
        .map_err(|e| format!("READ_ERROR: {}", e))?;
    if contents.next().is_some() {
        return Err("DIR_NOT_EMPTY: directory is not empty".to_string());
    }

    fs::remove_dir(&target)
        .map_err(|e| format!("DELETE_ERROR: {}", e))?;

    Ok(())
}

// ============================================================================
//  Session State
// ============================================================================

fn default_session_state() -> SessionState {
    SessionState {
        last_open_file_path: None,
        last_cursor_line: Some(0),
        last_cursor_column: Some(0),
        last_scroll_position: Some(0),
        open_file_paths: Vec::new(),
        sidebar_width: None,
        focus_mode: Some(false),
        last_edit_mode: Some("markdown".to_string()),
        last_session_at: 0,
    }
}

/// Read session state. Corrupt or absent auxiliary state never blocks opening the work.
#[tauri::command]
pub fn get_session_state(project_root: String) -> Result<SessionState, String> {
    let root = fs::canonicalize(&project_root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    let glyph_dir = safe_internal_directory(&root, ".glyph", false)?;
    let session_path = glyph_dir.join("session.json");
    if !session_path.exists() {
        return Ok(default_session_state());
    }

    let content = match fs::read_to_string(&session_path) {
        Ok(content) => content,
        Err(_) => return Ok(default_session_state()),
    };
    match serde_json::from_str::<SessionState>(&content) {
        Ok(state) => Ok(state),
        Err(_) => Ok(default_session_state()),
    }
}

/// Save session state to .glyph/session.json
#[tauri::command]
pub fn save_session_state(
    project_root: String,
    state: SessionState,
) -> Result<(), String> {
    let root = fs::canonicalize(&project_root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    let glyph_dir = safe_internal_directory(&root, ".glyph", true)?;
    let session_path = glyph_dir.join("session.json");

    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("SERIALIZE_ERROR: {}", e))?;

    atomic_write(&session_path, &content)
}

// ============================================================================
//  Migration Helpers
// ============================================================================

fn migration_filename(name: &str) -> String {
    let sanitized: String = name
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || matches!(character, '_' | '-' | ' ') {
                character
            } else {
                '_'
            }
        })
        .take(80)
        .collect();
    let trimmed = sanitized.trim().trim_end_matches(|character| character == '.' || character == ' ');
    if trimmed.is_empty() {
        "未命名".to_string()
    } else {
        trimmed.to_string()
    }
}

fn clear_migration_output(root: &Path, root_existed: bool) {
    if !root.exists() {
        return;
    }
    if root_existed {
        if let Ok(entries) = fs::read_dir(root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let _ = fs::remove_dir_all(path);
                } else {
                    let _ = fs::remove_file(path);
                }
            }
        }
    } else {
        let _ = fs::remove_dir_all(root);
    }
}

/// Export an SQLite-backed project into one ordinary local project.
/// The destination must be absent or empty so migration can never overwrite work.
#[tauri::command]
pub fn export_to_fs_project(
    db: State<'_, Database>,
    project_id: String,
    output_path: String,
) -> Result<ExportToFsResult, String> {
    let project = db
        .get_project(&project_id)
        .map_err(|e| format!("DB_ERROR: {}", e))?
        .ok_or_else(|| "PROJECT_NOT_FOUND".to_string())?;
    let objects = db
        .list_world_objects(&project_id)
        .map_err(|e| format!("DB_ERROR: {}", e))?;

    let requested_root = PathBuf::from(&output_path);
    if !requested_root.is_absolute() {
        return Err("PROJECT_PATH_MUST_BE_ABSOLUTE".to_string());
    }
    let root_existed = requested_root.exists();
    if root_existed {
        if !requested_root.is_dir() {
            return Err("PROJECT_PATH_NOT_DIRECTORY".to_string());
        }
        let mut entries = fs::read_dir(&requested_root)
            .map_err(|e| format!("READ_ERROR: {}", e))?;
        if entries.next().is_some() {
            return Err("PROJECT_DIRECTORY_NOT_EMPTY".to_string());
        }
    } else {
        fs::create_dir_all(&requested_root)
            .map_err(|e| format!("CREATE_ERROR: {}", e))?;
    }

    let operation = (|| -> Result<ExportToFsResult, String> {
        let root = requested_root
            .canonicalize()
            .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
        let glyph_dir = root.join(".glyph");
        fs::create_dir_all(&glyph_dir)
            .map_err(|e| format!("CREATE_ERROR: {}", e))?;

        let now = now_millis();
        let new_id = Uuid::new_v4().to_string();
        let project_meta = serde_json::json!({
            "glyphVersion": "0.4.1",
            "projectId": new_id,
            "name": project.name,
            "genre": project.genre,
            "createdAt": project.created_at,
            "lastOpenedAt": now,
            "migratedFrom": project_id,
            "fileCount": objects.len(),
            "totalWordCount": project.word_count
        });
        let metadata = serde_json::to_string_pretty(&project_meta)
            .map_err(|e| format!("SERIALIZE_ERROR: {}", e))?;
        atomic_create(&glyph_dir.join("project.json"), &metadata)?;
        write_default_session(&root, None)?;

        let mut file_count = 0usize;
        for object in &objects {
            let type_dir = match object.object_type.as_str() {
                "character" => "characters",
                "rule" | "faction" => "world",
                "chapter" | "scene" => "chapters",
                _ => "notes",
            };
            let dir_path = root.join(type_dir);
            fs::create_dir_all(&dir_path)
                .map_err(|e| format!("CREATE_ERROR: {}", e))?;

            let base_name = migration_filename(&object.name);
            let mut file_path = dir_path.join(format!("{}.md", base_name));
            if file_path.exists() {
                let short_id: String = object.id.chars().take(8).collect();
                file_path = dir_path.join(format!("{}-{}.md", base_name, short_id));
            }

            let frontmatter = serde_json::json!({
                "glyph-id": object.id,
                "type": object.object_type,
                "status": object.status,
                "canon": object.canon_level,
                "tags": object.tags,
                "aliases": object.aliases
            });
            let frontmatter_text = serde_json::to_string_pretty(&frontmatter)
                .map_err(|e| format!("SERIALIZE_ERROR: {}", e))?;
            let markdown = format!(
                "---\n{}\n---\n\n# {}\n\n{}",
                frontmatter_text, object.name, object.content
            );
            atomic_create(&file_path, &markdown).map_err(|error| {
                format!("WRITE_ERROR: {}: {}", file_path.display(), error)
            })?;
            file_count += 1;
        }

        let normalized_root = root.to_string_lossy().replace('\\', "/");
        db.create_fs_project(
            &new_id,
            &project.name,
            &normalized_root,
            &project.genre,
            now,
        )
        .map_err(|e| format!("DB_ERROR: {}", e))?;

        Ok(ExportToFsResult {
            success: true,
            project: FsProject {
                id: new_id,
                name: project.name,
                root_path: normalized_root,
                genre: project.genre,
                created_at: project.created_at,
                last_opened_at: now,
                updated_at: now,
            },
            object_count: objects.len(),
            file_count,
        })
    })();

    if operation.is_err() {
        clear_migration_output(&requested_root, root_existed);
    }
    operation
}

// ============================================================================
//  Content Search
// ============================================================================

/// Search file contents within a project for a text query.
/// Returns matching file paths with match count and preview snippets.
#[tauri::command]
pub fn search_file_content(
    project_root: String,
    query: String,
    max_results: Option<u32>,
    file_pattern: Option<String>,
) -> Result<ContentSearchResult, String> {
    let root = fs::canonicalize(&project_root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;

    if !root.is_dir() {
        return Err("NOT_A_DIRECTORY: root is not a directory".to_string());
    }

    let max_matches = max_results.unwrap_or(20).min(50) as usize;
    let lower_query = query.to_lowercase();
    let mut matches: Vec<SearchMatch> = Vec::new();
    let mut total_files: u32 = 0;

    // Recursively walk the directory
    fn visit_dirs(
        dir: &Path,
        root: &Path,
        lower_query: &str,
        max_matches: usize,
        matches: &mut Vec<SearchMatch>,
        total_files: &mut u32,
        file_pattern: &Option<String>,
    ) -> Result<(), String> {
        if matches.len() >= max_matches {
            return Ok(());
        }

        let read_dir = fs::read_dir(dir)
            .map_err(|e| format!("READ_DIR_ERROR: {}", e))?;

        for entry in read_dir {
            if matches.len() >= max_matches {
                break;
            }

            let entry = entry.map_err(|e| format!("ENTRY_ERROR: {}", e))?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // Skip hidden files/directories
            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                // Skip .glyph directory
                if name == ".glyph" {
                    continue;
                }
                visit_dirs(&path, root, lower_query, max_matches, matches, total_files, file_pattern)?;
            } else if path.is_file() {
                // Check file pattern if specified
                if let Some(pattern) = file_pattern {
                    if !name.to_lowercase().contains(&pattern.to_lowercase()) {
                        continue;
                    }
                }

                // Only search text-like files (skip binaries by extension)
                let ext = path.extension()
                    .map(|e| e.to_string_lossy().to_lowercase())
                    .unwrap_or_default();
                match ext.as_str() {
                    "md" | "txt" | "json" | "yaml" | "yml" | "toml" | "css" | "html" |
                    "js" | "ts" | "tsx" | "jsx" | "rs" | "py" | "sh" | "bat" | "conf" |
                    "ini" | "cfg" | "xml" | "svg" | "env" | "vue" | "svelte" => {},
                    _ => continue,
                }

                // Check file size (skip > 1MB for search)
                let metadata = path.metadata().map_err(|e| format!("METADATA_ERROR: {}", e))?;
                if metadata.len() > 1_048_576 {
                    continue;
                }

                let content = match fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                *total_files += 1;
                let mut match_count = 0u32;
                let mut previews: Vec<String> = Vec::new();

                for line in content.lines() {
                    if line.to_lowercase().contains(lower_query) {
                        match_count += 1;
                        if previews.len() < 3 {
                            let trimmed = line.trim();
                            let preview = if trimmed.len() > 120 {
                                format!("{}...", &trimmed[..117])
                            } else {
                                trimmed.to_string()
                            };
                            previews.push(preview);
                        }
                    }
                }

                if match_count > 0 {
                    let rel_path = path.strip_prefix(root)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .to_string()
                        .replace('\\', "/");

                    matches.push(SearchMatch {
                        file_path: rel_path,
                        match_count,
                        previews,
                    });
                }
            }
        }
        Ok(())
    }

    visit_dirs(&root, &root, &lower_query, max_matches, &mut matches, &mut total_files, &file_pattern)?;

    // Sort by match count descending
    matches.sort_by(|a, b| b.match_count.cmp(&a.match_count));

    Ok(ContentSearchResult {
        matches,
        total_files_searched: total_files,
    })
}

// ============================================================================
//  File Watching
// ============================================================================

/// Start watching a project directory for external file changes.
#[tauri::command]
pub fn watch_project(
    app_handle: tauri::AppHandle,
    watcher: tauri::State<'_, FileWatcher>,
    project_root: String,
) -> Result<(), String> {
    watcher.start_watching(app_handle, &project_root)
}

/// Stop watching a project directory.
#[tauri::command]
pub fn unwatch_project(
    watcher: tauri::State<'_, FileWatcher>,
    project_root: String,
) -> Result<(), String> {
    watcher.stop_watching(&project_root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    fn setup_test_dir(name: &str) -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let root = dir.path().join(name);
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(root.join("subdir")).unwrap();
        fs::write(root.join("test.md"), "# Hello").unwrap();
        fs::write(root.join("subdir").join("nested.md"), "# Nested").unwrap();
        (dir, root)
    }

    // ── resolve_project_path ──

    #[test]
    fn test_resolve_project_path_within_root() {
        let (_dir, root) = setup_test_dir("within");
        let result = resolve_project_path(root.to_str().unwrap(), "test.md");
        assert!(result.is_ok(), "Should resolve: {:?}", result.err());
        assert!(result.unwrap().ends_with("test.md"));
    }

    #[test]
    fn test_resolve_project_path_subdirectory() {
        let (_dir, root) = setup_test_dir("subdir_test");
        let result = resolve_project_path(root.to_str().unwrap(), "subdir/nested.md");
        assert!(result.is_ok());
        assert!(result.unwrap().ends_with("nested.md"));
    }

    #[test]
    fn test_resolve_project_path_rejects_escape_traversal() {
        let (_dir, root) = setup_test_dir("escape_test");
        let result = resolve_project_path(root.to_str().unwrap(), "../outside.md");
        let err = result.as_ref().err().map(|e| e.to_string()).unwrap_or_default();
        assert!(result.is_err(), "Should reject path traversal, got: {}", err);
        assert!(err.contains("PATH_ESCAPE") || err.contains("INVALID_PATH"), "Unexpected error: {}", err);
    }

    #[test]
    fn test_resolve_project_path_rejects_absolute_escape() {
        let (_dir, root) = setup_test_dir("abs_escape");
        let result = resolve_project_path(root.to_str().unwrap(), "C:/Windows/system32/evil.exe");
        assert!(result.is_err(), "Should reject absolute path outside root");
    }

    #[test]
    fn test_resolve_project_path_rejects_double_dot() {
        let (_dir, root) = setup_test_dir("dotdot");
        let result = resolve_project_path(root.to_str().unwrap(), "subdir/../../outside.md");
        assert!(result.is_err(), "Should reject double-dot traversal");
    }

    #[test]
    fn test_resolve_project_path_rejects_windows_backslash_traversal() {
        let (_dir, root) = setup_test_dir("backslash_escape");
        let result = resolve_project_path(root.to_str().unwrap(), r"subdir\..\..\outside.md");
        assert!(result.is_err(), "Should reject Windows-style traversal on every host");
    }

    #[test]
    fn test_resolve_project_path_non_existent_path_still_validated() {
        let (_dir, root) = setup_test_dir("nonexist");
        // New file path that doesn't exist yet should resolve its parent
        let result = resolve_project_path(root.to_str().unwrap(), "new_chapter.md");
        assert!(result.is_ok(), "Should allow new file paths");
    }

    #[test]
    fn test_resolve_project_path_allows_new_nested_path() {
        let (_dir, root) = setup_test_dir("nested_create");
        let result = resolve_project_path(root.to_str().unwrap(), "new/chapters/ch01.md");
        assert!(result.is_ok(), "Should allow nested new paths: {:?}", result.err());
        assert!(result.unwrap().ends_with("new/chapters/ch01.md"));
    }

    #[test]
    fn test_resolve_project_path_rejects_escape_via_deep_traversal() {
        let (_dir, root) = setup_test_dir("deep_escape");
        // Create subdir within root
        fs::create_dir_all(root.join("a").join("b")).unwrap();
        let result = resolve_project_path(root.to_str().unwrap(), "a/b/../../../etc/passwd");
        assert!(result.is_err(), "Should reject deep traversal escape");
    }

    // ── resolve_existing_path ──

    #[test]
    fn test_resolve_existing_path_finds_file() {
        let (_dir, root) = setup_test_dir("existing");
        let result = resolve_existing_path(root.to_str().unwrap(), "test.md");
        assert!(result.is_ok());
    }

    #[test]
    fn test_resolve_existing_path_rejects_missing() {
        let (_dir, root) = setup_test_dir("missing");
        let result = resolve_existing_path(root.to_str().unwrap(), "nonexistent.md");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("PATH_NOT_FOUND"));
    }

    // ── atomic_write ──

    #[test]
    fn test_atomic_write_creates_file() {
        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let file_path = dir.path().join("test.md");

        atomic_write(&file_path, "# Atomic content").unwrap();

        assert!(file_path.exists());
        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "# Atomic content");
    }

    #[test]
    fn test_atomic_write_overwrites_safely() {
        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let file_path = dir.path().join("test.md");
        fs::write(&file_path, "# Old content").unwrap();

        atomic_write(&file_path, "# New content").unwrap();

        let content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(content, "# New content");
    }

    #[test]
    fn test_atomic_write_no_temp_file_left_behind() {
        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let file_path = dir.path().join("test.md");

        atomic_write(&file_path, "Clean write").unwrap();

        let leftovers: Vec<_> = fs::read_dir(dir.path())
            .unwrap()
            .filter_map(Result::ok)
            .filter(|entry| entry.file_name().to_string_lossy().starts_with(".glyph-write-"))
            .collect();
        assert!(leftovers.is_empty(), "Temporary files should be removed after successful write");
    }

    #[test]
    fn test_atomic_create_never_overwrites_existing_file() {
        let dir = tempfile::tempdir().expect("Failed to create temp dir");
        let file_path = dir.path().join("existing.md");
        fs::write(&file_path, "original").unwrap();

        let result = atomic_create(&file_path, "replacement");

        assert!(result.is_err());
        assert_eq!(fs::read_to_string(&file_path).unwrap(), "original");
    }

    #[test]
    fn test_content_version_tracks_content_not_only_timestamp() {
        assert_eq!(content_version("same"), content_version("same"));
        assert_ne!(content_version("first"), content_version("second"));
    }

    // ── relative_path ──

    #[test]
    fn test_relative_path_normalizes_separator() {
        let root = "C:/project";
        let abs_path = Path::new("C:\\project\\subdir\\file.md");
        let rel = relative_path(root, abs_path);
        assert_eq!(rel, "subdir/file.md", "Should normalize backslashes to forward slashes");
    }

    #[test]
    fn test_relative_path_root_file() {
        let root = "C:/project";
        let abs_path = Path::new("C:/project/readme.md");
        let rel = relative_path(root, abs_path);
        assert_eq!(rel, "readme.md");
    }
}

