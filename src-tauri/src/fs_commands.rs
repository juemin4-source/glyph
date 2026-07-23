use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::State;
use uuid::Uuid;

use crate::db::Database;
use crate::fs_models::*;
use crate::fs_watcher::FileWatcher;

// ============================================================================
//  Path Validation
// ============================================================================

/// Validate that `sub_path` resolves inside `project_root`.
/// Returns the canonical absolute path, or an error if the path escapes.
fn resolve_project_path(project_root: &str, sub_path: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(project_root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;

    let target = Path::new(sub_path);
    let target = if target.is_absolute() {
        fs::canonicalize(target)
            .map_err(|_| format!("PATH_NOT_FOUND: {}", sub_path))?
    } else {
        let joined = root.join(target);
        // If the path doesn't exist yet (e.g. for create/write), canonicalize parent
        if joined.exists() {
            fs::canonicalize(&joined)
                .map_err(|_| format!("PATH_NOT_FOUND: {}", sub_path))?
        } else {
            // Validate the parent exists and is within bounds
            let parent = joined.parent().ok_or_else(|| "INVALID_PATH: no parent".to_string())?;
            let canonical_parent = fs::canonicalize(parent)
                .map_err(|e| format!("INVALID_PARENT_PATH: {}", e))?;
            if !canonical_parent.starts_with(&root) {
                return Err("PATH_ESCAPE: path escapes project root".to_string());
            }
            // Return the unresolved joined path (it doesn't exist yet)
            return Ok(joined);
        }
    };

    if !target.starts_with(&root) {
        return Err("PATH_ESCAPE: path escapes project root".to_string());
    }
    Ok(target)
}

/// Validate that a path exists and is within the project root.
fn resolve_existing_path(project_root: &str, sub_path: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(project_root)
        .map_err(|e| format!("INVALID_PROJECT_ROOT: {}", e))?;
    let target = Path::new(sub_path);
    let target = if target.is_absolute() {
        fs::canonicalize(target)
            .map_err(|_| format!("PATH_NOT_FOUND: {}", sub_path))?
    } else {
        fs::canonicalize(root.join(target))
            .map_err(|_| format!("PATH_NOT_FOUND: {}", sub_path))?
    };
    if !target.starts_with(&root) {
        return Err("PATH_ESCAPE: path escapes project root".to_string());
    }
    Ok(target)
}

/// Get the relative path within a project root.
fn relative_path(project_root: &str, abs_path: &Path) -> String {
    let root = Path::new(project_root);
    abs_path.strip_prefix(root)
        .unwrap_or(abs_path)
        .to_string_lossy()
        .replace('\\', "/")
}

/// Get file metadata (modification time as epoch millis)
fn modified_at(metadata: &fs::Metadata) -> i64 {
    metadata.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Atomically write content to a file (write to .tmp then rename).
fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let tmp_path = path.with_extension("tmp");
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("WRITE_ERROR: cannot create parent: {}", e))?;
    }
    fs::write(&tmp_path, content)
        .map_err(|e| format!("WRITE_ERROR: {}", e))?;
    fs::rename(&tmp_path, path)
        .map_err(|e| format!("RENAME_ERROR: {}", e))?;
    Ok(())
}

// ============================================================================
//  Project Commands
// ============================================================================

/// Create a new filesystem project at the given root path.
#[tauri::command]
pub fn create_fs_project(
    db: State<'_, Database>,
    name: String,
    root_path: String,
    genre: Option<String>,
) -> Result<CreateFsProjectOutput, String> {
    let root = Path::new(&root_path);
    let glyph_dir = root.join(".glyph");

    // Create .glyph directory
    fs::create_dir_all(&glyph_dir)
        .map_err(|e| format!("CREATE_ERROR: cannot create .glyph directory: {}", e))?;

    let project_id = Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let genre_val = genre.unwrap_or_default();

    // Write project.json metadata
    let project_meta = serde_json::json!({
        "glyphVersion": "0.1.0",
        "projectId": project_id,
        "name": name,
        "genre": genre_val,
        "createdAt": now,
        "lastOpenedAt": now,
        "fileCount": 0,
        "totalWordCount": 0
    });
    let meta_path = glyph_dir.join("project.json");
    fs::write(&meta_path, serde_json::to_string_pretty(&project_meta).unwrap())
        .map_err(|e| format!("WRITE_ERROR: cannot write project.json: {}", e))?;

    // Create initial session.json
    let session = serde_json::json!({
        "lastOpenFilePath": null,
        "lastCursorLine": null,
        "lastCursorColumn": null,
        "lastScrollPosition": null,
        "openFilePaths": [],
        "sidebarWidth": null,
        "focusMode": false,
        "lastEditMode": "wysiwyg",
        "lastSessionAt": now
    });
    let session_path = glyph_dir.join("session.json");
    fs::write(&session_path, serde_json::to_string_pretty(&session).unwrap())
        .map_err(|e| format!("WRITE_ERROR: cannot write session.json: {}", e))?;

    // Create initial skeleton directories
    let mut created_dirs: Vec<String> = Vec::new();
    let mut created_files: Vec<String> = Vec::new();

    for dir_name in &["chapters", "characters", "world", "notes"] {
        let dir_path = root.join(dir_name);
        if !dir_path.exists() {
            fs::create_dir(&dir_path)
                .map_err(|e| format!("CREATE_ERROR: cannot create {}: {}", dir_name, e))?;
            created_dirs.push(dir_name.to_string());
        }
    }

    // Register in SQLite
    db.create_fs_project(&project_id, &name, &root_path, &genre_val, now)
        .map_err(|e| format!("DB_ERROR: {}", e))?;

    let project = FsProject {
        id: project_id,
        name,
        root_path: root_path.replace('\\', "/"),
        genre: genre_val,
        created_at: now,
        last_opened_at: now,
        updated_at: now,
    };

    Ok(CreateFsProjectOutput {
        project,
        created_directories: created_dirs,
        created_files,
    })
}

