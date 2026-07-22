use crate::models::ExportInput;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub fn export_text_as_markdown(
    app: tauri::AppHandle,
    input: ExportInput,
) -> Result<String, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md"])
        .set_file_name(&input.default_name)
        .blocking_save_file()
        .ok_or_else(|| "CANCELLED: user cancelled file dialog".to_string())?;

    // Get the path string representation from FilePath
    let path_str = file_path.to_string();
    let path = std::path::Path::new(&path_str);

    std::fs::write(path, &input.chapter_content)
        .map_err(|e| format!("IO_ERROR: {}", e))?;

    Ok(path_str)
}
