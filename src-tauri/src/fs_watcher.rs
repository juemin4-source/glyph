use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use notify::{EventKind, Watcher};
use tauri::{AppHandle, Emitter};

use crate::fs_models::FileChangeEvent;

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn normalize_absolute(path: &Path) -> String {
    let normalized = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .replace('\\', "/");
    #[cfg(windows)]
    {
        normalized.to_lowercase()
    }
    #[cfg(not(windows))]
    {
        normalized
    }
}

fn relative_display_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn is_internal_path(root: &Path, path: &Path) -> bool {
    let relative = path.strip_prefix(root).unwrap_or(path);
    relative.components().any(|component| {
        matches!(
            component.as_os_str().to_string_lossy().as_ref(),
            ".glyph" | ".glyph-trash"
        )
    }) || path
        .file_name()
        .map(|name| name.to_string_lossy().starts_with(".glyph-write-"))
        .unwrap_or(false)
}

/// Watches real project directories. Glyph's own writes are deliberately not
/// hidden here: the frontend compares content versions, so a self-generated
/// event becomes a harmless no-op. This avoids swallowing a real external edit
/// that happens shortly after Glyph saves the same file.
pub struct FileWatcher {
    watchers: Arc<Mutex<HashMap<String, notify::RecommendedWatcher>>>,
}

impl FileWatcher {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn start_watching(
        &self,
        app_handle: AppHandle,
        project_root: &str,
    ) -> Result<(), String> {
        let root = PathBuf::from(project_root)
            .canonicalize()
            .map_err(|e| format!("WATCH_ERROR: invalid project root: {}", e))?;
        if !root.is_dir() {
            return Err(format!(
                "WATCH_ERROR: project root is not a directory: {}",
                project_root
            ));
        }

        let watcher_key = normalize_absolute(&root);
        {
            let watchers = self
                .watchers
                .lock()
                .map_err(|_| "WATCH_ERROR: lock poisoned".to_string())?;
            if watchers.contains_key(&watcher_key) {
                return Ok(());
            }
        }

        let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();
        let mut watcher = notify::RecommendedWatcher::new(tx, notify::Config::default())
            .map_err(|e| format!("WATCH_ERROR: {}", e))?;
        watcher
            .watch(&root, notify::RecursiveMode::Recursive)
            .map_err(|e| format!("WATCH_ERROR: {}", e))?;

        let app_clone = app_handle.clone();
        let root_clone = root.clone();
        let project_root_for_event = root.to_string_lossy().replace('\\', "/");

        std::thread::spawn(move || {
            let debounce = Duration::from_millis(250);
            let mut pending: HashMap<String, i64> = HashMap::new();

            loop {
                match rx.recv_timeout(debounce) {
                    Ok(Ok(event)) => {
                        if matches!(event.kind, EventKind::Access(_)) {
                            continue;
                        }
                        let now = now_millis();
                        for path in event.paths {
                            if is_internal_path(&root_clone, &path) {
                                continue;
                            }
                            pending.insert(relative_display_path(&root_clone, &path), now);
                        }
                    }
                    Ok(Err(_)) => {}
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        if pending.is_empty() {
                            continue;
                        }
                        let mut paths: Vec<String> = pending.keys().cloned().collect();
                        paths.sort();
                        let timestamp = pending
                            .values()
                            .copied()
                            .max()
                            .unwrap_or_else(now_millis);
                        let _ = app_clone.emit(
                            "fs:file-changed",
                            FileChangeEvent {
                                project_root: project_root_for_event.clone(),
                                paths,
                                timestamp,
                            },
                        );
                        pending.clear();
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        let mut watchers = self
            .watchers
            .lock()
            .map_err(|_| "WATCH_ERROR: lock poisoned".to_string())?;
        watchers.insert(watcher_key, watcher);
        Ok(())
    }

    pub fn stop_watching(&self, project_root: &str) -> Result<(), String> {
        let key = normalize_absolute(Path::new(project_root));
        let mut watchers = self
            .watchers
            .lock()
            .map_err(|_| "WATCH_ERROR: lock poisoned".to_string())?;
        watchers.remove(&key);
        Ok(())
    }
}
