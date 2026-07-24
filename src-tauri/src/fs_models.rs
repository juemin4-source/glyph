use serde::{Deserialize, Serialize};

/// A filesystem project — maps a real directory to a Glyph project.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsProject {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub genre: String,
    pub created_at: i64,
    pub last_opened_at: i64,
    pub updated_at: i64,
}

/// Input for create_fs_project command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFsProjectInput {
    pub name: String,
    pub root_path: String,
    pub genre: Option<String>,
}

/// Directory entry returned by list_directory
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    /// Path relative to project root
    pub path: String,
    pub is_dir: bool,
    pub extension: String,
    pub size: i64,
    pub modified_at: i64,
}

/// Session state persisted in .glyph/session.json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub last_open_file_path: Option<String>,
    pub last_cursor_line: Option<i64>,
    pub last_cursor_column: Option<i64>,
    pub last_scroll_position: Option<i64>,
    pub open_file_paths: Vec<String>,
    pub sidebar_width: Option<f64>,
    pub focus_mode: Option<bool>,
    pub last_edit_mode: Option<String>,
    pub last_session_at: i64,
}

/// File system path input (common pattern)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsPathInput {
    pub path: String,
    pub project_root: String,
}

/// File system rename input
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsRenameInput {
    pub old_path: String,
    pub new_path: String,
    pub project_root: String,
}

/// Content to write to a file
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FsWriteInput {
    pub path: String,
    pub project_root: String,
    pub content: String,
}

/// Versioned file read result used by the editor to detect external changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileReadResult {
    pub content: String,
    pub modified_at: i64,
    /// Stable content fingerprint used for conflict-safe writes.
    pub version: String,
}

/// Result returned after a checked write.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWriteResult {
    pub modified_at: i64,
    pub version: String,
}

/// Response from create_fs_project
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFsProjectOutput {
    pub project: FsProject,
    pub created_directories: Vec<String>,
    pub created_files: Vec<String>,
}

/// File change event payload (sent to frontend via Tauri event)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangeEvent {
    /// Canonical project root that produced this event.
    pub project_root: String,
    pub paths: Vec<String>,
    pub timestamp: i64,
}

/// Result of exporting an SQLite project to filesystem
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportToFsResult {
    pub success: bool,
    pub project: FsProject,
    pub object_count: usize,
    pub file_count: usize,
}

/// A content search match within a file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    /// Relative path of the matching file
    pub file_path: String,
    /// Number of lines that matched
    pub match_count: u32,
    /// Preview snippets of matched lines (max 3)
    pub previews: Vec<String>,
}

/// Result of a content search operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearchResult {
    pub matches: Vec<SearchMatch>,
    pub total_files_searched: u32,
    /// True when search stopped at a result/file/depth safety limit.
    pub truncated: bool,
}

/// One bounded AI file action. Gate C permits only create or modify of one Markdown file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiFileActionInput {
    pub operation_id: String,
    pub action_type: String,
    pub target_path: String,
    pub content: String,
    pub expected_version: Option<String>,
    pub instruction: String,
    pub change_summary: String,
    pub evidence_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiFileActionOutput {
    pub operation_id: String,
    pub action_type: String,
    pub target_path: String,
    pub modified_at: i64,
    pub version: String,
    pub snapshot_path: Option<String>,
    pub record_path: String,
}

// ═══════════════════════════════════════════════
//  Gate D: Action History, Revert, Provenance
// ═══════════════════════════════════════════════

/// Summary of one action record, suitable for list displays.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiActionSummary {
    pub operation_id: String,
    pub action_type: String,
    pub target_path: String,
    pub status: String,
    pub instruction: String,
    pub change_summary: String,
    pub evidence_paths: Vec<String>,
    pub snapshot_path: Option<String>,
    pub old_version: Option<String>,
    pub new_version: Option<String>,
    pub error: Option<String>,
    pub updated_at: i64,
    pub reverted_at: Option<i64>,
}

/// Full detail of one action record, read from the JSON file.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiActionDetail {
    pub glyph_version: String,
    pub operation_id: String,
    pub action_type: String,
    pub target_path: String,
    pub status: String,
    pub instruction: String,
    pub change_summary: String,
    pub evidence_paths: Vec<String>,
    pub snapshot_path: Option<String>,
    pub old_version: Option<String>,
    pub new_version: Option<String>,
    pub error: Option<String>,
    pub updated_at: i64,
    pub reverted_at: Option<i64>,
}

/// Input for reverting an AI action.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevertAiActionInput {
    pub operation_id: String,
    pub project_root: String,
    pub target_path: String,
    pub expected_version: String,
}

/// Result of reverting an AI action.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevertAiActionResult {
    pub operation_id: String,
    pub target_path: String,
    pub restored: bool,
    pub restored_version: String,
    pub pre_revert_snapshot: String,
    pub reason: Option<String>,
}

/// Input for creating a provenance record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceRecordInput {
    pub project_root: String,
    pub action_id: String,
    pub file_path: String,
    /// The text block that AI wrote (used for anchoring)
    pub text_block: String,
    /// Start offset in the document at creation time
    pub start_offset: i64,
    /// End offset
    pub end_offset: i64,
}

/// One provenance entry stored in .glyph/provenance/
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceRecord {
    pub provenance_id: String,
    pub action_id: String,
    pub file_path: String,
    pub created_at: i64,
    pub text_block: String,
    pub start_offset: i64,
    pub end_offset: i64,
    /// "ai_original" | "ai_edited_by_user" | "uncertain" | "removed"
    pub current_state: String,
    pub last_verified_version: String,
}

/// One provenance entry for frontend display.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvenanceSummary {
    pub provenance_id: String,
    pub action_id: String,
    pub file_path: String,
    pub created_at: i64,
    pub text_block: String,
    pub start_offset: i64,
    pub end_offset: i64,
    pub current_state: String,
    pub last_verified_version: String,
}

/// Result of a startup recovery scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupRecoveryResult {
    pub actions_checked: u32,
    pub actions_recovered: u32,
    pub actions_failed: u32,
    pub details: Vec<String>,
}
