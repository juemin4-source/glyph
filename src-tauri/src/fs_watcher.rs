use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use notify::Watcher;

use crate::fs_models::FileChangeEvent;

/// A managed file watcher that monitors project directories for external changes.
/// Uses notify crate's RecommendedWatcher with event debouncing.
pub struct FileWatcher {
    /// Active watchers keyed by project root path.
    watchers: Arc<Mutex<HashMap<String, notify::RecommendedWatcher>>>,
    /// Whether the watcher system is initialized.
    initialized: bool,
}

impl FileWatcher {
    pub fn new() -> Self {
        FileWatcher {
            watchers: Arc::new(Mutex::new(HashMap::new())),
            initialized: false,
        }
    }

    /// Start watching a project directory.
    /// Events are emitted to the frontend via Tauri's event system.
    pub fn start_watching(
        &self,
        app_handle: AppHandle,
        project_root: &str,
    ) -> Result<(), String> {
        let root = Path::new(project_root);
        if !root.exists() {
            return Err(format!("WATCH_ERROR: project root not found: {}", project_root));
        }

        let (tx, rx) = mpsc::channel::<notify::Result<notify::Event>>();

        let mut watcher = notify::RecommendedWatcher::new(tx, notify::Config::default())
            .map_err(|e| format!("WATCH_ERROR: {}", e))?;

        watcher
            .watch(root, notify::RecursiveMode::Recursive)
            .map_err(|e| format!("WATCH_ERROR: {}", e))?;

        let root_clone = project_root.to_string();
        let app_clone = app_handle.clone();

        // Spawn a thread to handle file events with debouncing
        std::thread::spawn(move || {
            let debounce_ms = 300u64;
            let mut pending_changes: HashMap<String, FileChangeEvent> = HashMap::new();
            let mut last_flush = SystemTime::now();

            loop {
                // Check for new events with a short timeout
                match rx.recv_timeout(Duration::from_millis(debounce_ms)) {
                    Ok(Ok(event)) => {
                        // Filter: only track .md and .markdown files, skip .glyph/ and .tmp
                        let relevant_paths: Vec<String> = event.paths.iter()
                            .filter(|p| {
                                let path_str = p.to_string_lossy().to_lowercase();
                                let ext = p.extension()
                                    .map(|e| e.to_string_lossy().to_lowercase())
                                    .unwrap_or_default();
                                // Only .md and .markdown files
                                (ext == "md" || ext == "markdown")
                                // Skip .glyph directory
                                && !path_str.contains("\\.glyph\\")
                                && !path_str.contains("/.glyph/")
                                // Skip temp files
                                && !path_str.ends_with(".tmp")
                            })
                            .map(|p| {
                                // Convert to relative path
                                p.to_string_lossy().replace('\\', "/")
                            })
                            .collect();

                        if relevant_paths.is_empty() {
                            continue;
                        }

                        for path in relevant_paths {
                            let entry = pending_changes.entry(path.clone()).or_insert(FileChangeEvent {
                                paths: Vec::new(),
                                timestamp: SystemTime::now()
                                    .duration_since(UNIX_EPOCH).unwrap().as_millis() as i64,
                            });
                            if !entry.paths.contains(&path) {
                                entry.paths.push(path);
                            }
                        }
                    }
                    Ok(Err(_)) => {}
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Timeout — check if we need to flush pending events
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        // Watcher has been dropped
                        break;
                    }
                }

                // Flush pending changes if enough time has passed
                let elapsed = SystemTime::now()
                    .duration_since(last_flush)
                    .unwrap_or_default();

                if !pending_changes.is_empty() && elapsed >= Duration::from_millis(debounce_ms) {
                    // Merge all pending changes into one event
                    let mut all_paths: Vec<String> = Vec::new();
                    let mut latest_ts: i64 = 0;
                    for event in pending_changes.values() {
                        for p in &event.paths {
                            if !all_paths.contains(p) {
                                all_paths.push(p.clone());
                            }
                        }
                        if event.timestamp > latest_ts {
                            latest_ts = event.timestamp;
                        }
                    }

                    let change_event = FileChangeEvent {
                        paths: all_paths,
                        timestamp: latest_ts,
                    };

                    let _ = app_clone.emit("fs:file-changed", change_event);
                    pending_changes.clear();
                    last_flush = SystemTime::now();
                }
            }
        });

        let mut watchers = self.watchers.lock().unwrap();
        watchers.insert(project_root.to_string(), watcher);

        Ok(())
    }

    /// Stop watching a project directory.
    pub fn stop_watching(&self, project_root: &str) -> Result<(), String> {
        let mut watchers = self.watchers.lock().unwrap();
        watchers.remove(project_root);
        Ok(())
    }
}
