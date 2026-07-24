mod ai;
mod ai_commands;
mod api;
mod chapter_packet_commands;
mod commands;
mod db;
mod decision_log_commands;
mod fs_commands;
mod fs_models;
mod fs_watcher;
mod models;
mod pipeline_commands;
mod premise_commands;
mod setting_commands;
mod structure_commands;
mod quick_draft_commands;
mod export_commands;
mod feedback_commands;

use db::Database;
use fs_watcher::FileWatcher;
use std::fs;
use tauri::Manager;

/// Start just the HTTP API server without the Tauri GUI window.
/// Use `glyph --api-only` to run in this mode.
pub fn run_api_only() {
    let db_path = std::env::var("GLYPH_DB_PATH")
        .unwrap_or_else(|_| "glyph-api.db".to_string());
    let database = Database::new(&db_path)
        .expect("Failed to initialize database");
    eprintln!("[glyph-api] DB: {} (--api-only mode)", db_path);
    api::start_api_server(database.clone());
    eprintln!("[glyph-api] Server started on http://127.0.0.1:21778");
    eprintln!("[glyph-api] Press Ctrl+C to stop");
    // Block forever
    loop {
        std::thread::sleep(std::time::Duration::from_secs(3600));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
            let db_path = app_data_dir.join("glyph.db");
            let database = Database::new(db_path.to_str().expect("Invalid db path"))
                .expect("Failed to initialize database");

            // Auto-seed Ollama provider if no providers exist
            {
                let existing = database.list_ai_provider_configs().unwrap_or_default();
                if existing.is_empty() {
                    let seed = crate::models::SaveProviderConfigInput {
                        provider_id: "ollama".to_string(),
                        provider_name: "Ollama".to_string(),
                        api_key_encrypted: String::new(),
                        endpoint: "http://localhost:11434/v1".to_string(),
                        models: vec!["qwen3:8b".to_string()],
                        timeout_ms: 30000,
                        clear_api_key: false,
                    };
                    if let Err(e) = database.save_ai_provider_config(&seed) {
                        eprintln!("[seed] Failed to create Ollama provider: {}", e);
                    } else {
                        eprintln!("[seed] Ollama provider auto-configured");
                    }
                }
            }

            #[cfg(debug_assertions)]
            api::start_api_server(database.clone());

            app.manage(database);
            app.manage(FileWatcher::new());
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Project
            commands::list_projects,
            commands::get_project,
            commands::create_project,
            commands::update_project,
            commands::delete_project,
            // WorldObject
            commands::list_world_objects,
            commands::get_world_object,
            commands::create_world_object,
            commands::update_world_object,
            commands::delete_world_object,
            // [glyph-v0.1] Outline drag-reorder
            commands::reorder_outline,
            // JudgmentRecord
            commands::list_judgment_records,
            commands::append_judgment_record,
            // Connection
            commands::list_connections,
            commands::create_connection,
            commands::delete_connection,
            // CanvasTabState
            commands::list_canvas_tab_states,
            commands::save_canvas_tab_state,
            commands::delete_canvas_tab_state,
            // v1.2 commands
            commands::ping,
            commands::export_project,
            commands::import_project,
            // v2 PipelineState commands
            pipeline_commands::get_pipeline_state,
            pipeline_commands::save_pipeline_state,
            // v2 PremiseCard commands
            premise_commands::create_premise_card,
            premise_commands::list_premise_cards,
            premise_commands::get_premise_card,
            premise_commands::update_premise_card,
            premise_commands::delete_premise_card,
            // v2.1.0 CN-MET-01 Premise Five-Step commands
            premise_commands::save_wishlist,
            premise_commands::generate_variants,
            premise_commands::save_variant_selection,
            premise_commands::generate_reader_qa,
            premise_commands::save_genre_judgment,
            premise_commands::get_premise_step_state,
            // v2 StructureNode commands
            structure_commands::create_structure_node,
            structure_commands::list_structure_nodes,
            structure_commands::get_structure_node,
            structure_commands::update_structure_node,
            structure_commands::delete_structure_node,
            // v2.1.0 CN-MET-02 Canvas 2 StructureGraph L1-L4 commands
            structure_commands::save_structure_node,
            structure_commands::get_structure_tree,
            structure_commands::update_node_position,
            structure_commands::zoom_to_layer,
            structure_commands::delete_canvas2_node,
            structure_commands::ai_generate_structure,
            // v2 WorldRule commands
            setting_commands::create_world_rule,
            setting_commands::list_world_rules,
            setting_commands::get_world_rule,
            setting_commands::update_world_rule,
            setting_commands::delete_world_rule,
            // v2 CharacterCard commands
            setting_commands::create_character_card,
            setting_commands::list_character_cards,
            setting_commands::get_character_card,
            setting_commands::update_character_card,
            setting_commands::delete_character_card,
            // v2 FactionCard commands
            setting_commands::create_faction_card,
            setting_commands::list_faction_cards,
            setting_commands::get_faction_card,
            setting_commands::update_faction_card,
            setting_commands::delete_faction_card,
            // v2.1.0 CN-MET-03 Sparrow Mode 9+3 commands
            setting_commands::save_sparrow_step,
            setting_commands::save_protagonist_step,
            setting_commands::mark_step_usable,
            setting_commands::generate_sparrow_ai,
            setting_commands::save_tiandiren_layer,
            setting_commands::get_sparrow_module,
            // v2.1.1 CN-MET-03 Tian-Di-Ren AI generation
            setting_commands::generate_tiandiren_ai,
            // v2.1.1 Timestamp API
            premise_commands::get_premise_updated_at,
            structure_commands::get_structure_updated_at,
            setting_commands::get_sparrow_last_saved_at,
            chapter_packet_commands::get_packets_updated_at,
            // v2 ChapterPacket commands
            chapter_packet_commands::create_chapter_packet,
            chapter_packet_commands::list_chapter_packets,
            chapter_packet_commands::get_chapter_packet,
            chapter_packet_commands::update_chapter_packet_layers,
            chapter_packet_commands::confirm_chapter_packet,
            chapter_packet_commands::delete_chapter_packet,
            // v2.1.0 CN-MET-04 ChapterPacket detail mode commands
            chapter_packet_commands::set_detail_mode,
            chapter_packet_commands::get_packet_detail,
            chapter_packet_commands::auto_generate_sketch,
            chapter_packet_commands::save_refined_content,
            // v2 DecisionLog commands
            decision_log_commands::append_decision_log,
            decision_log_commands::list_decision_logs,
            decision_log_commands::get_decision_log,
            // v2.0.1 QuickDraft commands
            quick_draft_commands::quickdraft_generate,
            quick_draft_commands::quickdraft_transfer,
            quick_draft_commands::quickdraft_list_by_project,
            quick_draft_commands::quickdraft_get,
            quick_draft_commands::quickdraft_delete,
            // v2.0.1 Export commands
            export_commands::export_text_as_markdown,
            // v2.0.1 Feedback commands
            feedback_commands::submit_feedback,
            feedback_commands::list_feedback,
            // v2 AI commands (provider management only)
            ai_commands::list_providers_v2,
            ai_commands::save_provider_config,
            ai_commands::delete_provider_config,
            ai_commands::resolve_provider_credential,
            ai_commands::test_provider_connection,
            // Gate A: Filesystem commands
            fs_commands::create_fs_project,
            fs_commands::open_fs_project,
            fs_commands::list_fs_projects,
            fs_commands::remove_fs_project,
            fs_commands::list_directory,
            fs_commands::read_file,
            fs_commands::read_file_state,
            // Gate B: Content search
            fs_commands::search_file_content,
            fs_commands::write_file,
            fs_commands::write_file_checked,
            fs_commands::commit_ai_file_action,
            fs_commands::create_text_file,
            fs_commands::create_file,
            fs_commands::create_directory,
            fs_commands::rename_file,
            fs_commands::delete_file,
            fs_commands::delete_directory,
            fs_commands::get_session_state,
            fs_commands::save_session_state,
            fs_commands::watch_project,
            fs_commands::unwatch_project,
            fs_commands::export_to_fs_project,
            // Gate D: Action history, revert, provenance
            fs_commands::list_ai_actions,
            fs_commands::get_ai_action,
            fs_commands::revert_ai_action,
            fs_commands::list_file_provenance,
            fs_commands::save_file_provenance,
            fs_commands::startup_recovery_scan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
