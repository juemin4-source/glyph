use tauri::State;
use crate::db::Database;
use crate::models::{
    DecisionLogEntry, AppendDecisionLogInput, ListDecisionLogsInput, GetDecisionLogInput,
};

#[tauri::command]
pub fn append_decision_log(
    db: State<'_, Database>,
    input: AppendDecisionLogInput,
) -> Result<DecisionLogEntry, String> {
    db.append_decision_log(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_decision_logs(
    db: State<'_, Database>,
    input: ListDecisionLogsInput,
) -> Result<Vec<DecisionLogEntry>, String> {
    db.list_decision_logs(&input.project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_decision_log(
    db: State<'_, Database>,
    input: GetDecisionLogInput,
) -> Result<Option<DecisionLogEntry>, String> {
    db.get_decision_log(&input.id).map_err(|e| e.to_string())
}
