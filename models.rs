use serde::{Deserialize, Serialize};

// 鈹€鈹€ Project 鈹€鈹€
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub genre: String,
    pub status: String,
    pub word_count: i64,
    /// JSON array string e.g. '["#color1","#color2"]'
    pub gradient: String,
    pub created_at: i64,
    pub updated_at: i64,
}

// 鈹€鈹€ JudgmentRecord 鈹€鈹€
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JudgmentRecord {
    pub id: String,
    pub object_id: String,
    pub object_name: String,
    pub operation_type: String,
    pub reason: String,
    pub timestamp: i64,
    pub previous_status: String,
    pub new_status: String,
}

// 鈹€鈹€ WorldObject 鈹€鈹€
// Replaces: StoryNode + SettingCard + NarrativeUnit + NodeGroup
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldObject {
    pub id: String,
    pub project_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub status: String,
    pub canon_level: String,
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    pub selected_boards: Vec<String>,
    pub content: String,
    pub references_count: i32,
    pub judgment_history: Vec<JudgmentRecord>,
    pub created_at: i64,
    pub updated_at: i64,
}

// 鈹€鈹€ Connection 鈹€鈹€
// Replaces: Link + NarrativeRelationship
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub project_id: String,
    pub source_id: String,
    pub target_id: String,
    #[serde(rename = "type")]
    pub connection_type: String,
    pub label: String,
}

// 鈹€鈹€ CanvasTabState 鈹€鈹€
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasTabState {
    pub id: String,
    pub project_id: String,
    pub tab_id: String,
    /// Accepts Vec<CanvasNodePosition> OR Record<string, CanvasNodePosition>
    pub positions: serde_json::Value,
    pub sticky_notes: Vec<StickyNote>,
    pub connections: Vec<Connection>,
    pub scale: f64,
    pub pan_x: f64,
    pub pan_y: f64,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
}

// 鈹€鈹€ CanvasNodePosition 鈹€鈹€
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct CanvasNodePosition {
    pub object_id: String,
    pub x: f64,
    pub y: f64,
}

// 鈹€鈹€ StickyNote 鈹€鈹€
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StickyNote {
    pub id: String,
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub color: String,
}

// 鈹€鈹€ DB Row types (for SQLite storage with JSON columns) 鈹€鈹€

/// Internal row representation of WorldObject for DB storage.
/// JSON arrays are stored as TEXT columns.
#[derive(Debug, Clone)]
pub struct WorldObjectRow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub object_type: String,
    pub status: String,
    pub canon_level: String,
    pub tags: String,              // JSON array
    pub aliases: String,           // JSON array
    pub selected_boards: String,   // JSON array
    pub content: String,
    pub references_count: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

