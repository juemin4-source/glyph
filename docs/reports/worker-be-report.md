# Worker-BE Report — Zhimengji v1.2 Backend (P0-02, P0-04, P0-05)

## Contract Status

| Contract | Status | Notes |
|----------|--------|-------|
| P0-02 (ping) | PASS | Tauri `ping` command returns `"pong"` |
| P0-04 (version stamp) | PASS | `save_canvas_tab_state` validates version; rejects with `VERSION_CONFLICT` |
| P0-05 (import/export) | PASS | `.zhimengji` zip export/import + Markdown directory import with WikiLink parsing |

## Files Modified

### `src-tauri/Cargo.toml`
- Added `zip = "2"` crate dependency for zip archive support

### `src-tauri/src/models.rs`
- Added `CanvasTabStateVersioned` — input struct with `version` field for P0-04
- Added `SaveCanvasTabStateResponse` — response with `accepted`, `currentVersion`, and `state`
- Added `ExportResult` — return type for `export_project` command
- Added `ImportResult` — return type for `import_project` command
- Added `ProjectExportData` — full project data serialized into `project.json` in `.zhimengji` zip

### `src-tauri/src/db.rs`
- **Schema migration**: Added `version` column to `canvas_tab_states` table (ALTER TABLE, safe to re-run)
- **`save_canvas_tab_state`**: Now accepts `version: i64`, validates incoming version >= stored version, returns `SaveCanvasTabStateResponse`. Returns `VERSION_CONFLICT` error on stale writes with the current backend version included in the error message
- **`export_project_data`**: Reads full project (project metadata + all objects + all connections + all canvas states) for zip packaging
- **`import_project_data`**: Creates a new project from `ProjectExportData`, regenerates all UUIDs to avoid conflicts, upserts objects/connections/canvas states under the new project
- **`import_markdown_directory`**: Scans `.md` files in a directory, creates WorldObjects from filenames (object name = filename stem, type default `"术语"`), parses `[[WikiLink]]` patterns to auto-create `Connection` records. Uses two-pass approach: first create all objects, then resolve links
- **`parse_wiki_links`**: Free function that extracts referenced object names from `[[name]]` and `[[name|display]]` patterns using string search (no regex dependency)

### `src-tauri/src/commands.rs`
- **`ping`**: Returns `Ok("pong")` — health check for frontend SyncManager (P0-02)
- **`save_canvas_tab_state`**: Updated to accept `CanvasTabStateVersioned` and delegate to version-aware DB function
- **`export_project`**: Reads project data via `db.export_project_data()`, creates `.zhimengji` zip containing `project.json` + per-object `.md` files, writes to `outputPath`
- **`import_project`**: Detects whether input is directory (markdown import) or file (`.zhimengji` zip import), delegates to appropriate DB function

### `src-tauri/src/lib.rs`
- Registered `commands::ping`, `commands::export_project`, `commands::import_project` in invoke_handler

## ZIP Structure (`.zhimengji`)

```
project.json          # JSON: project metadata + objects + connections + canvas states
objects/
  <uuid>.md           # One .md file per WorldObject containing its content
```

## Error Code Convention

All commands use the prefix convention:
- `VERSION_CONFLICT: ...` — version stamp conflict (P0-04)
- `NOT_FOUND: ...` — project/path not found (P0-05)
- `IO_ERROR: ...` — file I/O / zip / format errors (P0-05)
- `DB_ERROR: ...` — database operation failure (P0-04)

## Tests

8 tests pass (all existing + new):
- `test_parse_wiki_links` — unit tests for WikiLink parsing
- `test_export_import_roundtrip` — export a project with objects+connections, import, verify counts
- All 6 pre-existing tests continue to pass (including version-aware canvas state test with conflict detection)

## Known Items

- Pre-existing test bug fixed: `test_world_object_crud` asserted `status == "locked"` after `update_world_object` set status to `"draft"` — corrected to `"draft"`
- `save_canvas_tab_state` now returns `Result<SaveCanvasTabStateResponse, String>` instead of `SqlResult<CanvasTabState>` — frontend `tauri-api.ts` wrapper should be updated accordingly
- `import_markdown_directory` uses `HashMap` for name-to-ID resolution; duplicate names in the same directory will cause the last duplicate to overwrite earlier entries in the map
