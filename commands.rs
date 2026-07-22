use std::io::{Read, Write};
use tauri::State;
use crate::db::Database;
use crate::models::*;

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?//  Project Commands
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
#[tauri::command]
pub fn list_projects(db: State<'_, Database>) -> Result<Vec<Project>, String> {
    db.list_projects().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_project(db: State<'_, Database>, id: String) -> Result<Option<Project>, String> {
    db.get_project(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_project(
    db: State<'_, Database>,
    name: String,
    genre: String,
    status: String,
    word_count: i64,
    gradient: String,
) -> Result<Project, String> {
    db.create_project(&name, &genre, &status, word_count, &gradient)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_project(db: State<'_, Database>, project: Project) -> Result<(), String> {
    db.update_project(&project).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_project(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_project(&id).map_err(|e| e.to_string())
}

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?//  WorldObject Commands
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
#[tauri::command]
pub fn list_world_objects(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<WorldObject>, String> {
    db.list_world_objects(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_world_object(
    db: State<'_, Database>,
    id: String,
) -> Result<Option<WorldObject>, String> {
    db.get_world_object(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_world_object(
    db: State<'_, Database>,
    object: WorldObject,
) -> Result<WorldObject, String> {
    db.create_world_object(&object).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_world_object(
    db: State<'_, Database>,
    object: WorldObject,
) -> Result<(), String> {
    db.update_world_object(&object).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_world_object(
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    db.delete_world_object(&id).map_err(|e| e.to_string())
}

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?//  JudgmentRecord Commands
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
#[tauri::command]
pub fn list_judgment_records(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<JudgmentRecord>, String> {
    db.list_judgment_records(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn append_judgment_record(
    db: State<'_, Database>,
    record: JudgmentRecord,
) -> Result<JudgmentRecord, String> {
    db.append_judgment_record(&record).map_err(|e| e.to_string())
}

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?//  Connection Commands
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
#[tauri::command]
pub fn list_connections(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<Connection>, String> {
    db.list_connections(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_connection(
    db: State<'_, Database>,
    connection: Connection,
) -> Result<Connection, String> {
    db.create_connection(&connection).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_connection(
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    db.delete_connection(&id).map_err(|e| e.to_string())
}

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?//  CanvasTabState Commands
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
#[tauri::command]
pub fn list_canvas_tab_states(
    db: State<'_, Database>,
    project_id: String,
) -> Result<Vec<CanvasTabState>, String> {
    db.list_canvas_tab_states(&project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_canvas_tab_state(
    db: State<'_, Database>,
    state: CanvasTabStateVersioned,
) -> Result<SaveCanvasTabStateResponse, String> {
    let canvas_state = CanvasTabState {
        id: state.id,
        project_id: state.project_id,
        tab_id: state.tab_id,
        positions: state.positions,
        sticky_notes: state.sticky_notes,
        connections: state.connections,
        scale: state.scale,
        pan_x: state.pan_x,
        pan_y: state.pan_y,
        created_at: state.created_at,
        updated_at: state.updated_at,
    };
    db.save_canvas_tab_state(&canvas_state, state.version)
}

#[tauri::command]
pub fn delete_canvas_tab_state(
    db: State<'_, Database>,
    id: String,
) -> Result<(), String> {
    db.delete_canvas_tab_state(&id).map_err(|e| e.to_string())
}

// ═══════════════════════════════════════════
//  P0-02: Ping (health check)
// ═══════════════════════════════════════════

#[tauri::command]
pub fn ping() -> Result<String, String> {
    Ok("pong".to_string())
}

// ═══════════════════════════════════════════
//  P0-05: Export / Import
// ═══════════════════════════════════════════

#[tauri::command]
pub fn export_project(
    db: State<'_, Database>,
    project_id: String,
    output_path: String,
) -> Result<ExportResult, String> {
    // Read all project data
    let data = db.export_project_data(&project_id)?;

    // Create zip archive
    let file = std::fs::File::create(&output_path)
        .map_err(|e| format!("IO_ERROR: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);

    // Write project.json
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("IO_ERROR: {}", e))?;
    zip.start_file("project.json", zip::write::FileOptions::<()>::default())
        .map_err(|e| format!("IO_ERROR: {}", e))?;
    zip.write_all(json.as_bytes())
        .map_err(|e| format!("IO_ERROR: {}", e))?;

    // Write per-object .md files
    for obj in &data.objects {
        let filename = format!("objects/{}.md", obj.id);
        zip.start_file(&filename, zip::write::FileOptions::<()>::default())
            .map_err(|e| format!("IO_ERROR: {}", e))?;
        zip.write_all(obj.content.as_bytes())
            .map_err(|e| format!("IO_ERROR: {}", e))?;
    }

    zip.finish().map_err(|e| format!("IO_ERROR: {}", e))?;

    Ok(ExportResult {
        success: true,
        path: output_path,
        object_count: data.objects.len(),
        connection_count: data.connections.len(),
    })
}

#[tauri::command]
pub fn import_project(
    db: State<'_, Database>,
    input_path: String,
) -> Result<ImportResult, String> {
    let path = std::path::Path::new(&input_path);

    if path.is_dir() {
        // Import plain markdown directory
        db.import_markdown_directory(&input_path)
    } else if path.is_file() {
        // Import .zhimengji zip
        let file = std::fs::File::open(&input_path)
            .map_err(|e| format!("NOT_FOUND: {}", e))?;
        let mut archive = zip::ZipArchive::new(file)
            .map_err(|e| format!("IO_ERROR: invalid zip: {}", e))?;

        // Read project.json from zip
        let mut project_json = String::new();
        archive
            .by_name("project.json")
            .map_err(|e| format!("IO_ERROR: invalid format: {}", e))?
            .read_to_string(&mut project_json)
            .map_err(|e| format!("IO_ERROR: {}", e))?;

        let export_data: ProjectExportData = serde_json::from_str(&project_json)
            .map_err(|e| format!("IO_ERROR: invalid format: {}", e))?;

        db.import_project_data(&export_data)
    } else {
        Err(format!("NOT_FOUND: path does not exist: {}", input_path))
    }
}