impl WorldObjectRow {
    pub fn to_api(self, judgment_records: Vec<JudgmentRecord>) -> WorldObject {
        WorldObject {
            id: self.id,
            project_id: self.project_id,
            name: self.name,
            object_type: self.object_type,
            status: self.status,
            canon_level: self.canon_level,
            tags: serde_json::from_str(&self.tags).unwrap_or_default(),
            aliases: serde_json::from_str(&self.aliases).unwrap_or_default(),
            selected_boards: serde_json::from_str(&self.selected_boards).unwrap_or_default(),
            content: self.content,
            references_count: self.references_count,
            judgment_history: judgment_records,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

/// Internal row representation of CanvasTabState for DB storage.
/// positions, sticky_notes, connections stored as JSON TEXT columns.
#[derive(Debug, Clone)]
pub struct CanvasTabStateRow {
    pub id: String,
    pub project_id: String,
    pub tab_id: String,
    pub positions: String,     // JSON array of CanvasNodePosition
    pub sticky_notes: String,  // JSON array of StickyNote
    pub connections: String,   // JSON array of Connection
    pub scale: f64,
    pub pan_x: f64,
    pub pan_y: f64,
    pub created_at: i64,
    pub updated_at: i64,
}

impl CanvasTabStateRow {
    pub fn to_api(self) -> CanvasTabState {
        CanvasTabState {
            id: self.id,
            project_id: self.project_id,
            tab_id: self.tab_id,
            positions: serde_json::from_str(&self.positions).unwrap_or_default(),
            sticky_notes: serde_json::from_str(&self.sticky_notes).unwrap_or_default(),
            connections: serde_json::from_str(&self.connections).unwrap_or_default(),
            scale: self.scale,
            pan_x: self.pan_x,
            pan_y: self.pan_y,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

// -- P0-04: Versioned canvas tab state and response --

/// CanvasTabState with a version stamp for conflict detection (P0-04)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasTabStateVersioned {
    /// The actual canvas tab state fields
    pub id: String,
    pub project_id: String,
    pub tab_id: String,
    pub positions: serde_json::Value,
    pub sticky_notes: Vec<StickyNote>,
    pub connections: Vec<Connection>,
    pub scale: f64,
    pub pan_x: f64,
    pub pan_y: f64,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
    /// Monotonic version stamp for conflict detection
    pub version: i64,
}

/// Response from save_canvas_tab_state (P0-04)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCanvasTabStateResponse {
    pub state: CanvasTabState,
    pub accepted: bool,
    pub current_version: i64,
}

// -- P0-05: Export / Import --

/// Result returned from export_project command (P0-05)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub success: bool,
    pub path: String,
    pub object_count: usize,
    pub connection_count: usize,
}

/// Result returned from import_project command (P0-05)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub success: bool,
    pub project_id: String,
    pub project_name: String,
    pub object_count: usize,
    pub connection_count: usize,
}

/// Full project data serialized into the .zhimengji zip manifest (P0-05)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectExportData {
    pub project: Project,
    pub objects: Vec<WorldObject>,
    pub connections: Vec<Connection>,
    pub canvas_states: Vec<CanvasTabState>,
}

// ===== v2 PipelineState =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineState {
    pub project_id: String,
    pub current_stage: String,
    pub canvas_stages: Vec<CanvasStageState>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasStageState {
    pub stage: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPipelineStateInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePipelineStateInput {
    pub state: PipelineState,
}

// ===== v2 PremiseCard =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PremiseCard {
    pub id: String,
    pub project_id: String,
    pub premise_text: String,
    /// JSON array of reader questions
    pub reader_questions: String,
    pub story_type: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePremiseInput {
    pub project_id: String,
    pub premise_text: String,
    pub reader_questions: String,
    pub story_type: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePremiseInput {
    pub id: String,
    pub premise_text: String,
    pub reader_questions: String,
    pub story_type: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPremiseInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPremiseInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePremiseInput {
    pub id: String,
}

// ===== v2 StructureNode =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructureNode {
    pub id: String,
    pub project_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub node_type: String,
    pub narrative_function: String,
    pub summary: String,
    pub position_x: f64,
    pub position_y: f64,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStructureNodeInput {
    pub project_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub node_type: String,
    pub narrative_function: String,
    pub summary: String,
    pub position_x: f64,
    pub position_y: f64,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStructureNodeInput {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub node_type: String,
    pub narrative_function: String,
    pub summary: String,
    pub position_x: f64,
    pub position_y: f64,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListStructureNodeInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetStructureNodeInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStructureNodeInput {
    pub id: String,
}

// ===== v2 WorldRule =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorldRule {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub rule_text: String,
    pub cost: String,
    pub enforcer: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorldRuleInput {
    pub project_id: String,
    pub title: String,
    pub rule_text: String,
    pub cost: String,
    pub enforcer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorldRuleInput {
    pub id: String,
    pub title: String,
    pub rule_text: String,
    pub cost: String,
    pub enforcer: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListWorldRuleInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetWorldRuleInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWorldRuleInput {
    pub id: String,
}

// ===== v2 CharacterCard =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterCard {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub hook: String,
    pub current_want: String,
    pub real_block: String,
    pub archetype: String,
    pub description: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCharacterCardInput {
    pub project_id: String,
    pub name: String,
    pub hook: String,
    pub current_want: String,
    pub real_block: String,
    pub archetype: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCharacterCardInput {
    pub id: String,
    pub name: String,
    pub hook: String,
    pub current_want: String,
    pub real_block: String,
    pub archetype: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCharacterCardInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetCharacterCardInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCharacterCardInput {
    pub id: String,
}

// ===== v2 FactionCard =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactionCard {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub true_goal: String,
    pub public_slogan: String,
    /// JSON array of resource strings
    pub resources: String,
    /// JSON array of character IDs
    pub representative_character_ids: String,
    pub daily_interface: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFactionCardInput {
    pub project_id: String,
    pub name: String,
    pub true_goal: String,
    pub public_slogan: String,
    pub resources: String,
    pub representative_character_ids: String,
    pub daily_interface: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFactionCardInput {
    pub id: String,
    pub name: String,
    pub true_goal: String,
    pub public_slogan: String,
    pub resources: String,
    pub representative_character_ids: String,
    pub daily_interface: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFactionCardInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetFactionCardInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFactionCardInput {
    pub id: String,
}

// ===== v2 ChapterPacket =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterPacket {
    pub id: String,
    pub project_id: String,
    pub structure_node_id: Option<String>,
    pub chapter_number: i64,
    pub title: String,
    pub line: String,
    pub position: String,
    pub chapter_function: String,
    // 四层 JSON 字符串（前端反序列化为 TS interface）
    pub layer1: String,
    pub layer2: String,
    pub layer3: String,
    pub layer4: String,
    pub status: String,
    pub mode: String,
    pub assumption_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChapterPacketInput {
    pub project_id: String,
    pub structure_node_id: String,
    pub chapter_number: i64,
    pub title: String,
    pub line: Option<String>,
    pub position: String,
    pub chapter_function: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChapterPacketLayersInput {
    pub packet_id: String,
    pub layer1: Option<String>,
    pub layer2: Option<String>,
    pub layer3: Option<String>,
    pub layer4: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListChapterPacketsInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetChapterPacketInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmChapterPacketInput {
    pub packet_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteChapterPacketInput {
    pub id: String,
}

// DB Row（JSON 列用 String 存储）
#[derive(Debug, Clone)]
pub struct ChapterPacketRow {
    pub id: String,
    pub project_id: String,
    pub structure_node_id: Option<String>,
    pub chapter_number: i64,
    pub title: String,
    pub line: String,
    pub position: String,
    pub chapter_function: String,
    pub layer1: String,
    pub layer2: String,
    pub layer3: String,
    pub layer4: String,
    pub status: String,
    pub mode: String,
    pub assumption_count: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

impl ChapterPacketRow {
    pub fn to_api(self) -> ChapterPacket {
        ChapterPacket {
            id: self.id,
            project_id: self.project_id,
            structure_node_id: self.structure_node_id,
            chapter_number: self.chapter_number,
            title: self.title,
            line: self.line,
            position: self.position,
            chapter_function: self.chapter_function,
            layer1: self.layer1,
            layer2: self.layer2,
            layer3: self.layer3,
            layer4: self.layer4,
            status: self.status,
            mode: self.mode,
            assumption_count: self.assumption_count,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

// ===== v2 DecisionLog =====

/// DecisionLogEntry — 追加型审计记录（D 轮新建）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecisionLogEntry {
    pub id: String,
    pub project_id: String,
    pub operation: String,
    pub entity_type: String,
    pub entity_id: String,
    pub summary: String,
    pub details: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendDecisionLogInput {
    pub project_id: String,
    pub operation: String,
    pub summary: String,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDecisionLogsInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDecisionLogInput {
    pub id: String,
}

/// DB Row representation of DecisionLogEntry for SQLite storage.
#[derive(Debug, Clone)]
pub struct DecisionLogRow {
    pub id: String,
    pub project_id: String,
    pub operation: String,
    pub entity_type: String,
    pub entity_id: String,
    pub summary: String,
    pub details: String,
    pub created_at: i64,
}

impl DecisionLogRow {
    pub fn to_api(self) -> DecisionLogEntry {
        DecisionLogEntry {
            id: self.id,
            project_id: self.project_id,
            operation: self.operation,
            entity_type: self.entity_type,
            entity_id: self.entity_id,
            summary: self.summary,
            details: self.details,
            created_at: self.created_at,
        }
    }
}

// ===== v2.0.2 AI Foundation Structs =====

/// Record of an AI prompt execution (ai_prompt_registry table)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPromptRecord {
    pub id: String,
    pub project_id: String,
    pub skill_id: String,
    pub prompt_text: String,
    pub input_data: String,
    pub output_data: String,
    pub status: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// AI provider configuration (ai_provider_config table)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub id: String,
    pub provider_id: String,
    pub provider_name: String,
    pub api_key_encrypted: String,
    pub endpoint: String,
    pub models: String,          // JSON array of model IDs
    pub timeout_ms: i64,
    pub is_active: bool,
    /// [v2.1.1-AI] True if this config was migrated from v1 BYOK api_keys table
    #[serde(default)]
    pub migrated_from_v1: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Result of an AI evaluation run (ai_evaluation_results table)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEvaluationResult {
    pub id: String,
    pub project_id: String,
    pub prompt_id: Option<String>,
    pub provider_id: String,
    pub model_id: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub latency_ms: i64,
    pub success: bool,
    pub error_message: String,
    pub created_at: i64,
}

// ===== AI Input/Output Types for Command Stubs =====

/// Input for build_context command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildContextInput {
    pub canvas_id: String,
    pub project_id: String,
    pub output_type: String,
    pub additional_prompt: Option<String>,
}

/// Output from build_context command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiBuiltContext {
    pub system_prompt: String,
    pub context_data: String,
    pub writable_targets: Vec<String>,
    pub forbidden_targets: Vec<String>,
    pub output_format: String,
    pub skill_id: Option<String>,
}

/// Input for route_intent command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRouteInput {
    pub message: String,
    pub canvas_id: String,
    pub project_id: String,
    pub history: Option<String>,
}

/// Output from route_intent command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRouteOutput {
    pub intent: String,
    pub confidence: f64,
    pub parameters: serde_json::Value,
    pub fallback_reason: Option<String>,
}

/// Input for parse_output command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiParseInput {
    pub raw_content: String,
    pub schema: String,
    pub strict: bool,
}

/// Output from parse_output command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiParseOutput {
    pub data: serde_json::Value,
    pub validation_errors: Vec<String>,
    pub repair_log: Vec<String>,
    pub fallback_text: Option<String>,
}

/// Skill record for AI skill registry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSkillRecord {
    pub id: String,
    pub skill_id: String,
    pub name: String,
    pub prompt_template: String,
    pub input_schema: String,
    pub output_schema: String,
    pub version: String,
}

/// Input for list_skills command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSkillsInput {
    pub project_id: String,
}

/// Output from list_skills command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSkillsOutput {
    pub skills: Vec<AiSkillRecord>,
}

/// Input for get_skill command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSkillInput {
    pub id: String,
}

/// Input for register_skill command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterSkillInput {
    pub skill_id: String,
    pub name: String,
    pub prompt_template: String,
    pub input_schema: String,
    pub output_schema: String,
    pub version: String,
}

/// Input for save_provider_config command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProviderConfigInput {
    pub provider_id: String,
    pub provider_name: String,
    pub api_key_encrypted: String,
    pub endpoint: String,
    pub models: Vec<String>,
    pub timeout_ms: i64,
    /// [v2.1.1-AI] If true and api_key_encrypted is empty, explicitly clear the stored key.
    /// If false/absent and api_key_encrypted is empty, keep existing key unchanged.
    #[serde(default)]
    pub clear_api_key: bool,
}

/// [v2.1.1-AI] Provider config summary returned in list (never exposes full apiKey).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigSummary {
    pub id: String,
    pub provider_id: String,
    pub provider_name: String,
    pub has_api_key: bool,
    pub api_key_preview: Option<String>,
    pub endpoint: String,
    pub models: String,
    pub timeout_ms: i64,
    pub is_active: bool,
    #[serde(default)]
    pub migrated_from_v1: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// [v2.1.1-AI] Input for resolving a provider credential.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveProviderCredentialInput {
    pub provider_id: String,
}

/// [v2.1.1-AI] Output from resolving a provider credential.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveProviderCredentialOutput {
    pub api_key: String,
}

impl AiProviderConfig {
    /// Convert to summary for list responses (never exposes full apiKeyEncrypted).
    pub fn to_summary(&self) -> ProviderConfigSummary {
        let (has_api_key, api_key_preview) = if self.api_key_encrypted.is_empty() {
            (false, None)
        } else if self.api_key_encrypted.len() <= 4 {
            (true, Some("****".to_string()))
        } else {
            (true, Some(format!("{}****", &self.api_key_encrypted[..4])))
        };
        ProviderConfigSummary {
            id: self.id.clone(),
            provider_id: self.provider_id.clone(),
            provider_name: self.provider_name.clone(),
            has_api_key,
            api_key_preview,
            endpoint: self.endpoint.clone(),
            models: self.models.clone(),
            timeout_ms: self.timeout_ms,
            is_active: self.is_active,
            migrated_from_v1: self.migrated_from_v1,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

/// Input for delete_provider_config command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProviderConfigInput {
    pub id: String,
}

/// Input for test_provider_connection command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestProviderConnectionInput {
    pub provider_id: String,
    pub endpoint: String,
    pub api_key: String,
    pub model: String,
}

/// Result from test_provider_connection command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConnectionTestResult {
    pub success: bool,
    pub message: String,
    pub latency_ms: i64,
    pub models: Vec<String>,
}

/// Input for run_evaluation command
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunEvaluationInput {
    pub project_id: String,
    pub prompt: String,
    pub provider_id: String,
    pub model_id: String,
}

// ===== v2.0.1 QuickDraft =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickDraftInput {
    pub project_id: String,
    pub user_input: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickDraftGenerateResult {
    pub draft: QuickDraftApi,
    pub preview_title: String,
    pub preview_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickDraftApi {
    pub id: String,
    pub project_id: String,
    pub user_input: String,
    pub premise_text: String,
    pub premise_type: String,
    pub chapters: String,
    pub status: String,
    pub created_at: i64,
}

#[derive(Debug, Clone)]
pub struct QuickDraftRow {
    pub id: String,
    pub project_id: String,
    pub user_input: String,
    pub premise_text: String,
    pub premise_type: String,
    pub chapters: String,
    pub status: String,
    pub created_at: i64,
}

impl QuickDraftRow {
    pub fn to_api(self) -> QuickDraftApi {
        QuickDraftApi {
            id: self.id,
            project_id: self.project_id,
            user_input: self.user_input,
            premise_text: self.premise_text,
            premise_type: self.premise_type,
            chapters: self.chapters,
            status: self.status,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuickDraftTransferInput {
    pub draft_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuickDraftsInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetQuickDraftInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteQuickDraftInput {
    pub id: String,
}

// ===== v2.0.1 Export =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportInput {
    pub chapter_content: String,
    pub default_name: String,
}

// ===== CN-MET-01: Premise Five-Step Methods =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PremiseStepRecord {
    pub id: String,
    pub project_id: String,
    pub current_step: String,
    pub wishlist: String,          // JSON array
    pub intern_extern: String,     // JSON object
    pub variants: String,          // JSON array
    pub qa: String,               // JSON array
    pub genre_judgment: String,   // JSON object or null
    pub completed_steps: String,  // JSON array of step strings
    pub skipped_steps: String,    // JSON array of step strings
    pub do_not_ask_again: String, // JSON array of step strings
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWishlistInput {
    pub project_id: String,
    pub wishlist: String, // JSON array
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWishlistOutput {
    pub project_id: String,
    pub step: String,
    pub saved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateVariantsInput {
    pub project_id: String,
    pub wishlist: String,        // JSON array
    pub internal_drive: String,
    pub external_drive: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateVariantsOutput {
    pub variants: String, // JSON array
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveVariantSelectionInput {
    pub project_id: String,
    pub variant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveVariantSelectionOutput {
    pub step: String,
    pub selected_variant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateReaderQAInput {
    pub project_id: String,
    pub variants: String, // JSON array
    pub selected_variant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateReaderQAOutput {
    pub questions: String, // JSON array
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveGenreJudgmentInput {
    pub project_id: String,
    pub genre_judgment: String, // JSON object
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveGenreJudgmentOutput {
    pub step: String,
    pub genre_judgment: String, // JSON object
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPremiseStepStateInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PremiseStepStateResponse {
    pub exists: bool,
    pub state: Option<PremiseStepRecord>,
}

// ===== CN-MET-03: Canvas 3 Sparrow Mode 9+3 Structs =====

/// A single sparrow step stored in DB (JSON content stored as string)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SparrowStepRecord {
    pub id: String,
    pub project_id: String,
    pub step_id: String,
    pub content: String,
    pub is_complete: bool,
    pub do_not_ask_again: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// A protagonist substep stored in DB
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtagonistStepRecord {
    pub id: String,
    pub project_id: String,
    pub step_type: String,
    pub character_id: String,
    pub description: String,
    pub is_usable: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Tian-Di-Ren layer stored in DB (as one row per project)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TianDiRenRecord {
    pub id: String,
    pub project_id: String,
    pub tian: String,
    pub di: String,
    pub ren: String,
    pub created_at: i64,
    pub updated_at: i64,
}

// ── CN-MET-03: Command Input Types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSparrowStepInput {
    pub project_id: String,
    pub step_id: String,
    pub content: String,
    pub is_complete: bool,
    pub do_not_ask_again: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSparrowStepOutput {
    pub project_id: String,
    pub step_id: String,
    pub saved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProtagonistStepInput {
    pub project_id: String,
    pub step_type: String,
    pub character_id: String,
    pub description: String,
    pub is_usable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProtagonistStepOutput {
    pub project_id: String,
    pub step_type: String,
    pub saved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkStepUsableInput {
    pub project_id: String,
    pub step_type: String,
    pub character_id: String,
    pub is_usable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkStepUsableOutput {
    pub project_id: String,
    pub step_type: String,
    pub is_usable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSparrowAiInput {
    pub project_id: String,
    pub step_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSparrowAiOutput {
    pub project_id: String,
    pub step_id: String,
    pub suggested_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTianDiRenLayerInput {
    pub project_id: String,
    pub tian: String,
    pub di: String,
    pub ren: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTianDiRenLayerOutput {
    pub project_id: String,
    pub saved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSparrowModuleInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateTianDiRenAiInput {
    pub project_id: String,
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateTianDiRenAiOutput {
    pub project_id: String,
    pub field: String,
    pub suggested_content: String,
}

/// Response from get_sparrow_module: returns all steps + protagonist steps + tian-di-ren
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SparrowModuleResponse {
    pub exists: bool,
    pub steps: Vec<SparrowStepRecord>,
    pub protagonist_steps: Vec<ProtagonistStepRecord>,
    pub tian_di_ren: Option<TianDiRenRecord>,
}

// ===== v2.0.1 Feedback =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FeedbackInput {
    pub project_id: String,
    pub rating: i64,
    pub feedback_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFeedbackInput {
    pub project_id: String,
}

// ===== CN-MET-04: ChapterPacket Detail Modes =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PacketDetailModeRecord {
    pub project_id: String,
    pub detail_mode: String,
    pub config_json: String,
    pub do_not_ask_again: bool,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PacketDetailConfig {
    pub detail_mode: String,
    pub do_not_ask_again: bool,
    pub config: serde_json::Value,
}

// --- Input/Output types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDetailModeInput {
    pub project_id: String,
    pub detail_mode: String,
    pub do_not_ask_again: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetPacketDetailInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PacketDetailResponse {
    pub detail_mode: String,
    pub do_not_ask_again: bool,
    pub config: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoGenerateSketchInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRefinedContentInput {
    pub project_id: String,
    pub layer4: String,
    pub word_count: Option<i64>,
}

// ===== CN-MET-02: Canvas 2 StructureGraph L1-L4 Hierarchy =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Canvas2NodeRecord {
    pub id: String,
    pub project_id: String,
    pub parent_id: Option<String>,
    pub layer_type: String,
    pub title: String,
    pub summary: String,
    pub time_period: String,
    pub chapter_range: String,
    pub scene_count: i64,
    pub word_count: i64,
    pub position_x: f64,
    pub position_y: f64,
    pub expanded: bool,
    pub sort_order: i64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCanvas2NodeInput {
    pub project_id: String,
    pub parent_id: Option<String>,
    pub layer_type: String,
    pub title: String,
    pub summary: String,
    pub time_period: String,
    pub chapter_range: String,
    pub scene_count: i64,
    pub word_count: i64,
    pub position_x: f64,
    pub position_y: f64,
    pub expanded: bool,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCanvas2NodeInput {
    pub id: String,
    pub title: Option<String>,
    pub summary: Option<String>,
    pub time_period: Option<String>,
    pub chapter_range: Option<String>,
    pub scene_count: Option<i64>,
    pub word_count: Option<i64>,
    pub expanded: Option<bool>,
    pub sort_order: Option<i64>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNodePositionInput {
    pub id: String,
    pub position_x: f64,
    pub position_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructureTreeOutput {
    pub nodes: Vec<Canvas2NodeRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetStructureTreeInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomToLayerInput {
    pub project_id: String,
    pub layer_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomToLayerOutput {
    pub nodes: Vec<Canvas2NodeRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGenerateStructureInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiGenerateStructureOutput {
    pub nodes: Vec<Canvas2NodeRecord>,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCanvas2NodeInput {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCanvas2NodeInput {
    pub id: Option<String>,
    pub project_id: String,
    pub parent_id: Option<String>,
    pub layer_type: String,
    pub title: String,
    pub summary: String,
    pub time_period: String,
    pub chapter_range: String,
    pub scene_count: i64,
    pub word_count: i64,
    pub position_x: f64,
    pub position_y: f64,
    pub expanded: bool,
    pub sort_order: i64,
}

// ===== v2.1.1 Timestamp API =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetUpdatedAtInput {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatedAtResponse {
    pub updated_at: i64,
}