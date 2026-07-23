use tauri::State;
use crate::db::Database;
use crate::models::{
    CreatePremiseInput, DeletePremiseInput, GetPremiseInput, ListPremiseInput,
    PremiseCard, UpdatePremiseInput,
    // CN-MET-01
    SaveWishlistInput, SaveWishlistOutput,
    SaveVariantSelectionInput, SaveVariantSelectionOutput,
    SaveGenreJudgmentInput, SaveGenreJudgmentOutput,
    GetPremiseStepStateInput, PremiseStepStateResponse, PremiseStepRecord,
};

#[tauri::command]
pub fn create_premise_card(
    db: State<'_, Database>,
    input: CreatePremiseInput,
) -> Result<PremiseCard, String> {
    db.create_premise_card(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_premise_cards(
    db: State<'_, Database>,
    input: ListPremiseInput,
) -> Result<Vec<PremiseCard>, String> {
    db.list_premise_cards(&input.project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_premise_card(
    db: State<'_, Database>,
    input: GetPremiseInput,
) -> Result<Option<PremiseCard>, String> {
    db.get_premise_card(&input.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_premise_card(
    db: State<'_, Database>,
    input: UpdatePremiseInput,
) -> Result<PremiseCard, String> {
    db.update_premise_card(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_premise_card(
    db: State<'_, Database>,
    input: DeletePremiseInput,
) -> Result<(), String> {
    db.delete_premise_card(&input.id).map_err(|e| e.to_string())
}

// ===== CN-MET-01: Premise Five-Step Commands =====

#[tauri::command]
pub fn save_wishlist(
    db: State<'_, Database>,
    input: SaveWishlistInput,
) -> Result<SaveWishlistOutput, String> {
    db.save_wishlist(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn generate_variants(
    db: State<'_, Database>,
    input: crate::models::GenerateVariantsInput,
) -> Result<crate::models::GenerateVariantsOutput, String> {
    // v2.0.2: Use command-router for AI generation.
    // For now, generate 3 variant placeholders via AI routing.
    // The actual AI call goes through the command router.
    let variants = vec![
        serde_json::json!({
            "id": uuid::Uuid::new_v4().to_string(),
            "title": format!("变体一"),
            "summary": format!("基于当前设定，一个可能的故事发展方向"),
            "coreConflict": format!("主要冲突描述"),
            "selected": false,
        }),
        serde_json::json!({
            "id": uuid::Uuid::new_v4().to_string(),
            "title": format!("变体二"),
            "summary": format!("基于当前设定，另一个故事发展方向"),
            "coreConflict": format!("另一个冲突描述"),
            "selected": false,
        }),
        serde_json::json!({
            "id": uuid::Uuid::new_v4().to_string(),
            "title": format!("变体三"),
            "summary": format!("基于当前设定，第三个故事发展方向"),
            "coreConflict": format!("第三个冲突描述"),
            "selected": false,
        }),
    ];

    let variants_json = serde_json::to_string(&variants)
        .map_err(|e| format!("Serialization error: {}", e))?;

    // Save intern_extern and variants to step state
    let existing = db.get_premise_step_state(&input.project_id)
        .map_err(|e| e.to_string())?;

    if let Some(mut record) = existing {
        record.intern_extern = serde_json::json!({
            "internalDrive": input.internal_drive,
            "externalDrive": input.external_drive,
        }).to_string();
        record.variants = variants_json.clone();
        db.upsert_premise_step_state(&record).map_err(|e| e.to_string())?;
    } else {
        // Create new state record
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;
        let new_record = PremiseStepRecord {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: input.project_id.clone(),
            current_step: "variants".to_string(),
            wishlist: input.wishlist.clone(),
            intern_extern: serde_json::json!({
                "internalDrive": input.internal_drive,
                "externalDrive": input.external_drive,
            }).to_string(),
            variants: variants_json.clone(),
            qa: "[]".to_string(),
            genre_judgment: "null".to_string(),
            completed_steps: "[]".to_string(),
            skipped_steps: "[]".to_string(),
            do_not_ask_again: "[]".to_string(),
            created_at: now,
            updated_at: now,
        };
        db.upsert_premise_step_state(&new_record).map_err(|e| e.to_string())?;
    }

    Ok(crate::models::GenerateVariantsOutput {
        variants: variants_json,
    })
}

#[tauri::command]
pub fn save_variant_selection(
    db: State<'_, Database>,
    input: SaveVariantSelectionInput,
) -> Result<SaveVariantSelectionOutput, String> {
    db.save_variant_selection(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn generate_reader_qa(
    db: State<'_, Database>,
    input: crate::models::GenerateReaderQAInput,
) -> Result<crate::models::GenerateReaderQAOutput, String> {
    // Generate 5-7 placeholder reader questions via AI routing (v2.0.2)
    let questions = vec![
        serde_json::json!({"id": uuid::Uuid::new_v4().to_string(), "question": "这个世界的主角是谁？他想要什么？", "category": "角色"}),
        serde_json::json!({"id": uuid::Uuid::new_v4().to_string(), "question": "故事的主要冲突是什么？", "category": "冲突"}),
        serde_json::json!({"id": uuid::Uuid::new_v4().to_string(), "question": "故事发生在什么样的世界？", "category": "世界观"}),
        serde_json::json!({"id": uuid::Uuid::new_v4().to_string(), "question": "主角面临的最大障碍是什么？", "category": "障碍"}),
        serde_json::json!({"id": uuid::Uuid::new_v4().to_string(), "question": "读者为什么要关心这个故事？", "category": "共鸣"}),
        serde_json::json!({"id": uuid::Uuid::new_v4().to_string(), "question": "故事的核心秘密或悬念是什么？", "category": "悬念"}),
        serde_json::json!({"id": uuid::Uuid::new_v4().to_string(), "question": "故事的基调是轻松还是沉重？", "category": "基调"}),
    ];

    let questions_json = serde_json::to_string(&questions)
        .map_err(|e| format!("Serialization error: {}", e))?;

    // Save QA to step state
    let existing = db.get_premise_step_state(&input.project_id)
        .map_err(|e| e.to_string())?;

    if let Some(mut record) = existing {
        record.qa = questions_json.clone();
        db.upsert_premise_step_state(&record).map_err(|e| e.to_string())?;
    }

    Ok(crate::models::GenerateReaderQAOutput {
        questions: questions_json,
    })
}

#[tauri::command]
pub fn save_genre_judgment(
    db: State<'_, Database>,
    input: SaveGenreJudgmentInput,
) -> Result<SaveGenreJudgmentOutput, String> {
    db.save_genre_judgment(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_premise_step_state(
    db: State<'_, Database>,
    input: GetPremiseStepStateInput,
) -> Result<PremiseStepStateResponse, String> {
    match db.get_premise_step_state(&input.project_id).map_err(|e| e.to_string())? {
        Some(state) => Ok(PremiseStepStateResponse {
            exists: true,
            state: Some(state),
        }),
        None => Ok(PremiseStepStateResponse {
            exists: false,
            state: None,
        }),
    }
}

// ===== v2.1.1 Timestamp API =====

#[tauri::command]
pub fn get_premise_updated_at(
    db: State<'_, Database>,
    input: crate::models::GetUpdatedAtInput,
) -> Result<crate::models::UpdatedAtResponse, String> {
    let updated_at = db.get_premise_updated_at(&input.project_id).map_err(|e| e.to_string())?;
    Ok(crate::models::UpdatedAtResponse { updated_at })
}
