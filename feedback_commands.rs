use crate::{db::Database, models::*};
use tauri::State;

#[tauri::command]
pub fn submit_feedback(
    database: State<'_, Database>,
    input: FeedbackInput,
) -> Result<DecisionLogEntry, String> {
    database
        .submit_feedback(&input)
        .map_err(|e| format!("DB_ERROR: {}", e))
}

#[tauri::command]
pub fn list_feedback(
    database: State<'_, Database>,
    input: ListFeedbackInput,
) -> Result<Vec<DecisionLogEntry>, String> {
    database
        .list_decision_logs(&input.project_id)
        .map_err(|e| format!("DB_ERROR: {}", e))
        .map(|logs| {
            logs.into_iter()
                .filter(|log| log.operation == "feedback")
                .collect()
        })
}
