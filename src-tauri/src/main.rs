// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.len() > 1 && args[1] == "--api-only" {
        // Start just the HTTP API without Tauri window
        glyph_lib::run_api_only();
    } else {
        glyph_lib::run();
    }
}
