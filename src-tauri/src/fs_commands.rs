use std::fs;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::State;
use uuid::Uuid;

use crate::db::Database;
use crate::fs_models::*;
use crate::fs_watcher::FileWatcher;

const MAX_CONTENT_SEARCH_FILES: u32 = 10_000;
const MAX_CONTENT_SEARCH_DEPTH: usize = 64;

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


fn validate_ai_target_path(path: &str) -> Result<(), String> {
    let relative = validate_relative_path(path)?;
    let first = relative.components().next().map(|part| part.as_os_str().to_string_lossy().to_string()).unwrap_or_default();
    if first.eq_ignore_ascii_case(".glyph") || first.eq_ignore_ascii_case(".glyph-trash") {
        return Err("AI_TARGET_FORBIDDEN: internal directories cannot be written".to_string());
    }
    let extension = relative.extension().and_then(|value| value.to_str()).unwrap_or("").to_lowercase();
    if extension != "md" && extension != "markdown" {
        return Err("AI_TARGET_TYPE_FORBIDDEN: Gate C writes Markdown files only".to_string());
    }
    Ok(())
}

fn validate_operation_id(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.len() > 96 || !trimmed.chars().all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_') {
        return Err("INVALID_OPERATION_ID".to_string());
    }
    Ok(trimmed.to_string())
}

fn write_ai_action_record(
    record_path: &Path,
    operation_id: &str,
    input: &AiFileActionInput,
    status: &str,
    snapshot_path: Option<&str>,
    old_version: Option<&str>,
    new_version: Option<&str>,
    error: Option<&str>,
) -> Result<(), String> {
    let instruction: String = input.instruction.chars().take(4_000).collect();
    let change_summary: String = input.change_summary.chars().take(1_000).collect();
    let evidence_paths: Vec<String> = input.evidence_paths.iter().take(32).map(|value| value.chars().take(500).collect()).collect();
    let value = serde_json::json!({
        "glyphVersion": "0.4.3",
        "operationId": operation_id,
        "actionType": input.action_type,
        "targetPath": input.target_path,
        "status": status,
        "instruction": instruction,
        "changeSummary": change_summary,
        "evidencePaths": evidence_paths,
        "snapshotPath": snapshot_path,
        "oldVersion": old_version,
        "newVersion": new_version,
        "error": error,
        "updatedAt": now_millis(),
    });
    let content = serde_json::to_string_pretty(&value).map_err(|e| format!("SERIALIZE_ERROR: {}", e))?;
    atomic_write(record_path, &content)
}