/// Open and validate an existing filesystem project.
#[tauri::command]
pub fn open_fs_project(
    db: State<'_, Database>,
    root_path: String,
) -> Result<FsProject, String> {
    let root = Path::new(&root_path);
    let meta_path = root.join(".glyph").join("project.json");

    let meta_content = fs::read_to_string(&meta_path)
        .map_err(|_| "NOT_A_GLYPH_PROJECT: .glyph/project.json not found".to_string())?;

    let meta: serde_json::Value = serde_json::from_str(&meta_content)
        .map_err(|e| format!("INVALID_METADATA: {}", e))?;

    let project_id = meta["projectId"].as_str()
        .ok_or_else(|| "INVALID_METADATA: missing projectId".to_string())?
        .to_string();
    let name = meta["name"].as_str()
        .ok_or_else(|| "INVALID_METADATA: missing name".to_string())?
        .to_string();
    let genre = meta["genre"].as_str().unwrap_or("").to_string();
    let created_at = meta["createdAt"].as_i64().unwrap_or(0);
    let last_opened_at = meta["lastOpenedAt"].as_i64().unwrap_or(0);

    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    // Update last opened timestamp
    let updated_meta = serde_json::json!({
        "glyphVersion": meta["glyphVersion"],
        "projectId": project_id,
        "name": name,
        "genre": genre,
        "createdAt": created_at,
        "lastOpenedAt": now,
        "fileCount": meta["fileCount"],
        "totalWordCount": meta["totalWordCount"]
    });
    fs::write(&meta_path, serde_json::to_string_pretty(&updated_meta).unwrap())
        .map_err(|e| format!("WRITE_ERROR: {}", e))?;

    // Register in SQLite if not already
    db.upsert_fs_project(&project_id, &name, &root_path, &genre, created_at, now, now)
        .map_err(|e| format!("DB_ERROR: {}", e))?;

    Ok(FsProject {
        id: project_id,
        name,
        root_path: root_path.replace('\\', "/"),
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

/// Read a text file from the project (UTF-8).
#[tauri::command]
pub fn read_file(
    project_root: String,
    path: String,
) -> Result<String, String> {
    let target = resolve_existing_path(&project_root, &path)?;

    if !target.is_file() {
        return Err("NOT_A_FILE: path is not a file".to_string());
    }

    // Check file size (reject > 10MB)
    let metadata = target.metadata().map_err(|e| format!("METADATA_ERROR: {}", e))?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err("FILE_TOO_LARGE: file exceeds 10MB limit".to_string());
    }

    let content = fs::read_to_string(&target)
        .map_err(|e| format!("READ_ERROR: {}", e))?;

    Ok(content)
}

/// Write content to a file (creates parent dirs if needed, atomic write).
#[tauri::command]
pub fn write_file(
    project_root: String,
    path: String,
    content: String,
) -> Result<(), String> {
    let target = resolve_project_path(&project_root, &path)?;

    atomic_write(&target, &content)
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

    fs::write(&target, "")
        .map_err(|e| format!("CREATE_ERROR: {}", e))?;

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

    fs::create_dir(&target)
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

    let trash_dir = Path::new(&project_root).join(".glyph-trash");
    fs::create_dir_all(&trash_dir)
        .map_err(|e| format!("TRASH_ERROR: {}", e))?;

    let trash_name = format!("{}_{}",
        target.file_name().unwrap_or_default().to_string_lossy(),
        std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH).unwrap().as_millis()
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

/// Read session state from .glyph/session.json
#[tauri::command]
pub fn get_session_state(
    project_root: String,
) -> Result<SessionState, String> {
    let session_path = Path::new(&project_root).join(".glyph").join("session.json");

    if !session_path.exists() {
        // Return default session state
        return Ok(SessionState {
            last_open_file_path: None,
            last_cursor_line: None,
            last_cursor_column: None,
            last_scroll_position: None,
            open_file_paths: Vec::new(),
            sidebar_width: None,
            focus_mode: None,
            last_edit_mode: None,
            last_session_at: 0,
        });
    }

    let content = fs::read_to_string(&session_path)
        .map_err(|e| format!("READ_ERROR: {}", e))?;

    let state: SessionState = serde_json::from_str(&content)
        .map_err(|e| format!("PARSE_ERROR: {}", e))?;

    Ok(state)
}

/// Save session state to .glyph/session.json
#[tauri::command]
pub fn save_session_state(
    project_root: String,
    state: SessionState,
) -> Result<(), String> {
    let session_path = Path::new(&project_root).join(".glyph").join("session.json");

    // Ensure .glyph directory exists
    if let Some(parent) = session_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("WRITE_ERROR: {}", e))?;
    }

    let content = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("SERIALIZE_ERROR: {}", e))?;

    atomic_write(&session_path, &content)
}

