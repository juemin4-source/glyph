// skill_registry.rs — AI Skill Registry
// Provides CRUD operations on the ai_skill_registry table.
// Called by ai_commands.rs.

use crate::db::Database;
use crate::models::{AiSkillRecord, RegisterSkillInput};

/// List all registered skills.
pub fn list_skills(db: &Database) -> Result<Vec<AiSkillRecord>, String> {
    db.list_ai_skills()
        .map_err(|e| format!("DB_ERROR: {}", e))
}

/// Get a single skill by internal DB id.
pub fn get_skill(db: &Database, id: &str) -> Result<Option<AiSkillRecord>, String> {
    db.get_ai_skill(id)
        .map_err(|e| format!("DB_ERROR: {}", e))
}

/// Get a single skill by its logical skill_id.
#[allow(dead_code)]
pub fn get_skill_by_skill_id(db: &Database, skill_id: &str) -> Result<Option<AiSkillRecord>, String> {
    db.get_ai_skill_by_skill_id(skill_id)
        .map_err(|e| format!("DB_ERROR: {}", e))
}

/// Register a new skill.
pub fn register_skill(db: &Database, input: &RegisterSkillInput) -> Result<AiSkillRecord, String> {
    db.register_ai_skill(input)
        .map_err(|e| format!("DB_ERROR: {}", e))
}
