use tauri::State;
use crate::db::Database;
use crate::models::{GetPipelineStateInput, PipelineState, SavePipelineStateInput};

#[tauri::command]
pub fn get_pipeline_state(
    db: State<'_, Database>,
    input: GetPipelineStateInput,
) -> Result<PipelineState, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    crate::db::get_or_default_pipeline_state(&conn, &input.project_id)
}

#[tauri::command]
pub fn save_pipeline_state(
    db: State<'_, Database>,
    input: SavePipelineStateInput,
) -> Result<PipelineState, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    crate::db::save_pipeline_state(&conn, &input.state)
}
