use crate::{db::Database, models::*};
use tauri::State;

#[tauri::command]
pub async fn quickdraft_generate(
    database: State<'_, Database>,
    input: QuickDraftInput,
) -> Result<QuickDraftGenerateResult, String> {
    // Generate premise text and chapters from user input.
    // T1: produce a default premise/chapter based on user_input.
    // T2: replace with real AI generation via call_llm / BYOK infra.

    let premise_text = format!("Quick draft: {}", input.user_input);
    let premise_type = "quick_draft".to_string();

    let chapters = serde_json::json!([{
        "title": "构思草稿",
        "content": input.user_input
    }])
    .to_string();

    let draft = database
        .create_quick_draft(&input, &premise_text, &premise_type, &chapters)
        .map_err(|e| format!("DB_ERROR: {}", e))?;

    let preview_content = input.user_input.clone();

    Ok(QuickDraftGenerateResult {
        draft,
        preview_title: "构思草稿".to_string(),
        preview_content,
    })
}

#[tauri::command]
pub fn quickdraft_transfer(
    database: State<'_, Database>,
    input: QuickDraftTransferInput,
) -> Result<QuickDraftApi, String> {
    // 1. Load the draft (validate existence)
    let _draft = database
        .get_quick_draft(&input.draft_id)
        .map_err(|e| format!("DB_ERROR: {}", e))?
        .ok_or_else(|| "NOT_FOUND: draft not found".to_string())?;

    // 2. Mark draft as transferred (UI caller will create premise_card etc.)
    database
        .transfer_quick_draft(&input.draft_id)
        .map_err(|e| format!("DB_ERROR: {}", e))
}

#[tauri::command]
pub fn quickdraft_list_by_project(
    database: State<'_, Database>,
    input: ListQuickDraftsInput,
) -> Result<Vec<QuickDraftApi>, String> {
    database
        .list_quick_drafts_by_project(&input.project_id)
        .map_err(|e| format!("DB_ERROR: {}", e))
}

#[tauri::command]
pub fn quickdraft_get(
    database: State<'_, Database>,
    input: GetQuickDraftInput,
) -> Result<Option<QuickDraftApi>, String> {
    database
        .get_quick_draft(&input.id)
        .map_err(|e| format!("DB_ERROR: {}", e))
}

#[tauri::command]
pub fn quickdraft_delete(
    database: State<'_, Database>,
    input: DeleteQuickDraftInput,
) -> Result<(), String> {
    database
        .delete_quick_draft(&input.id)
        .map_err(|e| format!("DB_ERROR: {}", e))
}
