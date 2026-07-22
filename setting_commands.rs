use tauri::State;
use crate::db::Database;
use crate::models::{
    CharacterCard, CreateCharacterCardInput, CreateFactionCardInput, CreateWorldRuleInput,
    DeleteCharacterCardInput, DeleteFactionCardInput, DeleteWorldRuleInput, FactionCard,
    GetCharacterCardInput, GetFactionCardInput, GetWorldRuleInput, ListCharacterCardInput,
    ListFactionCardInput, ListWorldRuleInput, UpdateCharacterCardInput, UpdateFactionCardInput,
    UpdateWorldRuleInput, WorldRule,
    // CN-MET-03
    SaveSparrowStepInput, SaveSparrowStepOutput,
    SaveProtagonistStepInput, SaveProtagonistStepOutput,
    MarkStepUsableInput, MarkStepUsableOutput,
    GenerateSparrowAiInput, GenerateSparrowAiOutput,
    GenerateTianDiRenAiInput, GenerateTianDiRenAiOutput,
    SaveTianDiRenLayerInput, SaveTianDiRenLayerOutput,
    GetSparrowModuleInput, SparrowModuleResponse,
};

// ===== WorldRule =====

#[tauri::command]
pub fn create_world_rule(
    db: State<'_, Database>,
    input: CreateWorldRuleInput,
) -> Result<WorldRule, String> {
    db.create_world_rule(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_world_rules(
    db: State<'_, Database>,
    input: ListWorldRuleInput,
) -> Result<Vec<WorldRule>, String> {
    db.list_world_rules(&input.project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_world_rule(
    db: State<'_, Database>,
    input: GetWorldRuleInput,
) -> Result<Option<WorldRule>, String> {
    db.get_world_rule(&input.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_world_rule(
    db: State<'_, Database>,
    input: UpdateWorldRuleInput,
) -> Result<WorldRule, String> {
    db.update_world_rule(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_world_rule(
    db: State<'_, Database>,
    input: DeleteWorldRuleInput,
) -> Result<(), String> {
    db.delete_world_rule(&input.id).map_err(|e| e.to_string())
}

// ===== CharacterCard =====

#[tauri::command]
pub fn create_character_card(
    db: State<'_, Database>,
    input: CreateCharacterCardInput,
) -> Result<CharacterCard, String> {
    db.create_character_card(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_character_cards(
    db: State<'_, Database>,
    input: ListCharacterCardInput,
) -> Result<Vec<CharacterCard>, String> {
    db.list_character_cards(&input.project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_character_card(
    db: State<'_, Database>,
    input: GetCharacterCardInput,
) -> Result<Option<CharacterCard>, String> {
    db.get_character_card(&input.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_character_card(
    db: State<'_, Database>,
    input: UpdateCharacterCardInput,
) -> Result<CharacterCard, String> {
    db.update_character_card(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_character_card(
    db: State<'_, Database>,
    input: DeleteCharacterCardInput,
) -> Result<(), String> {
    db.delete_character_card(&input.id).map_err(|e| e.to_string())
}

// ===== FactionCard =====

#[tauri::command]
pub fn create_faction_card(
    db: State<'_, Database>,
    input: CreateFactionCardInput,
) -> Result<FactionCard, String> {
    db.create_faction_card(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_faction_cards(
    db: State<'_, Database>,
    input: ListFactionCardInput,
) -> Result<Vec<FactionCard>, String> {
    db.list_faction_cards(&input.project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_faction_card(
    db: State<'_, Database>,
    input: GetFactionCardInput,
) -> Result<Option<FactionCard>, String> {
    db.get_faction_card(&input.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_faction_card(
    db: State<'_, Database>,
    input: UpdateFactionCardInput,
) -> Result<FactionCard, String> {
    db.update_faction_card(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_faction_card(
    db: State<'_, Database>,
    input: DeleteFactionCardInput,
) -> Result<(), String> {
    db.delete_faction_card(&input.id).map_err(|e| e.to_string())
}

// ===== CN-MET-03: Sparrow Mode 9+3 Commands =====

#[tauri::command]
pub fn save_sparrow_step(
    db: State<'_, Database>,
    input: SaveSparrowStepInput,
) -> Result<SaveSparrowStepOutput, String> {
    db.upsert_sparrow_step(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_protagonist_step(
    db: State<'_, Database>,
    input: SaveProtagonistStepInput,
) -> Result<SaveProtagonistStepOutput, String> {
    db.upsert_protagonist_step(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_step_usable(
    db: State<'_, Database>,
    input: MarkStepUsableInput,
) -> Result<MarkStepUsableOutput, String> {
    db.mark_protagonist_step_usable(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn generate_sparrow_ai(
    _db: State<'_, Database>,
    input: GenerateSparrowAiInput,
) -> Result<GenerateSparrowAiOutput, String> {
    // v2.0.2: AI generation stub — returns placeholder content
    // Full AI integration via command-router will be added in v2.2
    let placeholder = format!(
        "基于当前项目设定，{} 步骤的 AI 建议内容。请在此处编辑和补充。",
        input.step_id
    );
    Ok(GenerateSparrowAiOutput {
        project_id: input.project_id.clone(),
        step_id: input.step_id,
        suggested_content: placeholder,
    })
}

#[tauri::command]
pub fn save_tiandiren_layer(
    db: State<'_, Database>,
    input: SaveTianDiRenLayerInput,
) -> Result<SaveTianDiRenLayerOutput, String> {
    db.upsert_tiandiren_layer(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn generate_tiandiren_ai(
    _db: State<'_, Database>,
    input: GenerateTianDiRenAiInput,
) -> Result<GenerateTianDiRenAiOutput, String> {
    // v2.1.1: AI generation stub for Heaven/Earth/Human three-layer expansion
    // Full AI integration will be added in v2.2
    let placeholder = format!(
        "基于当前项目设定，关于「{}」视角的 AI 建议内容。请在此处编辑和补充。",
        match input.field.as_str() {
            "tian" => "天 — 更大的力量如何影响故事",
            "di" => "地 — 环境和社会如何塑造角色",
            "ren" => "人 — 人和人之间的关系张力",
            _ => &input.field,
        }
    );
    Ok(GenerateTianDiRenAiOutput {
        project_id: input.project_id,
        field: input.field,
        suggested_content: placeholder,
    })
}

#[tauri::command]
pub fn get_sparrow_module(
    db: State<'_, Database>,
    input: GetSparrowModuleInput,
) -> Result<SparrowModuleResponse, String> {
    db.get_sparrow_module(&input.project_id).map_err(|e| e.to_string())
}

// ===== v2.1.1 Timestamp API =====

#[tauri::command]
pub fn get_sparrow_last_saved_at(
    db: State<'_, Database>,
    input: crate::models::GetUpdatedAtInput,
) -> Result<crate::models::UpdatedAtResponse, String> {
    let updated_at = db.get_sparrow_last_saved_at(&input.project_id).map_err(|e| e.to_string())?;
    Ok(crate::models::UpdatedAtResponse { updated_at })
}