/// Commit one bounded AI file action. Generation happens outside this command;
/// this boundary performs the final single-file transaction and records it.
#[tauri::command]
pub fn commit_ai_file_action(
    project_root: String,
    input: AiFileActionInput,
) -> Result<AiFileActionOutput, String> {
    if input.content.len() > 4 * 1024 * 1024 {
        return Err("AI_OUTPUT_TOO_LARGE: content exceeds 4MB".to_string());
    }
    if input.action_type != "create" && input.action_type != "modify" {
        return Err("AI_ACTION_FORBIDDEN: only create or modify is allowed".to_string());
    }
    validate_ai_target_path(&input.target_path)?;
    let operation_id = validate_operation_id(&input.operation_id)?;
    let root = fs::canonicalize(&project_root).map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    let glyph_dir = safe_internal_directory(&root, ".glyph", true)?;
    let actions_dir = safe_internal_directory(&glyph_dir, "actions", true)?;
    let snapshots_dir = safe_internal_directory(&glyph_dir, "snapshots", true)?;
    let record_path = actions_dir.join(format!("{}.json", operation_id));
    if record_path.exists() {
        return Err("AI_OPERATION_EXISTS: operation id already exists".to_string());
    }
    let target = resolve_project_path(&project_root, &input.target_path)?;
    let record_relative = relative_path(&project_root, &record_path);

    write_ai_action_record(&record_path, &operation_id, &input, "prepared", None, None, None, None)?;

    if input.action_type == "create" {
        if target.exists() {
            let _ = write_ai_action_record(&record_path, &operation_id, &input, "failed", None, None, None, Some("FILE_EXISTS"));
            return Err("FILE_EXISTS: file already exists".to_string());
        }
        if let Err(error) = atomic_create(&target, &input.content) {
            let _ = write_ai_action_record(&record_path, &operation_id, &input, "failed", None, None, None, Some(&error));
            return Err(error);
        }
        let metadata = target.metadata().map_err(|e| format!("METADATA_ERROR: {}", e))?;
        let version = content_version(&input.content);
        if let Err(error) = write_ai_action_record(&record_path, &operation_id, &input, "completed", None, None, Some(&version), None) {
            eprintln!("[gate-c] action record finalization failed after create: {}", error);
        }
        return Ok(AiFileActionOutput {
            operation_id,
            action_type: "create".to_string(),
            target_path: input.target_path,
            modified_at: modified_at(&metadata),
            version,
            snapshot_path: None,
            record_path: record_relative,
        });
    }

    if !target.exists() || !target.is_file() {
        let _ = write_ai_action_record(&record_path, &operation_id, &input, "failed", None, None, None, Some("FILE_MISSING"));
        return Err("FILE_MISSING: target file no longer exists".to_string());
    }
    let expected = input.expected_version.as_deref().ok_or_else(|| "AI_EXPECTED_VERSION_REQUIRED".to_string())?;
    let old_content = fs::read_to_string(&target).map_err(|e| format!("READ_ERROR: {}", e))?;
    let old_version = content_version(&old_content);
    if old_version != expected {
        let _ = write_ai_action_record(&record_path, &operation_id, &input, "failed", None, Some(&old_version), None, Some("EXTERNAL_MODIFICATION"));
        return Err(format!("EXTERNAL_MODIFICATION: expected {}, found {}", expected, old_version));
    }

    let snapshot_file = snapshots_dir.join(format!("{}.md", operation_id));
    atomic_create(&snapshot_file, &old_content)?;
    let snapshot_relative = relative_path(&project_root, &snapshot_file);
    write_ai_action_record(&record_path, &operation_id, &input, "committing", Some(&snapshot_relative), Some(&old_version), None, None)?;

    if let Err(error) = atomic_write_checked(&target, &input.content, Some(expected)) {
        let _ = write_ai_action_record(&record_path, &operation_id, &input, "failed", Some(&snapshot_relative), Some(&old_version), None, Some(&error));
        return Err(error);
    }

    let metadata = target.metadata().map_err(|e| format!("METADATA_ERROR: {}", e))?;
    let version = content_version(&input.content);
    if let Err(error) = write_ai_action_record(&record_path, &operation_id, &input, "completed", Some(&snapshot_relative), Some(&old_version), Some(&version), None) {
        eprintln!("[gate-c] action record finalization failed after modify: {}", error);
    }
    Ok(AiFileActionOutput {
        operation_id,
        action_type: "modify".to_string(),
        target_path: input.target_path,
        modified_at: modified_at(&metadata),
        version,
        snapshot_path: Some(snapshot_relative),
        record_path: record_relative,
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

/// Search project text files without following symbolic links or leaving the
/// canonical project root. Gate B intentionally searches only author-facing
/// text formats (Markdown and plain text by default).
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

    let query = query.trim();
    if query.is_empty() {
        return Err("EMPTY_QUERY: search query must not be empty".to_string());
    }
    if query.chars().count() > 200 {
        return Err("QUERY_TOO_LONG: search query exceeds 200 characters".to_string());
    }

    let extensions: Vec<String> = file_pattern
        .unwrap_or_else(|| "md,markdown,txt".to_string())
        .split(|character| matches!(character, ',' | ';' | '|'))
        .map(|item| item.trim().trim_start_matches('.').to_lowercase())
        .filter(|item| !item.is_empty())
        .collect();
    let allowed_extensions = if extensions.is_empty() {
        vec!["md".to_string(), "markdown".to_string(), "txt".to_string()]
    } else {
        extensions
    };

    let max_matches = max_results.unwrap_or(20).clamp(1, 50) as usize;
    let lower_query = query.to_lowercase();
    let mut matches: Vec<SearchMatch> = Vec::new();
    let mut total_files: u32 = 0;
    let mut truncated = false;

    fn truncate_preview(value: &str, max_chars: usize) -> String {
        let mut chars = value.chars();
        let preview: String = chars.by_ref().take(max_chars).collect();
        if chars.next().is_some() {
            format!("{}...", preview)
        } else {
            preview
        }
    }

    fn visit_dirs(
        dir: &Path,
        root: &Path,
        lower_query: &str,
        allowed_extensions: &[String],
        max_matches: usize,
        depth: usize,
        matches: &mut Vec<SearchMatch>,
        total_files: &mut u32,
        truncated: &mut bool,
    ) -> Result<(), String> {
        if matches.len() >= max_matches || *total_files >= MAX_CONTENT_SEARCH_FILES {
            *truncated = true;
            return Ok(());
        }
        if depth > MAX_CONTENT_SEARCH_DEPTH {
            *truncated = true;
            return Ok(());
        }

        let read_dir = fs::read_dir(dir)
            .map_err(|e| format!("READ_DIR_ERROR: {}", e))?;

        for entry in read_dir {
            if matches.len() >= max_matches || *total_files >= MAX_CONTENT_SEARCH_FILES {
                *truncated = true;
                break;
            }

            let entry = entry.map_err(|e| format!("ENTRY_ERROR: {}", e))?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }

            let metadata = match fs::symlink_metadata(&path) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if metadata.file_type().is_symlink() {
                // A project may contain links, but the read-only assistant must
                // never follow one outside the project boundary.
                continue;
            }

            if metadata.is_dir() {
                visit_dirs(
                    &path,
                    root,
                    lower_query,
                    allowed_extensions,
                    max_matches,
                    depth + 1,
                    matches,
                    total_files,
                    truncated,
                )?;
                continue;
            }
            if !metadata.is_file() || metadata.len() > 2 * 1024 * 1024 {
                continue;
            }

            let extension = path
                .extension()
                .map(|value| value.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if !allowed_extensions.iter().any(|allowed| allowed == &extension) {
                continue;
            }

            let content = match fs::read_to_string(&path) {
                Ok(content) => content,
                Err(_) => continue,
            };
            *total_files += 1;

            let mut match_count = 0u32;
            let mut previews: Vec<String> = Vec::new();
            for line in content.lines() {
                if line.to_lowercase().contains(lower_query) {
                    match_count += 1;
                    if previews.len() < 3 {
                        previews.push(truncate_preview(line.trim(), 120));
                    }
                }
            }

            if match_count == 0 {
                continue;
            }

            let relative = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            matches.push(SearchMatch {
                file_path: relative,
                match_count,
                previews,
            });
        }
        Ok(())
    }

    visit_dirs(
        &root,
        &root,
        &lower_query,
        &allowed_extensions,
        max_matches,
        0,
        &mut matches,
        &mut total_files,
        &mut truncated,
    )?;
    matches.sort_by(|left, right| {
        right
            .match_count
            .cmp(&left.match_count)
            .then_with(|| left.file_path.cmp(&right.file_path))
    });

    Ok(ContentSearchResult {
        matches,
        total_files_searched: total_files,
        truncated,
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

    // ── Gate B content search ──

    #[test]
    fn test_search_file_content_handles_long_chinese_preview() {
        let (_dir, root) = setup_test_dir("search_chinese");
        let line = format!("布兰{}", "很长的中文内容".repeat(40));
        fs::write(root.join("人物.md"), line).unwrap();

        let result = search_file_content(
            root.to_string_lossy().to_string(),
            "布兰".to_string(),
            Some(10),
            Some("md,txt".to_string()),
        ).unwrap();

        assert_eq!(result.matches.len(), 1);
        assert!(result.matches[0].previews[0].chars().count() <= 123);
    }

    #[test]
    fn test_search_file_content_rejects_empty_query() {
        let (_dir, root) = setup_test_dir("search_empty");
        let result = search_file_content(
            root.to_string_lossy().to_string(),
            "   ".to_string(),
            None,
            None,
        );
        assert!(result.unwrap_err().contains("EMPTY_QUERY"));
    }

    #[test]
    fn test_search_file_content_only_reads_requested_text_extensions() {
        let (_dir, root) = setup_test_dir("search_extensions");
        fs::write(root.join("notes.txt"), "黑潮发生了").unwrap();
        fs::write(root.join("data.json"), "黑潮发生了").unwrap();

        let result = search_file_content(
            root.to_string_lossy().to_string(),
            "黑潮".to_string(),
            Some(10),
            Some("md,markdown,txt".to_string()),
        ).unwrap();

        assert!(result.matches.iter().any(|item| item.file_path == "notes.txt"));
        assert!(!result.matches.iter().any(|item| item.file_path == "data.json"));
    }

    #[cfg(unix)]
    #[test]
    fn test_search_file_content_does_not_follow_symlink_outside_project() {
        use std::os::unix::fs::symlink;
        let (_dir, root) = setup_test_dir("search_symlink");
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret.md"), "不可读取的秘密").unwrap();
        symlink(outside.path(), root.join("linked-outside")).unwrap();

        let result = search_file_content(
            root.to_string_lossy().to_string(),
            "不可读取的秘密".to_string(),
            Some(10),
            None,
        ).unwrap();

        assert!(result.matches.is_empty());
    }

    // ── Gate C bounded AI file actions ──

    fn ai_input(operation_id: &str, action_type: &str, target_path: &str, content: &str, expected_version: Option<String>) -> AiFileActionInput {
        AiFileActionInput {
            operation_id: operation_id.to_string(),
            action_type: action_type.to_string(),
            target_path: target_path.to_string(),
            content: content.to_string(),
            expected_version,
            instruction: "测试任务".to_string(),
            change_summary: "测试变化".to_string(),
            evidence_paths: vec!["人物/布兰.md".to_string()],
        }
    }

    #[test]
    fn test_ai_create_commits_one_markdown_and_records_action() {
        let (_dir, root) = setup_test_dir("ai_create");
        fs::create_dir_all(root.join(".glyph")).unwrap();
        let output = commit_ai_file_action(
            root.to_string_lossy().to_string(),
            ai_input("ai-create-1", "create", "正文/ch32.md", "# 第三十二章", None),
        ).unwrap();

        assert_eq!(fs::read_to_string(root.join("正文/ch32.md")).unwrap(), "# 第三十二章");
        assert!(root.join(&output.record_path).exists());
        assert!(output.snapshot_path.is_none());
    }

    #[test]
    fn test_ai_create_never_overwrites_existing_file() {
        let (_dir, root) = setup_test_dir("ai_create_exists");
        fs::create_dir_all(root.join(".glyph")).unwrap();
        fs::write(root.join("existing.md"), "原文").unwrap();
        let result = commit_ai_file_action(
            root.to_string_lossy().to_string(),
            ai_input("ai-create-2", "create", "existing.md", "替换", None),
        );

        assert!(result.unwrap_err().contains("FILE_EXISTS"));
        assert_eq!(fs::read_to_string(root.join("existing.md")).unwrap(), "原文");
    }

    #[test]
    fn test_ai_modify_snapshots_before_checked_write() {
        let (_dir, root) = setup_test_dir("ai_modify");
        fs::create_dir_all(root.join(".glyph")).unwrap();
        let target = root.join("test.md");
        let old = fs::read_to_string(&target).unwrap();
        let old_version = content_version(&old);
        let output = commit_ai_file_action(
            root.to_string_lossy().to_string(),
            ai_input("ai-modify-1", "modify", "test.md", "# 新内容", Some(old_version)),
        ).unwrap();

        assert_eq!(fs::read_to_string(&target).unwrap(), "# 新内容");
        let snapshot = output.snapshot_path.expect("modify must return snapshot");
        assert_eq!(fs::read_to_string(root.join(snapshot)).unwrap(), old);
        assert!(root.join(output.record_path).exists());
    }

    #[test]
    fn test_ai_modify_rejects_stale_version_without_changing_file() {
        let (_dir, root) = setup_test_dir("ai_modify_stale");
        fs::create_dir_all(root.join(".glyph")).unwrap();
        let result = commit_ai_file_action(
            root.to_string_lossy().to_string(),
            ai_input("ai-modify-2", "modify", "test.md", "# 不应写入", Some("stale".to_string())),
        );

        assert!(result.unwrap_err().contains("EXTERNAL_MODIFICATION"));
        assert_eq!(fs::read_to_string(root.join("test.md")).unwrap(), "# Hello");
    }

    #[test]
    fn test_ai_action_rejects_internal_or_non_markdown_targets() {
        let (_dir, root) = setup_test_dir("ai_forbidden");
        fs::create_dir_all(root.join(".glyph")).unwrap();
        let internal = commit_ai_file_action(
            root.to_string_lossy().to_string(),
            ai_input("ai-forbidden-1", "create", ".glyph/evil.md", "x", None),
        );
        let binary = commit_ai_file_action(
            root.to_string_lossy().to_string(),
            ai_input("ai-forbidden-2", "create", "evil.exe", "x", None),
        );

        assert!(internal.unwrap_err().contains("AI_TARGET_FORBIDDEN"));
        assert!(binary.unwrap_err().contains("AI_TARGET_TYPE_FORBIDDEN"));
    }

}