// ============================================================================
//  Migration Helpers
// ============================================================================

/// Export an SQLite-backed project to the filesystem layout.
#[tauri::command]
pub fn export_to_fs_project(
    db: State<'_, Database>,
    project_id: String,
    output_path: String,
) -> Result<ExportToFsResult, String> {
    let project = db.get_project(&project_id)
        .map_err(|e| format!("DB_ERROR: {}", e))?
        .ok_or_else(|| "PROJECT_NOT_FOUND".to_string())?;
    let objects = db.list_world_objects(&project_id)
        .map_err(|e| format!("DB_ERROR: {}", e))?;
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;

    let root = Path::new(&output_path);
    let glyph_dir = root.join(".glyph");

    // Create .glyph directory
    fs::create_dir_all(&glyph_dir)
        .map_err(|e| format!("CREATE_ERROR: {}", e))?;

    // Write project.json
    let new_id = Uuid::new_v4().to_string();
    let project_meta = serde_json::json!({
        "glyphVersion": "0.1.0",
        "projectId": new_id,
        "name": project.name,
        "genre": project.genre,
        "createdAt": project.created_at,
        "lastOpenedAt": now,
        "migratedFrom": project_id,
        "fileCount": objects.len(),
        "totalWordCount": project.word_count
    });
    fs::write(
        glyph_dir.join("project.json"),
        serde_json::to_string_pretty(&project_meta).unwrap()
    ).map_err(|e| format!("WRITE_ERROR: {}", e))?;

    // Write initial session
    let session = serde_json::json!({
        "lastOpenFilePath": null,
        "lastCursorLine": null,
        "lastCursorColumn": null,
        "lastScrollPosition": null,
        "openFilePaths": [],
        "sidebarWidth": null,
        "focusMode": false,
        "lastEditMode": "wysiwyg",
        "lastSessionAt": now
    });
    fs::write(
        glyph_dir.join("session.json"),
        serde_json::to_string_pretty(&session).unwrap()
    ).map_err(|e| format!("WRITE_ERROR: {}", e))?;

    // Write objects as .md files grouped by type
    let mut file_count = 0;
    for obj in &objects {
        let type_dir = match obj.object_type.as_str() {
            "character" => "characters",
            "rule" => "world",
            "faction" => "world",
            "chapter" | "scene" => "chapters",
            _ => "notes",
        };
        let dir_path = root.join(type_dir);
        fs::create_dir_all(&dir_path)
            .map_err(|e| format!("CREATE_ERROR: {}", e))?;

        // Sanitize filename (limit length, remove problematic chars)
        let safe_name: String = obj.name.chars()
            .map(|c| if c.is_alphanumeric() || c == '_' || c == '-' || c == ' ' { c } else { '_' })
            .collect();
        let safe_name = safe_name.trim();
        let filename = if safe_name.len() > 80 {
            &safe_name[..80]
        } else {
            safe_name
        };
        let file_path = dir_path.join(format!("{}.md", filename));

        // Add YAML frontmatter with metadata
        let frontmatter = serde_json::json!({
            "glyph-id": obj.id,
            "type": obj.object_type,
            "status": obj.status,
            "canon": obj.canon_level,
            "tags": obj.tags,
            "aliases": obj.aliases
        });
        let md_content = format!(
            "---\n{}---\n\n# {}\n\n{}",
            serde_json::to_string_pretty(&frontmatter).unwrap(),
            obj.name,
            obj.content
        );

        fs::write(&file_path, &md_content)
            .map_err(|e| format!("WRITE_ERROR: {}: {}", filename, e))?;
        file_count += 1;
    }

    // Register the new FS project
    db.create_fs_project(&new_id, &project.name, &output_path, &project.genre, now)
        .map_err(|e| format!("DB_ERROR: {}", e))?;

    let fs_project = FsProject {
        id: new_id,
        name: project.name,
        root_path: output_path.replace('\\', "/"),
        genre: project.genre,
        created_at: project.created_at,
        last_opened_at: now,
        updated_at: now,
    };

    Ok(ExportToFsResult {
        success: true,
        project: fs_project,
        object_count: objects.len(),
        file_count,
    })
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
    fn test_resolve_project_path_non_existent_path_still_validated() {
        let (_dir, root) = setup_test_dir("nonexist");
        // New file path that doesn't exist yet should resolve its parent
        let result = resolve_project_path(root.to_str().unwrap(), "new_chapter.md");
        assert!(result.is_ok(), "Should allow new file paths");
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

        // Ensure no .tmp file remains
        let tmp_path = file_path.with_extension("tmp");
        assert!(!tmp_path.exists(), "Temp file should be removed after successful write");
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

