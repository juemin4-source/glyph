use tauri::State;
use crate::db::Database;
use crate::models::{
    CreateStructureNodeInput, DeleteStructureNodeInput, GetStructureNodeInput,
    ListStructureNodeInput, StructureNode, UpdateStructureNodeInput,
};

#[tauri::command]
pub fn create_structure_node(
    db: State<'_, Database>,
    input: CreateStructureNodeInput,
) -> Result<StructureNode, String> {
    db.create_structure_node(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_structure_nodes(
    db: State<'_, Database>,
    input: ListStructureNodeInput,
) -> Result<Vec<StructureNode>, String> {
    db.list_structure_nodes(&input.project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_structure_node(
    db: State<'_, Database>,
    input: GetStructureNodeInput,
) -> Result<Option<StructureNode>, String> {
    db.get_structure_node(&input.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_structure_node(
    db: State<'_, Database>,
    input: UpdateStructureNodeInput,
) -> Result<StructureNode, String> {
    db.update_structure_node(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_structure_node(
    db: State<'_, Database>,
    input: DeleteStructureNodeInput,
) -> Result<(), String> {
    db.delete_structure_node(&input.id).map_err(|e| e.to_string())
}

// ===== CN-MET-02: Canvas 2 StructureGraph L1-L4 Commands =====

#[tauri::command]
pub fn save_structure_node(
    db: State<'_, Database>,
    input: crate::models::SaveCanvas2NodeInput,
) -> Result<crate::models::Canvas2NodeRecord, String> {
    db.save_canvas2_node(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_structure_tree(
    db: State<'_, Database>,
    input: crate::models::GetStructureTreeInput,
) -> Result<crate::models::StructureTreeOutput, String> {
    db.get_canvas2_structure_tree(&input.project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_node_position(
    db: State<'_, Database>,
    input: crate::models::UpdateNodePositionInput,
) -> Result<(), String> {
    db.update_canvas2_node_position(&input).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn zoom_to_layer(
    db: State<'_, Database>,
    input: crate::models::ZoomToLayerInput,
) -> Result<crate::models::ZoomToLayerOutput, String> {
    let nodes = db.get_canvas2_nodes_by_layer(&input.project_id, &input.layer_type)
        .map_err(|e| e.to_string())?;
    Ok(crate::models::ZoomToLayerOutput { nodes })
}

#[tauri::command]
pub fn delete_canvas2_node(
    db: State<'_, Database>,
    input: crate::models::DeleteCanvas2NodeInput,
) -> Result<(), String> {
    db.delete_canvas2_node(&input.id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ai_generate_structure(
    db: State<'_, Database>,
    input: crate::models::AiGenerateStructureInput,
) -> Result<crate::models::AiGenerateStructureOutput, String> {
    // Check if structure already exists (has book node)
    let existing = db.list_canvas2_nodes(&input.project_id)
        .map_err(|e| e.to_string())?;
    let has_book = existing.iter().any(|n| n.layer_type == "book");

    if has_book && existing.len() >= 4 {
        return Ok(crate::models::AiGenerateStructureOutput {
            nodes: existing,
            success: true,
            message: "Structure already exists".to_string(),
        });
    }

    // Generate default L1-L4 structure
    let now = chrono::Utc::now().timestamp_millis();
    let mut created_nodes = Vec::new();

    // If no nodes exist, create a default structure
    if existing.is_empty() {
        // L1: Book node
        let book_id = uuid::Uuid::new_v4().to_string();
        // Get premise to set book title
        let premise_title = get_project_premise_title(&db, &input.project_id).unwrap_or_else(|_| "未命名作品".to_string());

        // Insert directly via conn
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO canvas2_structure_nodes (id, project_id, parent_id, layer_type, title, summary, time_period, chapter_range, scene_count, word_count, position_x, position_y, expanded, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, NULL, 'book', ?3, '', '', '', 0, 0, 400.0, 50.0, 1, 0, ?4, ?4)",
                rusqlite::params![book_id, input.project_id, premise_title, now],
            ).map_err(|e| e.to_string())?;
        }

        created_nodes.push(crate::models::Canvas2NodeRecord {
            id: book_id.clone(),
            project_id: input.project_id.clone(),
            parent_id: None,
            layer_type: "book".to_string(),
            title: premise_title,
            summary: String::new(),
            time_period: String::new(),
            chapter_range: String::new(),
            scene_count: 0,
            word_count: 0,
            position_x: 400.0,
            position_y: 50.0,
            expanded: true,
            sort_order: 0,
            created_at: now,
            updated_at: now,
        });

        // L2: Shiwei nodes (3 default)
        let shiwei_names = ["开端", "发展", "高潮"];
        for (i, name) in shiwei_names.iter().enumerate() {
            let shiwei_id = uuid::Uuid::new_v4().to_string();
            let pos_y = 250.0 + i as f64 * 200.0;
            {
                let conn = db.conn.lock().unwrap();
                conn.execute(
                    "INSERT INTO canvas2_structure_nodes (id, project_id, parent_id, layer_type, title, summary, time_period, chapter_range, scene_count, word_count, position_x, position_y, expanded, sort_order, created_at, updated_at)
                     VALUES (?1, ?2, ?3, 'shiwei', ?4, '', '', '', 0, 0, 400.0, ?5, 1, ?6, ?7, ?7)",
                    rusqlite::params![shiwei_id, input.project_id, book_id, name, pos_y, i as i64, now],
                ).map_err(|e| e.to_string())?;
            }
            created_nodes.push(crate::models::Canvas2NodeRecord {
                id: shiwei_id.clone(),
                project_id: input.project_id.clone(),
                parent_id: Some(book_id.clone()),
                layer_type: "shiwei".to_string(),
                title: name.to_string(),
                summary: String::new(),
                time_period: String::new(),
                chapter_range: String::new(),
                scene_count: 0,
                word_count: 0,
                position_x: 400.0,
                position_y: pos_y,
                expanded: true,
                sort_order: i as i64,
                created_at: now,
                updated_at: now,
            });
        }
    }

    let all_nodes = db.list_canvas2_nodes(&input.project_id).map_err(|e| e.to_string())?;
    Ok(crate::models::AiGenerateStructureOutput {
        nodes: all_nodes,
        success: true,
        message: format!("Generated {} nodes", created_nodes.len()),
    })
}

/// Helper to get the premise title for a project
fn get_project_premise_title(db: &Database, project_id: &str) -> Result<String, String> {
    use rusqlite::params;
    let conn = db.conn.lock().unwrap();
    let result: Result<String, _> = conn.query_row(
        "SELECT premise_text FROM premise_cards WHERE project_id = ?",
        params![project_id],
        |row| row.get(0),
    );
    match result {
        Ok(text) => {
            // Take first line or first 30 chars as title
            let title = text.lines().next().unwrap_or(&text);
            let title = title.trim();
            if title.len() > 30 {
                Ok(format!("{}...", &title[..30]))
            } else if title.is_empty() {
                Ok("未命名作品".to_string())
            } else {
                Ok(title.to_string())
            }
        }
        Err(_) => Ok("未命名作品".to_string()),
    }
}

// ===== v2.1.1 Timestamp API =====

#[tauri::command]
pub fn get_structure_updated_at(
    db: State<'_, Database>,
    input: crate::models::GetUpdatedAtInput,
) -> Result<crate::models::UpdatedAtResponse, String> {
    let updated_at = db.get_structure_updated_at(&input.project_id).map_err(|e| e.to_string())?;
    Ok(crate::models::UpdatedAtResponse { updated_at })
}
