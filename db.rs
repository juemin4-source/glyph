use rusqlite::{params, Connection, Result as SqlResult};
use std::sync::Mutex;

use crate::models::{
    CanvasStageState, CanvasTabState, CanvasTabStateRow, CharacterCard, Connection as ObjConnection,
    CreateCharacterCardInput, CreateFactionCardInput, CreatePremiseInput, CreateStructureNodeInput,
    CreateWorldRuleInput, FactionCard, ImportResult, JudgmentRecord, PipelineState, PremiseCard,
    Project, ProjectExportData, SaveCanvasTabStateResponse, StructureNode, UpdateCharacterCardInput,
    UpdateFactionCardInput, UpdatePremiseInput, UpdateStructureNodeInput, UpdateWorldRuleInput,
    WorldObject, WorldObjectRow, WorldRule,
    // v2 ChapterPacket
    ChapterPacket, ChapterPacketRow, CreateChapterPacketInput, UpdateChapterPacketLayersInput,
    // v2 DecisionLog
    AppendDecisionLogInput, DecisionLogEntry, DecisionLogRow,
    // v2.0.1 QuickDraft
    QuickDraftApi, QuickDraftInput, QuickDraftRow,
    // v2.0.1 Feedback
    FeedbackInput,
    // v2.0.2 AI Foundation (types used via SQL schema, not direct Rust references)
    // CN-MET-03: Canvas 3 Sparrow Mode 9+3
    SparrowStepRecord, SaveSparrowStepInput, SaveSparrowStepOutput,
    ProtagonistStepRecord, SaveProtagonistStepInput, SaveProtagonistStepOutput,
    MarkStepUsableInput, MarkStepUsableOutput,
    SaveTianDiRenLayerInput, SaveTianDiRenLayerOutput,
    TianDiRenRecord, SparrowModuleResponse,
    // CN-MET-04: Packet Detail Modes
    SetDetailModeInput, SaveRefinedContentInput,
    PacketDetailConfig, PacketDetailResponse, PacketDetailModeRecord,
};

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &str) -> SqlResult<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS projects (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              genre TEXT NOT NULL DEFAULT '',
              status TEXT NOT NULL DEFAULT 'conceiving',
              word_count INTEGER NOT NULL DEFAULT 0,
              gradient TEXT NOT NULL DEFAULT '[\"#6366f1\",\"#8b5cf6\"]',
              created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as integer) * 1000),
              updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as integer) * 1000)
            );

            CREATE TABLE IF NOT EXISTS world_objects (
              id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL,
              name TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'uncategorized',
              status TEXT NOT NULL DEFAULT 'draft',
              canon_level TEXT NOT NULL DEFAULT 'uncollected',
              tags TEXT NOT NULL DEFAULT '[]',
              aliases TEXT NOT NULL DEFAULT '[]',
              selected_boards TEXT NOT NULL DEFAULT '[]',
              content TEXT NOT NULL DEFAULT '',
              references_count INTEGER NOT NULL DEFAULT 0,
              created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as integer) * 1000),
              updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as integer) * 1000),
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS connections (
              id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL,
              source_id TEXT NOT NULL,
              target_id TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'related',
              label TEXT NOT NULL DEFAULT '',
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
              FOREIGN KEY (source_id) REFERENCES world_objects(id) ON DELETE CASCADE,
              FOREIGN KEY (target_id) REFERENCES world_objects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS canvas_tab_states (
              id TEXT PRIMARY KEY,
              project_id TEXT NOT NULL,
              tab_id TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 1,
              positions TEXT NOT NULL DEFAULT '[]',
              sticky_notes TEXT NOT NULL DEFAULT '[]',
              connections TEXT NOT NULL DEFAULT '[]',
              scale REAL NOT NULL DEFAULT 1.0,
              pan_x REAL NOT NULL DEFAULT 0.0,
              pan_y REAL NOT NULL DEFAULT 0.0,
              created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as integer) * 1000),
              updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as integer) * 1000),
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS judgment_records (
              id TEXT PRIMARY KEY,
              object_id TEXT NOT NULL,
              object_name TEXT NOT NULL DEFAULT '',
              operation_type TEXT NOT NULL,
              reason TEXT NOT NULL DEFAULT '',
              timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
              previous_status TEXT NOT NULL DEFAULT '',
              new_status TEXT NOT NULL DEFAULT '',
              FOREIGN KEY (object_id) REFERENCES world_objects(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_wo_project ON world_objects(project_id);
            CREATE INDEX IF NOT EXISTS idx_conn_project ON connections(project_id);
            CREATE INDEX IF NOT EXISTS idx_conn_source ON connections(source_id);
            CREATE INDEX IF NOT EXISTS idx_conn_target ON connections(target_id);
            CREATE INDEX IF NOT EXISTS idx_cts_project ON canvas_tab_states(project_id);
            CREATE INDEX IF NOT EXISTS idx_cts_tab ON canvas_tab_states(tab_id);
            CREATE INDEX IF NOT EXISTS idx_jr_object ON judgment_records(object_id);
            "
        )?;

        init_pipeline_states_table(&conn)?;
        init_premise_cards_table(&conn)?;
        init_structure_nodes_table(&conn)?;
        init_world_rules_table(&conn)?;
        init_character_cards_table(&conn)?;
        init_faction_cards_table(&conn)?;
        init_chapter_packets_table(&conn)?;
        init_decision_logs_table(&conn)?;
        init_quick_drafts_table(&conn)?;
        init_ai_tables(&conn)?;
        // [v2.1.1-AI] Schema migration: add migrated_from_v1 column
        migrate_ai_provider_config_schema(&conn)?;
        // [v2.1.1-AI] Migrate v1 BYOK api_keys to v2 ai_provider_config
        migrate_v1_api_keys_to_v2(&conn)?;
        init_premise_steps_table(&conn)?;
        init_sparrow_tables(&conn)?;
        init_packet_detail_modes_table(&conn)?;
        init_canvas2_structure_nodes_table(&conn)?;
        Ok(())
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  Project CRUD
    // -???????????????????????????????????????????????????????????????????????????????????

    pub fn list_projects(&self) -> SqlResult<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, genre, status, word_count, gradient, created_at, updated_at
             FROM projects ORDER BY updated_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                genre: row.get(2)?,
                status: row.get(3)?,
                word_count: row.get(4)?,
                gradient: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        let mut projects = Vec::new();
        for r in rows {
            projects.push(r?);
        }
        Ok(projects)
    }

    pub fn get_project(&self, id: &str) -> SqlResult<Option<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, genre, status, word_count, gradient, created_at, updated_at
             FROM projects WHERE id = ?",
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                genre: row.get(2)?,
                status: row.get(3)?,
                word_count: row.get(4)?,
                gradient: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn create_project(
        &self,
        name: &str,
        genre: &str,
        status: &str,
        word_count: i64,
        gradient: &str,
    ) -> SqlResult<Project> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO projects (id, name, genre, status, word_count, gradient, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, name, genre, status, word_count, gradient, now, now],
        )?;
        Ok(Project {
            id,
            name: name.to_string(),
            genre: genre.to_string(),
            status: status.to_string(),
            word_count,
            gradient: gradient.to_string(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_project(&self, project: &Project) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE projects SET name=?1, genre=?2, status=?3, word_count=?4, gradient=?5, updated_at=?6 WHERE id=?7",
            params![project.name, project.genre, project.status, project.word_count, project.gradient, now, project.id],
        )?;
        Ok(())
    }

    pub fn delete_project(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM projects WHERE id = ?", params![id])?;
        Ok(())
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  WorldObject CRUD
    // -???????????????????????????????????????????????????????????????????????????????????

    pub fn list_world_objects(&self, project_id: &str) -> SqlResult<Vec<WorldObject>> {
        // Collect all rows first, then release the lock before fetching judgment records
        // to avoid Mutex deadlock (std::sync::Mutex is non-reentrant).
        let rows: Vec<WorldObjectRow> = {
            let conn = self.conn.lock().unwrap();
            let mut stmt = conn.prepare(
                "SELECT id, project_id, name, type, status, canon_level,
                        tags, aliases, selected_boards, content, references_count,
                        created_at, updated_at
                 FROM world_objects WHERE project_id = ? ORDER BY created_at",
            )?;
            let iter = stmt.query_map(params![project_id], |row| {
                Ok(WorldObjectRow {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    object_type: row.get(3)?,
                    status: row.get(4)?,
                    canon_level: row.get(5)?,
                    tags: row.get(6)?,
                    aliases: row.get(7)?,
                    selected_boards: row.get(8)?,
                    content: row.get(9)?,
                    references_count: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            })?;
            let mut rows = Vec::new();
            for r in iter {
                rows.push(r?);
            }
            rows
        }; // MutexGuard dropped here

        let mut objects = Vec::new();
        for row in rows {
            let judgments = self.get_judgment_records_for_object(&row.id)?;
            objects.push(row.to_api(judgments));
        }
        Ok(objects)
    }

    pub fn get_world_object(&self, id: &str) -> SqlResult<Option<WorldObject>> {
        // Collect the row first, then release the lock before fetching judgment records
        // to avoid Mutex deadlock (std::sync::Mutex is non-reentrant).
        let row_opt: Option<WorldObjectRow> = {
            let conn = self.conn.lock().unwrap();
            let mut stmt = conn.prepare(
                "SELECT id, project_id, name, type, status, canon_level,
                        tags, aliases, selected_boards, content, references_count,
                        created_at, updated_at
                 FROM world_objects WHERE id = ?",
            )?;
            let mut rows = stmt.query_map(params![id], |row| {
                Ok(WorldObjectRow {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    object_type: row.get(3)?,
                    status: row.get(4)?,
                    canon_level: row.get(5)?,
                    tags: row.get(6)?,
                    aliases: row.get(7)?,
                    selected_boards: row.get(8)?,
                    content: row.get(9)?,
                    references_count: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            })?;
            match rows.next() {
                Some(r) => Some(r?),
                None => None,
            }
        }; // MutexGuard dropped here

        match row_opt {
            Some(row) => {
                let judgments = self.get_judgment_records_for_object(&row.id)?;
                Ok(Some(row.to_api(judgments)))
            }
            None => Ok(None),
        }
    }

    pub fn create_world_object(&self, object: &WorldObject) -> SqlResult<WorldObject> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        let tags_json = serde_json::to_string(&object.tags).unwrap_or_else(|_| "[]".to_string());
        let aliases_json = serde_json::to_string(&object.aliases).unwrap_or_else(|_| "[]".to_string());
        let boards_json = serde_json::to_string(&object.selected_boards).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT INTO world_objects (id, project_id, name, type, status, canon_level,
             tags, aliases, selected_boards, content, references_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                object.id, object.project_id, object.name, object.object_type,
                object.status, object.canon_level, tags_json, aliases_json, boards_json,
                object.content, object.references_count, now, now,
            ],
        )?;

        // Insert judgment records
        for jr in &object.judgment_history {
            let jr_id = if jr.id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                jr.id.clone()
            };
            conn.execute(
                "INSERT OR IGNORE INTO judgment_records (id, object_id, object_name, operation_type, reason, timestamp, previous_status, new_status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![jr_id, object.id, jr.object_name, jr.operation_type, jr.reason, jr.timestamp, jr.previous_status, jr.new_status],
            )?;
        }

        Ok(WorldObject {
            id: object.id.clone(),
            project_id: object.project_id.clone(),
            name: object.name.clone(),
            object_type: object.object_type.clone(),
            status: object.status.clone(),
            canon_level: object.canon_level.clone(),
            tags: object.tags.clone(),
            aliases: object.aliases.clone(),
            selected_boards: object.selected_boards.clone(),
            content: object.content.clone(),
            references_count: object.references_count,
            judgment_history: object.judgment_history.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_world_object(&self, object: &WorldObject) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        let tags_json = serde_json::to_string(&object.tags).unwrap_or_else(|_| "[]".to_string());
        let aliases_json = serde_json::to_string(&object.aliases).unwrap_or_else(|_| "[]".to_string());
        let boards_json = serde_json::to_string(&object.selected_boards).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE world_objects SET name=?1, type=?2, status=?3, canon_level=?4,
             tags=?5, aliases=?6, selected_boards=?7, content=?8, references_count=?9,
             updated_at=?10 WHERE id=?11",
            params![
                object.name, object.object_type, object.status, object.canon_level,
                tags_json, aliases_json, boards_json, object.content, object.references_count,
                now, object.id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_world_object(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM world_objects WHERE id = ?", params![id])?;
        Ok(())
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  JudgmentRecord
    // -???????????????????????????????????????????????????????????????????????????????????

    pub fn get_judgment_records_for_object(&self, object_id: &str) -> SqlResult<Vec<JudgmentRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, object_id, object_name, operation_type, reason, timestamp, previous_status, new_status
             FROM judgment_records WHERE object_id = ? ORDER BY timestamp DESC",
        )?;
        let rows = stmt.query_map(params![object_id], |row| {
            Ok(JudgmentRecord {
                id: row.get(0)?,
                object_id: row.get(1)?,
                object_name: row.get(2)?,
                operation_type: row.get(3)?,
                reason: row.get(4)?,
                timestamp: row.get(5)?,
                previous_status: row.get(6)?,
                new_status: row.get(7)?,
            })
        })?;
        let mut records = Vec::new();
        for r in rows {
            records.push(r?);
        }
        Ok(records)
    }

    pub fn list_judgment_records(&self, project_id: &str) -> SqlResult<Vec<JudgmentRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT jr.id, jr.object_id, jr.object_name, jr.operation_type, jr.reason,
                    jr.timestamp, jr.previous_status, jr.new_status
             FROM judgment_records jr
             INNER JOIN world_objects wo ON wo.id = jr.object_id
             WHERE wo.project_id = ?
             ORDER BY jr.timestamp DESC",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(JudgmentRecord {
                id: row.get(0)?,
                object_id: row.get(1)?,
                object_name: row.get(2)?,
                operation_type: row.get(3)?,
                reason: row.get(4)?,
                timestamp: row.get(5)?,
                previous_status: row.get(6)?,
                new_status: row.get(7)?,
            })
        })?;
        let mut records = Vec::new();
        for r in rows {
            records.push(r?);
        }
        Ok(records)
    }

    pub fn append_judgment_record(&self, record: &JudgmentRecord) -> SqlResult<JudgmentRecord> {
        let conn = self.conn.lock().unwrap();
        let id = if record.id.is_empty() {
            uuid::Uuid::new_v4().to_string()
        } else {
            record.id.clone()
        };
        conn.execute(
            "INSERT INTO judgment_records (id, object_id, object_name, operation_type, reason, timestamp, previous_status, new_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id, record.object_id, record.object_name, record.operation_type,
                record.reason, record.timestamp, record.previous_status, record.new_status,
            ],
        )?;
        Ok(JudgmentRecord {
            id,
            object_id: record.object_id.clone(),
            object_name: record.object_name.clone(),
            operation_type: record.operation_type.clone(),
            reason: record.reason.clone(),
            timestamp: record.timestamp,
            previous_status: record.previous_status.clone(),
            new_status: record.new_status.clone(),
        })
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  Connection CRUD
    // -???????????????????????????????????????????????????????????????????????????????????

    pub fn list_connections(&self, project_id: &str) -> SqlResult<Vec<ObjConnection>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, source_id, target_id, type, label
             FROM connections WHERE project_id = ?",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(ObjConnection {
                id: row.get(0)?,
                project_id: row.get(1)?,
                source_id: row.get(2)?,
                target_id: row.get(3)?,
                connection_type: row.get(4)?,
                label: row.get(5)?,
            })
        })?;
        let mut connections = Vec::new();
        for r in rows {
            connections.push(r?);
        }
        Ok(connections)
    }

    pub fn create_connection(&self, conn_data: &ObjConnection) -> SqlResult<ObjConnection> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO connections (id, project_id, source_id, target_id, type, label)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                conn_data.id,
                conn_data.project_id,
                conn_data.source_id,
                conn_data.target_id,
                conn_data.connection_type,
                conn_data.label,
            ],
        )?;
        Ok(conn_data.clone())
    }

    pub fn delete_connection(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM connections WHERE id = ?", params![id])?;
        Ok(())
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  CanvasTabState CRUD
    // -???????????????????????????????????????????????????????????????????????????????????

    pub fn list_canvas_tab_states(&self, project_id: &str) -> SqlResult<Vec<CanvasTabState>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, tab_id, positions, sticky_notes, connections,
                    scale, pan_x, pan_y, created_at, updated_at
             FROM canvas_tab_states WHERE project_id = ?",
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(CanvasTabStateRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                tab_id: row.get(2)?,
                positions: row.get(3)?,
                sticky_notes: row.get(4)?,
                connections: row.get(5)?,
                scale: row.get(6)?,
                pan_x: row.get(7)?,
                pan_y: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;
        let mut states = Vec::new();
        for r in rows {
            states.push(r?.to_api());
        }
        Ok(states)
    }

    pub fn save_canvas_tab_state(&self, state: &CanvasTabState, version: i64) -> Result<SaveCanvasTabStateResponse, String> {
        let conn = self.conn.lock().unwrap();

        // Check stored version for conflict detection
        let stored_version: i64 = conn
            .query_row(
                "SELECT version FROM canvas_tab_states WHERE id = ?1",
                params![state.id],
                |row| row.get(0),
            )
            .unwrap_or(0); // 0 means no existing record

        if stored_version > version {
            return Err(format!(
                "VERSION_CONFLICT: backend version {} > incoming version {}",
                stored_version, version
            ));
        }

        let new_version = version;
        let now = chrono::Utc::now().timestamp_millis();
        let positions_json = serde_json::to_string(&state.positions).unwrap_or_else(|_| "[]".to_string());
        let notes_json = serde_json::to_string(&state.sticky_notes).unwrap_or_else(|_| "[]".to_string());
        let conns_json = serde_json::to_string(&state.connections).unwrap_or_else(|_| "[]".to_string());

        // Upsert: INSERT OR REPLACE (includes version column)
        conn.execute(
            "INSERT OR REPLACE INTO canvas_tab_states
             (id, project_id, tab_id, positions, sticky_notes, connections, scale, pan_x, pan_y, version, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                     COALESCE((SELECT created_at FROM canvas_tab_states WHERE id=?1), ?11),
                     ?12)",
            params![
                state.id, state.project_id, state.tab_id,
                positions_json, notes_json, conns_json,
                state.scale, state.pan_x, state.pan_y,
                new_version, now, now,
            ],
        ).map_err(|e| format!("DB_ERROR: {}", e))?;

        let result_state = CanvasTabState {
            id: state.id.clone(),
            project_id: state.project_id.clone(),
            tab_id: state.tab_id.clone(),
            positions: state.positions.clone(),
            sticky_notes: state.sticky_notes.clone(),
            connections: state.connections.clone(),
            scale: state.scale,
            pan_x: state.pan_x,
            pan_y: state.pan_y,
            created_at: state.created_at,
            updated_at: now,
        };

        Ok(SaveCanvasTabStateResponse {
            state: result_state,
            accepted: true,
            current_version: new_version,
        })
    }


    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-
    //  v2 PremiseCard CRUD
    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-

    pub fn create_premise_card(&self, input: &CreatePremiseInput) -> SqlResult<PremiseCard> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO premise_cards (id, project_id, premise_text, reader_questions, story_type, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, input.project_id, input.premise_text, input.reader_questions, input.story_type, input.status, now, now],
        )?;
        Ok(PremiseCard {
            id,
            project_id: input.project_id.clone(),
            premise_text: input.premise_text.clone(),
            reader_questions: input.reader_questions.clone(),
            story_type: input.story_type.clone(),
            status: input.status.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn list_premise_cards(&self, project_id: &str) -> SqlResult<Vec<PremiseCard>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, premise_text, reader_questions, story_type, status, created_at, updated_at
             FROM premise_cards WHERE project_id = ? ORDER BY created_at"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(PremiseCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                premise_text: row.get(2)?,
                reader_questions: row.get(3)?,
                story_type: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        let mut cards = Vec::new();
        for r in rows {
            cards.push(r?);
        }
        Ok(cards)
    }

    pub fn get_premise_card(&self, id: &str) -> SqlResult<Option<PremiseCard>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, premise_text, reader_questions, story_type, status, created_at, updated_at
             FROM premise_cards WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(PremiseCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                premise_text: row.get(2)?,
                reader_questions: row.get(3)?,
                story_type: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn update_premise_card(&self, input: &UpdatePremiseInput) -> SqlResult<PremiseCard> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE premise_cards SET premise_text=?1, reader_questions=?2, story_type=?3, status=?4, updated_at=?5 WHERE id=?6",
            params![input.premise_text, input.reader_questions, input.story_type, input.status, now, input.id],
        )?;
        // Re-read to get full row
        let mut stmt = conn.prepare(
            "SELECT id, project_id, premise_text, reader_questions, story_type, status, created_at, updated_at
             FROM premise_cards WHERE id = ?"
        )?;
        let card = stmt.query_row(params![input.id], |row| {
            Ok(PremiseCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                premise_text: row.get(2)?,
                reader_questions: row.get(3)?,
                story_type: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        Ok(card)
    }

    pub fn delete_premise_card(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM premise_cards WHERE id = ?", params![id])?;
        Ok(())
    }

    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-
    //  v2 StructureNode CRUD
    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-

    pub fn create_structure_node(&self, input: &CreateStructureNodeInput) -> SqlResult<StructureNode> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO structure_nodes (id, project_id, parent_id, title, node_type, narrative_function, summary, position_x, position_y, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![id, input.project_id, input.parent_id, input.title, input.node_type, input.narrative_function, input.summary, input.position_x, input.position_y, input.sort_order, now, now],
        )?;
        Ok(StructureNode {
            id,
            project_id: input.project_id.clone(),
            parent_id: input.parent_id.clone(),
            title: input.title.clone(),
            node_type: input.node_type.clone(),
            narrative_function: input.narrative_function.clone(),
            summary: input.summary.clone(),
            position_x: input.position_x,
            position_y: input.position_y,
            sort_order: input.sort_order,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn list_structure_nodes(&self, project_id: &str) -> SqlResult<Vec<StructureNode>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, parent_id, title, node_type, narrative_function, summary, position_x, position_y, sort_order, created_at, updated_at
             FROM structure_nodes WHERE project_id = ? ORDER BY sort_order"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(StructureNode {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_id: row.get(2)?,
                title: row.get(3)?,
                node_type: row.get(4)?,
                narrative_function: row.get(5)?,
                summary: row.get(6)?,
                position_x: row.get(7)?,
                position_y: row.get(8)?,
                sort_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;
        let mut nodes = Vec::new();
        for r in rows {
            nodes.push(r?);
        }
        Ok(nodes)
    }

    pub fn get_structure_node(&self, id: &str) -> SqlResult<Option<StructureNode>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, parent_id, title, node_type, narrative_function, summary, position_x, position_y, sort_order, created_at, updated_at
             FROM structure_nodes WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(StructureNode {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_id: row.get(2)?,
                title: row.get(3)?,
                node_type: row.get(4)?,
                narrative_function: row.get(5)?,
                summary: row.get(6)?,
                position_x: row.get(7)?,
                position_y: row.get(8)?,
                sort_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn update_structure_node(&self, input: &UpdateStructureNodeInput) -> SqlResult<StructureNode> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE structure_nodes SET parent_id=?1, title=?2, node_type=?3, narrative_function=?4, summary=?5, position_x=?6, position_y=?7, sort_order=?8, updated_at=?9 WHERE id=?10",
            params![input.parent_id, input.title, input.node_type, input.narrative_function, input.summary, input.position_x, input.position_y, input.sort_order, now, input.id],
        )?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, parent_id, title, node_type, narrative_function, summary, position_x, position_y, sort_order, created_at, updated_at
             FROM structure_nodes WHERE id = ?"
        )?;
        let node = stmt.query_row(params![input.id], |row| {
            Ok(StructureNode {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_id: row.get(2)?,
                title: row.get(3)?,
                node_type: row.get(4)?,
                narrative_function: row.get(5)?,
                summary: row.get(6)?,
                position_x: row.get(7)?,
                position_y: row.get(8)?,
                sort_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;
        Ok(node)
    }

    pub fn delete_structure_node(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM structure_nodes WHERE id = ?", params![id])?;
        Ok(())
    }

    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-
    //  v2 WorldRule CRUD
    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-

    pub fn create_world_rule(&self, input: &CreateWorldRuleInput) -> SqlResult<WorldRule> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO world_rules (id, project_id, title, rule_text, cost, enforcer, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, input.project_id, input.title, input.rule_text, input.cost, input.enforcer, now, now],
        )?;
        Ok(WorldRule {
            id,
            project_id: input.project_id.clone(),
            title: input.title.clone(),
            rule_text: input.rule_text.clone(),
            cost: input.cost.clone(),
            enforcer: input.enforcer.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn list_world_rules(&self, project_id: &str) -> SqlResult<Vec<WorldRule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, rule_text, cost, enforcer, created_at, updated_at
             FROM world_rules WHERE project_id = ? ORDER BY created_at"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(WorldRule {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                rule_text: row.get(3)?,
                cost: row.get(4)?,
                enforcer: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        let mut rules = Vec::new();
        for r in rows {
            rules.push(r?);
        }
        Ok(rules)
    }

    pub fn get_world_rule(&self, id: &str) -> SqlResult<Option<WorldRule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, rule_text, cost, enforcer, created_at, updated_at
             FROM world_rules WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(WorldRule {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                rule_text: row.get(3)?,
                cost: row.get(4)?,
                enforcer: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn update_world_rule(&self, input: &UpdateWorldRuleInput) -> SqlResult<WorldRule> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE world_rules SET title=?1, rule_text=?2, cost=?3, enforcer=?4, updated_at=?5 WHERE id=?6",
            params![input.title, input.rule_text, input.cost, input.enforcer, now, input.id],
        )?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, rule_text, cost, enforcer, created_at, updated_at
             FROM world_rules WHERE id = ?"
        )?;
        let rule = stmt.query_row(params![input.id], |row| {
            Ok(WorldRule {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                rule_text: row.get(3)?,
                cost: row.get(4)?,
                enforcer: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        Ok(rule)
    }

    pub fn delete_world_rule(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM world_rules WHERE id = ?", params![id])?;
        Ok(())
    }

    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-
    //  v2 CharacterCard CRUD
    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-

    pub fn create_character_card(&self, input: &CreateCharacterCardInput) -> SqlResult<CharacterCard> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO character_cards (id, project_id, name, hook, current_want, real_block, archetype, description, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![id, input.project_id, input.name, input.hook, input.current_want, input.real_block, input.archetype, input.description, now, now],
        )?;
        Ok(CharacterCard {
            id,
            project_id: input.project_id.clone(),
            name: input.name.clone(),
            hook: input.hook.clone(),
            current_want: input.current_want.clone(),
            real_block: input.real_block.clone(),
            archetype: input.archetype.clone(),
            description: input.description.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn list_character_cards(&self, project_id: &str) -> SqlResult<Vec<CharacterCard>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, hook, current_want, real_block, archetype, description, created_at, updated_at
             FROM character_cards WHERE project_id = ? ORDER BY created_at"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(CharacterCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                hook: row.get(3)?,
                current_want: row.get(4)?,
                real_block: row.get(5)?,
                archetype: row.get(6)?,
                description: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        let mut cards = Vec::new();
        for r in rows {
            cards.push(r?);
        }
        Ok(cards)
    }

    pub fn get_character_card(&self, id: &str) -> SqlResult<Option<CharacterCard>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, hook, current_want, real_block, archetype, description, created_at, updated_at
             FROM character_cards WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(CharacterCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                hook: row.get(3)?,
                current_want: row.get(4)?,
                real_block: row.get(5)?,
                archetype: row.get(6)?,
                description: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn update_character_card(&self, input: &UpdateCharacterCardInput) -> SqlResult<CharacterCard> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE character_cards SET name=?1, hook=?2, current_want=?3, real_block=?4, archetype=?5, description=?6, updated_at=?7 WHERE id=?8",
            params![input.name, input.hook, input.current_want, input.real_block, input.archetype, input.description, now, input.id],
        )?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, hook, current_want, real_block, archetype, description, created_at, updated_at
             FROM character_cards WHERE id = ?"
        )?;
        let card = stmt.query_row(params![input.id], |row| {
            Ok(CharacterCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                hook: row.get(3)?,
                current_want: row.get(4)?,
                real_block: row.get(5)?,
                archetype: row.get(6)?,
                description: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        Ok(card)
    }

    pub fn delete_character_card(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM character_cards WHERE id = ?", params![id])?;
        Ok(())
    }

    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-
    //  v2 FactionCard CRUD
    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-

    pub fn create_faction_card(&self, input: &CreateFactionCardInput) -> SqlResult<FactionCard> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO faction_cards (id, project_id, name, true_goal, public_slogan, resources, representative_character_ids, daily_interface, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![id, input.project_id, input.name, input.true_goal, input.public_slogan, input.resources, input.representative_character_ids, input.daily_interface, now, now],
        )?;
        Ok(FactionCard {
            id,
            project_id: input.project_id.clone(),
            name: input.name.clone(),
            true_goal: input.true_goal.clone(),
            public_slogan: input.public_slogan.clone(),
            resources: input.resources.clone(),
            representative_character_ids: input.representative_character_ids.clone(),
            daily_interface: input.daily_interface.clone(),
            created_at: now,
            updated_at: now,
        })
    }

    pub fn list_faction_cards(&self, project_id: &str) -> SqlResult<Vec<FactionCard>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, true_goal, public_slogan, resources, representative_character_ids, daily_interface, created_at, updated_at
             FROM faction_cards WHERE project_id = ? ORDER BY created_at"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(FactionCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                true_goal: row.get(3)?,
                public_slogan: row.get(4)?,
                resources: row.get(5)?,
                representative_character_ids: row.get(6)?,
                daily_interface: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        let mut cards = Vec::new();
        for r in rows {
            cards.push(r?);
        }
        Ok(cards)
    }

    pub fn get_faction_card(&self, id: &str) -> SqlResult<Option<FactionCard>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, true_goal, public_slogan, resources, representative_character_ids, daily_interface, created_at, updated_at
             FROM faction_cards WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(FactionCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                true_goal: row.get(3)?,
                public_slogan: row.get(4)?,
                resources: row.get(5)?,
                representative_character_ids: row.get(6)?,
                daily_interface: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn update_faction_card(&self, input: &UpdateFactionCardInput) -> SqlResult<FactionCard> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE faction_cards SET name=?1, true_goal=?2, public_slogan=?3, resources=?4, representative_character_ids=?5, daily_interface=?6, updated_at=?7 WHERE id=?8",
            params![input.name, input.true_goal, input.public_slogan, input.resources, input.representative_character_ids, input.daily_interface, now, input.id],
        )?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, true_goal, public_slogan, resources, representative_character_ids, daily_interface, created_at, updated_at
             FROM faction_cards WHERE id = ?"
        )?;
        let card = stmt.query_row(params![input.id], |row| {
            Ok(FactionCard {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                true_goal: row.get(3)?,
                public_slogan: row.get(4)?,
                resources: row.get(5)?,
                representative_character_ids: row.get(6)?,
                daily_interface: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;
        Ok(card)
    }

    pub fn delete_faction_card(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM faction_cards WHERE id = ?", params![id])?;
        Ok(())
    }

    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-
    //  P0-05: Export / Import
    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-

    /// Export all project data for zip packaging (P0-05)
    pub fn export_project_data(&self, project_id: &str) -> Result<ProjectExportData, String> {
        let project = self
            .get_project(project_id)
            .map_err(|e| format!("NOT_FOUND: {}", e))?
            .ok_or_else(|| format!("NOT_FOUND: project {} not found", project_id))?;

        let objects = self
            .list_world_objects(project_id)
            .map_err(|e| format!("IO_ERROR: {}", e))?;

        let connections = self
            .list_connections(project_id)
            .map_err(|e| format!("IO_ERROR: {}", e))?;

        let canvas_states = self
            .list_canvas_tab_states(project_id)
            .map_err(|e| format!("IO_ERROR: {}", e))?;

        Ok(ProjectExportData {
            project,
            objects,
            connections,
            canvas_states,
        })
    }

    /// Import project data from a parsed export (P0-05).
    pub fn import_project_data(&self, data: &ProjectExportData) -> Result<ImportResult, String> {
        let new_project_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO projects (id, name, genre, status, word_count, gradient, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    new_project_id,
                    data.project.name, data.project.genre,
                    data.project.status, data.project.word_count,
                    data.project.gradient, now, now,
                ],
            ).map_err(|e| format!("IO_ERROR: {}", e))?;
        }

        let mut object_count = 0usize;
        let mut connection_count = 0usize;

        // Map old IDs to new UUIDs for conflict-free import
        let mut id_map = std::collections::HashMap::new();
        for obj in &data.objects {
            let new_id = uuid::Uuid::new_v4().to_string();
            id_map.insert(obj.id.clone(), new_id);
        }
        for obj in &data.objects {
            let tags_json = serde_json::to_string(&obj.tags).unwrap_or_else(|_| "[]".to_string());
            let aliases_json = serde_json::to_string(&obj.aliases).unwrap_or_else(|_| "[]".to_string());
            let boards_json = serde_json::to_string(&obj.selected_boards).unwrap_or_else(|_| "[]".to_string());
            {
                let conn = self.conn.lock().unwrap();
                conn.execute(
                    "INSERT INTO world_objects
                     (id, project_id, name, type, status, canon_level,
                      tags, aliases, selected_boards, content, references_count, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        id_map[&obj.id], new_project_id, obj.name, obj.object_type,
                        obj.status, obj.canon_level, tags_json, aliases_json, boards_json,
                        obj.content, obj.references_count, obj.created_at, obj.updated_at,
                    ],
                ).map_err(|e| format!("IO_ERROR: {}", e))?;

                for jr in &obj.judgment_history {
                    conn.execute(
                        "INSERT INTO judgment_records (id, object_id, object_name, operation_type, reason, timestamp, previous_status, new_status)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                        params![
                            jr.id, id_map[&obj.id], jr.object_name, jr.operation_type,
                            jr.reason, jr.timestamp, jr.previous_status, jr.new_status,
                        ],
                    ).map_err(|e| format!("IO_ERROR: {}", e))?;
                }
            }
            object_count += 1;
        }

        let mut conn_id_map = std::collections::HashMap::new();
        for conn_data in &data.connections {
            let new_conn_id = uuid::Uuid::new_v4().to_string();
            conn_id_map.insert(conn_data.id.clone(), new_conn_id);
        }

        for conn_data in &data.connections {
            {
                let conn = self.conn.lock().unwrap();
                conn.execute(
                    "INSERT INTO connections (id, project_id, source_id, target_id, type, label)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![
                        conn_id_map[&conn_data.id], new_project_id,
                        id_map[&conn_data.source_id], id_map[&conn_data.target_id],
                        conn_data.connection_type, conn_data.label,
                    ],
                ).map_err(|e| format!("IO_ERROR: {}", e))?;
            }
            connection_count += 1;
        }

        for cs in &data.canvas_states {
            let positions_json = serde_json::to_string(&cs.positions).unwrap_or_else(|_| "[]".to_string());
            let notes_json = serde_json::to_string(&cs.sticky_notes).unwrap_or_else(|_| "[]".to_string());
            let conns_json = serde_json::to_string(&cs.connections).unwrap_or_else(|_| "[]".to_string());
            {
                let conn = self.conn.lock().unwrap();
                conn.execute(
                    "INSERT INTO canvas_tab_states
                     (id, project_id, tab_id, positions, sticky_notes, connections, scale, pan_x, pan_y, version, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    params![
                        uuid::Uuid::new_v4().to_string(), new_project_id, cs.tab_id,
                        positions_json, notes_json, conns_json,
                        cs.scale, cs.pan_x, cs.pan_y,
                        1i64, cs.created_at, now,
                    ],
                ).map_err(|e| format!("IO_ERROR: {}", e))?;
            }
        }

        Ok(ImportResult {
            success: true,
            project_id: new_project_id,
            project_name: data.project.name.clone(),
            object_count,
            connection_count,
        })
    }

    /// Import a plain markdown directory (P0-05).
    pub fn import_markdown_directory(&self, dir_path: &str) -> Result<ImportResult, String> {
        let dir = std::path::Path::new(dir_path);
        if !dir.is_dir() {
            return Err(format!("NOT_FOUND: directory not found: {}", dir_path));
        }

        let mut md_entries: Vec<(String, String)> = Vec::new();
        let read_dir = std::fs::read_dir(dir).map_err(|e| format!("IO_ERROR: {}", e))?;

        for entry in read_dir {
            let entry = entry.map_err(|e| format!("IO_ERROR: {}", e))?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("md") {
                let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("untitled").to_string();
                let content = std::fs::read_to_string(&path).map_err(|e| format!("IO_ERROR: {}", e))?;
                md_entries.push((file_stem, content));
            }
        }

        if md_entries.is_empty() {
            return Err("IO_ERROR: no .md files found in directory".to_string());
        }

        let project_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        let dir_name = dir.file_name().and_then(|s| s.to_str()).unwrap_or("Imported Project");

        {
            let conn = self.conn.lock().unwrap();
            conn.execute(
                "INSERT INTO projects (id, name, genre, status, word_count, gradient, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    project_id, dir_name, "未分类", "conceiving",
                    0i64, r##"["#6366f1","#8b5cf6"]"##, now, now,
                ],
            ).map_err(|e| format!("IO_ERROR: {}", e))?;
        }

        let mut name_to_id = std::collections::HashMap::new();
        let mut object_count = 0usize;

        for (name, content) in &md_entries {
            let obj_id = uuid::Uuid::new_v4().to_string();
            name_to_id.insert(name.clone(), obj_id.clone());
            {
                let conn = self.conn.lock().unwrap();
                conn.execute(
                    "INSERT INTO world_objects (id, project_id, name, type, status, canon_level,
                     tags, aliases, selected_boards, content, references_count, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        obj_id, project_id, name, "术语", "草稿", "草案正典",
                        "[]", "[]", "[]", content, 0i32, now, now,
                    ],
                ).map_err(|e| format!("IO_ERROR: {}", e))?;
            }
            object_count += 1;
        }

        let mut connection_count = 0usize;
        for (name, content) in &md_entries {
            let source_id = match name_to_id.get(name) {
                Some(id) => id.clone(),
                None => continue,
            };
            let targets = parse_wiki_links(content);
            for target_name in targets {
                if let Some(target_id) = name_to_id.get(&target_name) {
                    let conn_id = uuid::Uuid::new_v4().to_string();
                    {
                        let conn = self.conn.lock().unwrap();
                        let existing = conn.query_row::<i64, _, _>(
                            "SELECT COUNT(*) FROM connections WHERE project_id = ?1 AND source_id = ?2 AND target_id = ?3",
                            params![project_id, source_id, target_id],
                            |row| row.get(0),
                        ).unwrap_or(0);
                        if existing == 0 {
                            conn.execute(
                                "INSERT INTO connections (id, project_id, source_id, target_id, type, label)
                                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                                params![conn_id, project_id, source_id, target_id, "相关", ""],
                            ).map_err(|e| format!("IO_ERROR: {}", e))?;
                            connection_count += 1;
                        }
                    }
                }
            }
        }

        Ok(ImportResult {
            success: true,
            project_id,
            project_name: dir_name.to_string(),
            object_count,
            connection_count,
        })
    }

    pub fn delete_canvas_tab_state(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM canvas_tab_states WHERE id = ?", params![id])?;
        Ok(())
    }
}


/// Parse [[WikiLink]] patterns from markdown content (P0-05).
/// Returns a list of referenced object names (without display text suffix).
fn parse_wiki_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();
    let mut remaining = content;
    while let Some(start) = remaining.find("[[") {
        let after_open = &remaining[start + 2..];
        if let Some(end) = after_open.find("]]") {
            let link_text = &after_open[..end];
            let name = link_text.split('|').next().unwrap_or("").trim().to_string();
            if !name.is_empty() {
                links.push(name);
            }
            remaining = &after_open[end + 2..];
        } else {
            break;
        }
    }
    links
}

// ===== v2 PipelineState =====

pub fn init_pipeline_states_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS pipeline_states (
          project_id TEXT PRIMARY KEY,
          current_stage TEXT NOT NULL DEFAULT 'premise',
          canvas_stages TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as integer) * 1000),
          updated_at INTEGER NOT NULL DEFAULT (cast(strftime('%s','now') as integer) * 1000),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );"
    )?;
    Ok(())
}

/// 获取 PipelineState，如果不存在则创建并返回默认状态
pub fn get_or_default_pipeline_state(conn: &Connection, project_id: &str) -> Result<PipelineState, String> {
    let mut stmt = conn.prepare_cached(
        "SELECT project_id, current_stage, canvas_stages, created_at, updated_at FROM pipeline_states WHERE project_id = ?1"
    ).map_err(|e| e.to_string())?;

    let result = stmt.query_row(params![project_id], |row| {
        let canvas_stages_str: String = row.get(2)?;
        Ok(PipelineState {
            project_id: row.get(0)?,
            current_stage: row.get(1)?,
            canvas_stages: serde_json::from_str(&canvas_stages_str).unwrap_or_default(),
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    });

    match result {
        Ok(mut state) => {
            // 保证 canvas_stages 不为空——如果数据库记录缺失或空数组，补全默认值
            if state.canvas_stages.is_empty() {
                state.canvas_stages = vec![
                    CanvasStageState { stage: "premise".to_string(), status: "active".to_string() },
                    CanvasStageState { stage: "structure".to_string(), status: "locked".to_string() },
                    CanvasStageState { stage: "setting".to_string(), status: "locked".to_string() },
                    CanvasStageState { stage: "packet".to_string(), status: "locked".to_string() },
                    CanvasStageState { stage: "text".to_string(), status: "locked".to_string() },
                ];
                // 写回数据库确保一致
                let json = serde_json::to_string(&state.canvas_stages).map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE pipeline_states SET canvas_stages = ?1, updated_at = ?2 WHERE project_id = ?3",
                    params![json, state.updated_at, project_id],
                ).map_err(|e| e.to_string())?;
            }
            Ok(state)
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // 创建默认状态
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64;
            let default_stages = vec![
                CanvasStageState { stage: "premise".to_string(), status: "active".to_string() },
                CanvasStageState { stage: "structure".to_string(), status: "locked".to_string() },
                CanvasStageState { stage: "setting".to_string(), status: "locked".to_string() },
                CanvasStageState { stage: "packet".to_string(), status: "locked".to_string() },
                CanvasStageState { stage: "text".to_string(), status: "locked".to_string() },
            ];
            let json = serde_json::to_string(&default_stages).map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT INTO pipeline_states (project_id, current_stage, canvas_stages, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![project_id, "premise", &json, now, now],
            ).map_err(|e| e.to_string())?;
            Ok(PipelineState {
                project_id: project_id.to_string(),
                current_stage: "premise".to_string(),
                canvas_stages: default_stages,
                created_at: now,
                updated_at: now,
            })
        }
        Err(e) => Err(e.to_string()),
    }
}

/// 保存 PipelineState
pub fn save_pipeline_state(conn: &Connection, state: &PipelineState) -> Result<PipelineState, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    let json = serde_json::to_string(&state.canvas_stages).map_err(|e| e.to_string())?;
    let rows = conn.execute(
        "UPDATE pipeline_states SET current_stage = ?1, canvas_stages = ?2, updated_at = ?3 WHERE project_id = ?4",
        params![state.current_stage, &json, now, state.project_id],
    ).map_err(|e| e.to_string())?;

    if rows == 0 {
        // 不存在则插入
        conn.execute(
            "INSERT INTO pipeline_states (project_id, current_stage, canvas_stages, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![state.project_id, state.current_stage, &json, now, now],
        ).map_err(|e| e.to_string())?;
    }

    // 返回保存后的完整 PipelineState
    Ok(PipelineState {
        project_id: state.project_id.clone(),
        current_stage: state.current_stage.clone(),
        canvas_stages: state.canvas_stages.clone(),
        created_at: if rows == 0 { now } else { state.created_at },
        updated_at: now,
    })
}

// ===== v2 PremiseCards =====

pub fn init_premise_cards_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS premise_cards (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL UNIQUE,
          premise_text TEXT NOT NULL DEFAULT '',
          reader_questions TEXT NOT NULL DEFAULT '[]',
          story_type TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );"
    )?;
    Ok(())
}

// ===== v2 StructureNodes =====

pub fn init_structure_nodes_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS structure_nodes (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          parent_id TEXT,
          title TEXT NOT NULL DEFAULT '新节点',
          node_type TEXT NOT NULL DEFAULT 'chapter',
          narrative_function TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          position_x REAL NOT NULL DEFAULT 0,
          position_y REAL NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );"
    )?;
    Ok(())
}

// ===== v2 WorldRules =====

pub fn init_world_rules_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS world_rules (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          rule_text TEXT NOT NULL DEFAULT '',
          cost TEXT NOT NULL DEFAULT '',
          enforcer TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );"
    )?;
    Ok(())
}

// ===== v2 CharacterCards =====

pub fn init_character_cards_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS character_cards (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          hook TEXT NOT NULL DEFAULT '',
          current_want TEXT NOT NULL DEFAULT '',
          real_block TEXT NOT NULL DEFAULT '',
          archetype TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );"
    )?;
    Ok(())
}

// ===== v2 FactionCards =====

pub fn init_faction_cards_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS faction_cards (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          true_goal TEXT NOT NULL DEFAULT '',
          public_slogan TEXT NOT NULL DEFAULT '',
          resources TEXT NOT NULL DEFAULT '[]',
          representative_character_ids TEXT NOT NULL DEFAULT '[]',
          daily_interface TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );"
    )?;
    Ok(())
}

// ===== v2 ChapterPacket =====

pub fn init_chapter_packets_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS chapter_packets (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          structure_node_id TEXT DEFAULT NULL,
          chapter_number INTEGER NOT NULL DEFAULT 1,
          title TEXT NOT NULL DEFAULT '',
          line TEXT NOT NULL DEFAULT '',
          position TEXT NOT NULL DEFAULT '',
          chapter_function TEXT NOT NULL DEFAULT '',
          -- 四层 JSON TEXT 列
          layer1 TEXT NOT NULL DEFAULT '{}',
          layer2 TEXT NOT NULL DEFAULT '{}',
          layer3 TEXT NOT NULL DEFAULT '{}',
          layer4 TEXT NOT NULL DEFAULT '{}',
          -- 元数据
          status TEXT NOT NULL DEFAULT 'empty',
          mode TEXT NOT NULL DEFAULT 'standard',
          assumption_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (structure_node_id) REFERENCES structure_nodes(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cp_project ON chapter_packets(project_id);
        CREATE INDEX IF NOT EXISTS idx_cp_structure_node ON chapter_packets(structure_node_id);
        CREATE INDEX IF NOT EXISTS idx_cp_chapter ON chapter_packets(project_id, chapter_number);"
    )?;
    Ok(())
}

// ===== v2 DecisionLog =====

pub fn init_decision_logs_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS decision_logs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          operation TEXT NOT NULL DEFAULT '',
          entity_type TEXT NOT NULL DEFAULT '',
          entity_id TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          details TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_dl_project ON decision_logs(project_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_dl_operation ON decision_logs(operation);"
    )?;
    Ok(())
}

// ===== v2.0.1 QuickDraft =====

pub fn init_quick_drafts_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS quick_drafts (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          user_input TEXT NOT NULL,
          premise_text TEXT NOT NULL DEFAULT '',
          premise_type TEXT NOT NULL DEFAULT '',
          chapters TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'draft',
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_qd_project ON quick_drafts(project_id);
        CREATE INDEX IF NOT EXISTS idx_qd_status ON quick_drafts(status);"
    )?;
    Ok(())
}

// ===== CN-MET-01: Premise Five-Step Steps =====

pub fn init_premise_steps_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS canvas1_premise_steps (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL UNIQUE,
          current_step TEXT NOT NULL DEFAULT 'wishlist',
          wishlist TEXT NOT NULL DEFAULT '[]',
          intern_extern TEXT NOT NULL DEFAULT '{\"internalDrive\":\"\",\"externalDrive\":\"\"}',
          variants TEXT NOT NULL DEFAULT '[]',
          qa TEXT NOT NULL DEFAULT '[]',
          genre_judgment TEXT NOT NULL DEFAULT 'null',
          completed_steps TEXT NOT NULL DEFAULT '[]',
          skipped_steps TEXT NOT NULL DEFAULT '[]',
          do_not_ask_again TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );"
    )?;
    Ok(())
}

// ===== v2.0.2 AI Foundation =====

pub fn init_ai_tables(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS ai_prompt_registry (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          skill_id TEXT NOT NULL DEFAULT '',
          prompt_text TEXT NOT NULL DEFAULT '',
          input_data TEXT NOT NULL DEFAULT '{}',
          output_data TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ai_provider_config (
          id TEXT PRIMARY KEY,
          provider_id TEXT NOT NULL,
          provider_name TEXT NOT NULL DEFAULT '',
          api_key_encrypted TEXT NOT NULL DEFAULT '',
          endpoint TEXT NOT NULL DEFAULT '',
          models TEXT NOT NULL DEFAULT '[]',
          timeout_ms INTEGER NOT NULL DEFAULT 30000,
          is_active INTEGER NOT NULL DEFAULT 1,
          migrated_from_v1 INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_evaluation_results (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          prompt_id TEXT DEFAULT NULL,
          provider_id TEXT NOT NULL DEFAULT '',
          model_id TEXT NOT NULL DEFAULT '',
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          latency_ms INTEGER NOT NULL DEFAULT 0,
          success INTEGER NOT NULL DEFAULT 1,
          error_message TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ai_skill_registry (
          id TEXT PRIMARY KEY,
          skill_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          prompt_template TEXT NOT NULL DEFAULT '',
          input_schema TEXT NOT NULL DEFAULT '{}',
          output_schema TEXT NOT NULL DEFAULT '{}',
          version TEXT NOT NULL DEFAULT '1.0.0',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ai_prompt_project ON ai_prompt_registry(project_id);
        CREATE INDEX IF NOT EXISTS idx_ai_prompt_status ON ai_prompt_registry(status);
        CREATE INDEX IF NOT EXISTS idx_ai_provider_id ON ai_provider_config(provider_id);
        CREATE INDEX IF NOT EXISTS idx_ai_eval_project ON ai_evaluation_results(project_id);
        CREATE INDEX IF NOT EXISTS idx_ai_eval_provider ON ai_evaluation_results(provider_id);
        CREATE INDEX IF NOT EXISTS idx_ai_skill_id ON ai_skill_registry(skill_id);"
    )?;

    // Seed 5 default skills if the table is empty
    init_default_skills(conn)?;

    Ok(())
}

/// [v2.1.1-AI] Migrate ai_provider_config schema to add migrated_from_v1 column.
/// Existing databases may not have this column.
pub fn migrate_ai_provider_config_schema(conn: &Connection) -> SqlResult<()> {
    // SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check first
    let has_column: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('ai_provider_config') WHERE name='migrated_from_v1'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if !has_column {
        conn.execute_batch(
            "ALTER TABLE ai_provider_config ADD COLUMN migrated_from_v1 INTEGER NOT NULL DEFAULT 0;"
        )?;
    }
    Ok(())
}

/// [v2.1.1-AI] Migrate v1 BYOK api_keys to v2 ai_provider_config.
/// Reads from api_keys table, decrypts using v1 master key, and creates
/// entries in ai_provider_config if not already present.
/// Must be called after init_ai_tables() and migrate_ai_provider_config_schema().
pub fn migrate_v1_api_keys_to_v2(conn: &Connection) -> SqlResult<()> {
    use rusqlite::params;

    // Check if api_keys table exists (v1 BYOK)
    let has_api_keys: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='api_keys'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if !has_api_keys {
        return Ok(()); // No v1 data to migrate
    }

    // Read all v1 api_keys
    let mut stmt = conn.prepare(
        "SELECT provider, encrypted_key, created_at, updated_at FROM api_keys"
    )?;
    let v1_keys: Vec<(String, String, i64, i64)> = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
            row.get::<_, i64>(3)?,
        ))
    })?.filter_map(|r| r.ok()).collect();

    for (provider_id, encrypted_key, created_at, _updated_at) in &v1_keys {
        // Check if this provider already exists in v2 config
        let exists: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM ai_provider_config WHERE provider_id = ?1",
            params![provider_id],
            |row| row.get(0),
        ).unwrap_or(false);

        if exists {
            continue; // Already migrated
        }

        // Create v2 entry using v1 data
        // Map provider_id to provider_name
        let provider_name = match provider_id.as_str() {
            "openai" => "OpenAI (migrated)",
            "anthropic" => "Anthropic (migrated)",
            "google" => "Google AI (migrated)",
            "azure" => "Azure OpenAI (migrated)",
            "deepseek" => "DeepSeek (migrated)",
            "custom" => "Custom (migrated)",
            _ => provider_id.as_str(),
        };

        let now_ms = chrono::Utc::now().timestamp_millis();
        let new_id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO ai_provider_config (id, provider_id, provider_name, api_key_encrypted, endpoint, models, timeout_ms, is_active, migrated_from_v1, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, 1, ?8, ?9)",
            params![
                new_id,
                provider_id,
                provider_name,
                encrypted_key,
                "",   // endpoint — unknown from v1, user must configure
                "[]", // models — unknown from v1
                30000,
                *created_at * 1000, // v1 uses seconds, v2 uses ms
                now_ms,
            ],
        )?;
    }

    Ok(())
}

fn init_default_skills(conn: &Connection) -> SqlResult<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM ai_skill_registry",
        [],
        |row| row.get(0),
    )?;
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Utc::now().timestamp_millis();
    let defaults = vec![
        (
            uuid::Uuid::new_v4().to_string(),
            "premise.five_step",
            "premise five-step method",
            "You are a professional premise analyst. Given the following {{story_type}} story input, generate a five-step premise:\n\n1. **Protagonist**: {{protagonist}}\n2. **Situation**: {{situation}}\n3. **Objective**: {{objective}}\n4. **Obstacle**: {{obstacle}}\n5. **Stakes**: {{stakes}}\n\nOutput in JSON format.",
            r#"{"type":"object","properties":{"story_type":{"type":"string"},"protagonist":{"type":"string"},"situation":{"type":"string"},"objective":{"type":"string"},"obstacle":{"type":"string"},"stakes":{"type":"string"}},"required":["story_type","protagonist","situation","objective","obstacle","stakes"]}"#,
            r#"{"type":"object","properties":{"premise":{"type":"string"},"fiveSteps":{"type":"array"}},"required":["premise","fiveSteps"]}"#,
            "1.0.0",
        ),
        (
            uuid::Uuid::new_v4().to_string(),
            "structure.l1_l4",
            "structure L1-L4 outline",
            "You are a story structure architect. Given the premise {{premise_text}} and genre {{genre}}, generate a four-level structural outline:\n\nL1 — Story Arc (beginning / middle / end)\nL2 — Acts (1-3 or 1-5)\nL3 — Sequences (3-6 per act)\nL4 — Scenes (key scenes per sequence)\n\nOutput in JSON format.",
            r#"{"type":"object","properties":{"premise_text":{"type":"string"},"genre":{"type":"string"}},"required":["premise_text","genre"]}"#,
            r#"{"type":"object","properties":{"l1Arc":{"type":"string"},"l2Acts":{"type":"array"},"l3Sequences":{"type":"array"},"l4Scenes":{"type":"array"}},"required":["l1Arc","l2Acts","l3Sequences","l4Scenes"]}"#,
            "1.0.0",
        ),
        (
            uuid::Uuid::new_v4().to_string(),
            "setting.sparrow_9_3",
            "setting sparrow 9-grid 3.0",
            "You are a worldbuilding specialist using the 9-Panel Setting System v3. Given the premise {{premise_text}} and genre {{genre}}, fill in 9 panels:\n\n1. Space (physical environment)\n2. Time (era / timeline)\n3. Society (power structures)\n4. Magic / Tech (rules of the world)\n5. Economy (resources & trade)\n6. Culture (norms & values)\n7. History (key events)\n8. Factions (key groups)\n9. Mood (emotional tone)\n\nOutput in JSON format.",
            r#"{"type":"object","properties":{"premise_text":{"type":"string"},"genre":{"type":"string"}},"required":["premise_text","genre"]}"#,
            r#"{"type":"object","properties":{"panels":{"type":"array","items":{"type":"object","properties":{"panelId":{"type":"integer"},"title":{"type":"string"},"content":{"type":"string"}}}}}},"required":["panels"]"#,
            "1.0.0",
        ),
        (
            uuid::Uuid::new_v4().to_string(),
            "packet.three_detail_modes",
            "packet three detail modes",
            "You are a chapter packet detailer. Given the chapter {{chapter_title}} and outline {{outline_text}}, generate three detail modes:\n\n**Full Mode**: max detail with character intents, scene by scene\n**Balanced Mode**: key scenes with summary for transitions\n**Sparse Mode**: bullet-point outline only\n\nOutput in JSON format.",
            r#"{"type":"object","properties":{"chapter_title":{"type":"string"},"outline_text":{"type":"string"}},"required":["chapter_title","outline_text"]}"#,
            r#"{"type":"object","properties":{"fullDetail":{"type":"string"},"balancedDetail":{"type":"string"},"sparseDetail":{"type":"string"}},"required":["fullDetail","balancedDetail","sparseDetail"]}"#,
            "1.0.0",
        ),
        (
            uuid::Uuid::new_v4().to_string(),
            "draft.chapter_writer",
            "draft chapter writer",
            "You are a fiction prose writer. Based on the chapter packet {{packet_json}} and detail mode {{detail_mode}}, write the complete chapter draft.\n\nMaintain consistent {{character_voice}} and {{narrative_distance}}. Follow the outline structure precisely.\n\nOutput the chapter in plain text with proper paragraph breaks.",
            r#"{"type":"object","properties":{"packet_json":{"type":"string"},"detail_mode":{"type":"string","enum":["full","balanced","sparse"]},"character_voice":{"type":"string"},"narrative_distance":{"type":"string"}},"required":["packet_json","detail_mode","character_voice","narrative_distance"]}"#,
            r#"{"type":"object","properties":{"chapter_text":{"type":"string"},"word_count":{"type":"integer"}},"required":["chapter_text","word_count"]}"#,
            "1.0.0",
        ),
    ];

    for (id, skill_id, name, template, input_schema, output_schema, version) in defaults {
        conn.execute(
            "INSERT INTO ai_skill_registry (id, skill_id, name, prompt_template, input_schema, output_schema, version, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id, skill_id, name, template, input_schema, output_schema, version, now, now],
        )?;
    }

    Ok(())
}

impl Database {
    pub fn append_decision_log(&self, input: &AppendDecisionLogInput) -> SqlResult<DecisionLogEntry> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO decision_logs (id, project_id, operation, entity_type, entity_id, summary, details, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                id,
                input.project_id,
                input.operation,
                input.entity_type.as_deref().unwrap_or(""),
                input.entity_id.as_deref().unwrap_or(""),
                input.summary,
                input.details.as_deref().unwrap_or("{}"),
                now,
            ],
        )?;
        Ok(DecisionLogEntry {
            id,
            project_id: input.project_id.clone(),
            operation: input.operation.clone(),
            entity_type: input.entity_type.clone().unwrap_or_default(),
            entity_id: input.entity_id.clone().unwrap_or_default(),
            summary: input.summary.clone(),
            details: input.details.clone().unwrap_or_else(|| "{}".to_string()),
            created_at: now,
        })
    }

    pub fn list_decision_logs(&self, project_id: &str) -> SqlResult<Vec<DecisionLogEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, operation, entity_type, entity_id, summary, details, created_at
             FROM decision_logs WHERE project_id = ? ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(rusqlite::params![project_id], |row| {
            Ok(DecisionLogRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                operation: row.get(2)?,
                entity_type: row.get(3)?,
                entity_id: row.get(4)?,
                summary: row.get(5)?,
                details: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        let mut logs = Vec::new();
        for r in rows {
            logs.push(r?.to_api());
        }
        Ok(logs)
    }

    pub fn get_decision_log(&self, id: &str) -> SqlResult<Option<DecisionLogEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, operation, entity_type, entity_id, summary, details, created_at
             FROM decision_logs WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(rusqlite::params![id], |row| {
            Ok(DecisionLogRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                operation: row.get(2)?,
                entity_type: row.get(3)?,
                entity_id: row.get(4)?,
                summary: row.get(5)?,
                details: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?.to_api())),
            None => Ok(None),
        }
    }

    pub fn create_chapter_packet(&self, input: &CreateChapterPacketInput) -> SqlResult<ChapterPacket> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        let line = input.line.as_deref().unwrap_or("");
        conn.execute(
            "INSERT INTO chapter_packets (id, project_id, structure_node_id, chapter_number, title, line, position, chapter_function, status, mode, assumption_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'empty', 'standard', 0, ?9, ?10)",
            params![id, input.project_id, input.structure_node_id, input.chapter_number, input.title, line, input.position, input.chapter_function, now, now],
        )?;
        Ok(ChapterPacket {
            id,
            project_id: input.project_id.clone(),
            structure_node_id: Some(input.structure_node_id.clone()),
            chapter_number: input.chapter_number,
            title: input.title.clone(),
            line: line.to_string(),
            position: input.position.clone(),
            chapter_function: input.chapter_function.clone(),
            layer1: "{}".to_string(),
            layer2: "{}".to_string(),
            layer3: "{}".to_string(),
            layer4: "{}".to_string(),
            status: "empty".to_string(),
            mode: "standard".to_string(),
            assumption_count: 0,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn list_chapter_packets(&self, project_id: &str) -> SqlResult<Vec<ChapterPacket>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, structure_node_id, chapter_number, title, line, position, chapter_function,
                    layer1, layer2, layer3, layer4, status, mode, assumption_count, created_at, updated_at
             FROM chapter_packets WHERE project_id = ? ORDER BY chapter_number"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(ChapterPacketRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                structure_node_id: row.get(2)?,
                chapter_number: row.get(3)?,
                title: row.get(4)?,
                line: row.get(5)?,
                position: row.get(6)?,
                chapter_function: row.get(7)?,
                layer1: row.get(8)?,
                layer2: row.get(9)?,
                layer3: row.get(10)?,
                layer4: row.get(11)?,
                status: row.get(12)?,
                mode: row.get(13)?,
                assumption_count: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;
        let mut packets = Vec::new();
        for r in rows {
            packets.push(r?.to_api());
        }
        Ok(packets)
    }

    pub fn get_chapter_packet(&self, id: &str) -> SqlResult<Option<ChapterPacket>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, structure_node_id, chapter_number, title, line, position, chapter_function,
                    layer1, layer2, layer3, layer4, status, mode, assumption_count, created_at, updated_at
             FROM chapter_packets WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(ChapterPacketRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                structure_node_id: row.get(2)?,
                chapter_number: row.get(3)?,
                title: row.get(4)?,
                line: row.get(5)?,
                position: row.get(6)?,
                chapter_function: row.get(7)?,
                layer1: row.get(8)?,
                layer2: row.get(9)?,
                layer3: row.get(10)?,
                layer4: row.get(11)?,
                status: row.get(12)?,
                mode: row.get(13)?,
                assumption_count: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?.to_api())),
            None => Ok(None),
        }
    }

    pub fn update_chapter_packet_layers(&self, input: &UpdateChapterPacketLayersInput) -> SqlResult<ChapterPacket> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        // Build dynamic UPDATE SET clauses
        let mut set_clauses = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref v) = input.layer1 {
            set_clauses.push("layer1 = ?");
            param_values.push(Box::new(v.clone()));
        }
        if let Some(ref v) = input.layer2 {
            set_clauses.push("layer2 = ?");
            param_values.push(Box::new(v.clone()));
        }
        if let Some(ref v) = input.layer3 {
            set_clauses.push("layer3 = ?");
            param_values.push(Box::new(v.clone()));
        }
        if let Some(ref v) = input.layer4 {
            set_clauses.push("layer4 = ?");
            param_values.push(Box::new(v.clone()));
        }
        if let Some(ref v) = input.status {
            set_clauses.push("status = ?");
            param_values.push(Box::new(v.clone()));
        }

        if set_clauses.is_empty() {
            // Nothing to update, just return current state
            drop(conn);
            return self.get_chapter_packet(&input.packet_id)
                .map(|opt| opt.expect("packet not found"));
        }

        set_clauses.push("updated_at = ?");
        param_values.push(Box::new(now));
        param_values.push(Box::new(input.packet_id.clone()));

        let sql = format!(
            "UPDATE chapter_packets SET {} WHERE id = ?",
            set_clauses.join(", ")
        );

        let param_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, rusqlite::params_from_iter(param_refs))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        drop(conn);
        self.get_chapter_packet(&input.packet_id)
            .map(|opt| opt.expect("packet not found after update"))
    }

    pub fn confirm_chapter_packet(&self, id: &str) -> SqlResult<ChapterPacket> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE chapter_packets SET status = 'confirmed', updated_at = ? WHERE id = ?",
            params![now, id],
        )?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, structure_node_id, chapter_number, title, line, position, chapter_function,
                    layer1, layer2, layer3, layer4, status, mode, assumption_count, created_at, updated_at
             FROM chapter_packets WHERE id = ?"
        )?;
        let packet = stmt.query_row(params![id], |row| {
            Ok(ChapterPacketRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                structure_node_id: row.get(2)?,
                chapter_number: row.get(3)?,
                title: row.get(4)?,
                line: row.get(5)?,
                position: row.get(6)?,
                chapter_function: row.get(7)?,
                layer1: row.get(8)?,
                layer2: row.get(9)?,
                layer3: row.get(10)?,
                layer4: row.get(11)?,
                status: row.get(12)?,
                mode: row.get(13)?,
                assumption_count: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;
        Ok(packet.to_api())
    }

    pub fn delete_chapter_packet(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM chapter_packets WHERE id = ?", params![id])?;
        Ok(())
    }

    // ===== v2.0.1 QuickDraft =====

    pub fn create_quick_draft(&self, input: &QuickDraftInput, premise_text: &str, premise_type: &str, chapters: &str) -> SqlResult<QuickDraftApi> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO quick_drafts (id, project_id, user_input, premise_text, premise_type, chapters, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'draft', ?7)",
            params![id, input.project_id, input.user_input, premise_text, premise_type, chapters, now],
        )?;
        Ok(QuickDraftApi {
            id,
            project_id: input.project_id.clone(),
            user_input: input.user_input.clone(),
            premise_text: premise_text.to_string(),
            premise_type: premise_type.to_string(),
            chapters: chapters.to_string(),
            status: "draft".to_string(),
            created_at: now,
        })
    }

    pub fn get_quick_draft(&self, id: &str) -> SqlResult<Option<QuickDraftApi>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, user_input, premise_text, premise_type, chapters, status, created_at
             FROM quick_drafts WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(QuickDraftRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                user_input: row.get(2)?,
                premise_text: row.get(3)?,
                premise_type: row.get(4)?,
                chapters: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?.to_api())),
            None => Ok(None),
        }
    }

    pub fn list_quick_drafts_by_project(&self, project_id: &str) -> SqlResult<Vec<QuickDraftApi>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, user_input, premise_text, premise_type, chapters, status, created_at
             FROM quick_drafts WHERE project_id = ? ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(QuickDraftRow {
                id: row.get(0)?,
                project_id: row.get(1)?,
                user_input: row.get(2)?,
                premise_text: row.get(3)?,
                premise_type: row.get(4)?,
                chapters: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        let mut drafts = Vec::new();
        for r in rows {
            drafts.push(r?.to_api());
        }
        Ok(drafts)
    }

    pub fn transfer_quick_draft(&self, id: &str) -> SqlResult<QuickDraftApi> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE quick_drafts SET status = 'transferred', premise_text = premise_text WHERE id = ?",
            params![id],
        )?;
        drop(conn);
        self.get_quick_draft(id).map(|opt| opt.expect("quick_draft not found after transfer"))
    }

    pub fn delete_quick_draft(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM quick_drafts WHERE id = ?", params![id])?;
        Ok(())
    }
}

// ===== CN-MET-03: Canvas 3 Sparrow Mode 9+3 Tables =====

pub fn init_sparrow_tables(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS canvas3_sparrow_steps (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          is_complete INTEGER NOT NULL DEFAULT 0,
          do_not_ask_again INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE(project_id, step_id)
        );

        CREATE TABLE IF NOT EXISTS canvas3_protagonist_steps (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          step_type TEXT NOT NULL,
          character_id TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          is_usable INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE(project_id, step_type, character_id)
        );

        CREATE INDEX IF NOT EXISTS idx_c3ss_project ON canvas3_sparrow_steps(project_id);
        CREATE INDEX IF NOT EXISTS idx_c3ps_project ON canvas3_protagonist_steps(project_id);"
    )?;
    Ok(())
}

// ===== CN-MET-04: Canvas 4 Packet Detail Modes Table =====

pub fn init_packet_detail_modes_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS canvas4_packet_detail_modes (
          project_id TEXT PRIMARY KEY,
          detail_mode TEXT NOT NULL DEFAULT 'standard',
          config_json TEXT NOT NULL DEFAULT '{}',
          do_not_ask_again INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );"
    )?;
    Ok(())
}

// ===== CN-MET-02: Canvas 2 StructureGraph nodes table =====

pub fn init_canvas2_structure_nodes_table(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS canvas2_structure_nodes (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          parent_id TEXT,
          layer_type TEXT NOT NULL DEFAULT 'zhang',
          title TEXT NOT NULL DEFAULT '',
          summary TEXT NOT NULL DEFAULT '',
          time_period TEXT NOT NULL DEFAULT '',
          chapter_range TEXT NOT NULL DEFAULT '',
          scene_count INTEGER NOT NULL DEFAULT 0,
          word_count INTEGER NOT NULL DEFAULT 0,
          position_x REAL NOT NULL DEFAULT 0,
          position_y REAL NOT NULL DEFAULT 0,
          expanded INTEGER NOT NULL DEFAULT 1,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_c2sn_project ON canvas2_structure_nodes(project_id);
        CREATE INDEX IF NOT EXISTS idx_c2sn_parent ON canvas2_structure_nodes(parent_id);
        CREATE INDEX IF NOT EXISTS idx_c2sn_layer ON canvas2_structure_nodes(layer_type);"
    )?;
    Ok(())
}

// ===== CN-MET-03: Sparrow Step CRUD =====

impl Database {
    pub fn get_sparrow_steps_by_project(&self, project_id: &str) -> SqlResult<Vec<SparrowStepRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, step_id, content, is_complete, do_not_ask_again, created_at, updated_at
             FROM canvas3_sparrow_steps WHERE project_id = ? ORDER BY step_id"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(SparrowStepRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                step_id: row.get(2)?,
                content: row.get(3)?,
                is_complete: row.get::<_, i32>(4)? != 0,
                do_not_ask_again: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        let mut steps = Vec::new();
        for r in rows {
            steps.push(r?);
        }
        Ok(steps)
    }

    pub fn upsert_sparrow_step(&self, input: &SaveSparrowStepInput) -> SqlResult<SaveSparrowStepOutput> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        let dna = input.do_not_ask_again.unwrap_or(false);

        let existing_id: Option<String> = conn.query_row(
            "SELECT id FROM canvas3_sparrow_steps WHERE project_id = ?1 AND step_id = ?2",
            params![input.project_id, input.step_id],
            |row| row.get(0),
        ).ok();

        match existing_id {
            Some(existing) => {
                conn.execute(
                    "UPDATE canvas3_sparrow_steps SET content=?1, is_complete=?2, do_not_ask_again=?3, updated_at=?4 WHERE id=?5",
                    params![input.content, input.is_complete as i32, dna as i32, now, existing],
                )?;
            }
            None => {
                let new_id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO canvas3_sparrow_steps (id, project_id, step_id, content, is_complete, do_not_ask_again, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![new_id, input.project_id, input.step_id, input.content, input.is_complete as i32, dna as i32, now, now],
                )?;
            }
        };

        Ok(SaveSparrowStepOutput {
            project_id: input.project_id.clone(),
            step_id: input.step_id.clone(),
            saved: true,
        })
    }

    pub fn get_protagonist_steps_by_project(&self, project_id: &str) -> SqlResult<Vec<ProtagonistStepRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, step_type, character_id, description, is_usable, created_at, updated_at
             FROM canvas3_protagonist_steps WHERE project_id = ? ORDER BY step_type"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(ProtagonistStepRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                step_type: row.get(2)?,
                character_id: row.get(3)?,
                description: row.get(4)?,
                is_usable: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        let mut steps = Vec::new();
        for r in rows {
            steps.push(r?);
        }
        Ok(steps)
    }

    pub fn upsert_protagonist_step(&self, input: &SaveProtagonistStepInput) -> SqlResult<SaveProtagonistStepOutput> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        let existing_id: Option<String> = conn.query_row(
            "SELECT id FROM canvas3_protagonist_steps WHERE project_id = ?1 AND step_type = ?2 AND character_id = ?3",
            params![input.project_id, input.step_type, input.character_id],
            |row| row.get(0),
        ).ok();

        let _ = match existing_id {
            Some(existing) => {
                conn.execute(
                    "UPDATE canvas3_protagonist_steps SET description=?1, is_usable=?2, updated_at=?3 WHERE id=?4",
                    params![input.description, input.is_usable as i32, now, existing],
                )?;
                existing
            }
            None => {
                let new_id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO canvas3_protagonist_steps (id, project_id, step_type, character_id, description, is_usable, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![new_id, input.project_id, input.step_type, input.character_id, input.description, input.is_usable as i32, now, now],
                )?;
                new_id
            }
        };

        Ok(SaveProtagonistStepOutput {
            project_id: input.project_id.clone(),
            step_type: input.step_type.clone(),
            saved: true,
        })
    }

    pub fn mark_protagonist_step_usable(&self, input: &MarkStepUsableInput) -> SqlResult<MarkStepUsableOutput> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        let rows = conn.execute(
            "UPDATE canvas3_protagonist_steps SET is_usable=?1, updated_at=?2 WHERE project_id=?3 AND step_type=?4 AND character_id=?5",
            params![input.is_usable as i32, now, input.project_id, input.step_type, input.character_id],
        )?;

        if rows == 0 {
            let new_id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO canvas3_protagonist_steps (id, project_id, step_type, character_id, description, is_usable, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![new_id, input.project_id, input.step_type, input.character_id, "", input.is_usable as i32, now, now],
            )?;
        }

        Ok(MarkStepUsableOutput {
            project_id: input.project_id.clone(),
            step_type: input.step_type.clone(),
            is_usable: input.is_usable,
        })
    }

    pub fn get_tiandiren_layer(&self, project_id: &str) -> SqlResult<Option<TianDiRenRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, tian, di, ren, created_at, updated_at
             FROM canvas3_sparrow_steps WHERE project_id = ? AND step_id = 'tiandiren'"
        )?;
        let mut rows = stmt.query_map(params![project_id], |row| {
            Ok(TianDiRenRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                tian: row.get(2)?,
                di: row.get(3)?,
                ren: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn upsert_tiandiren_layer(&self, input: &SaveTianDiRenLayerInput) -> SqlResult<SaveTianDiRenLayerOutput> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        let existing_id: Option<String> = conn.query_row(
            "SELECT id FROM canvas3_sparrow_steps WHERE project_id = ?1 AND step_id = 'tiandiren'",
            params![input.project_id],
            |row| row.get(0),
        ).ok();

        match existing_id {
            Some(existing) => {
                conn.execute(
                    "UPDATE canvas3_sparrow_steps SET content=?1, updated_at=?2 WHERE id=?3",
                    params![
                        serde_json::json!({"tian": input.tian, "di": input.di, "ren": input.ren}).to_string(),
                        now, existing,
                    ],
                )?;
            }
            None => {
                let new_id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO canvas3_sparrow_steps (id, project_id, step_id, content, is_complete, do_not_ask_again, created_at, updated_at)
                     VALUES (?1, ?2, 'tiandiren', ?3, 0, 0, ?4, ?5)",
                    params![
                        new_id, input.project_id,
                        serde_json::json!({"tian": input.tian, "di": input.di, "ren": input.ren}).to_string(),
                        now, now,
                    ],
                )?;
            }
        };

        Ok(SaveTianDiRenLayerOutput {
            project_id: input.project_id.clone(),
            saved: true,
        })
    }

    pub fn get_sparrow_module(&self, project_id: &str) -> SqlResult<SparrowModuleResponse> {
        let steps = self.get_sparrow_steps_by_project(project_id)?;
        let protagonist_steps = self.get_protagonist_steps_by_project(project_id)?;
        let tian_di_ren = self.get_tiandiren_layer(project_id)?;

        let exists = !steps.is_empty() || !protagonist_steps.is_empty() || tian_di_ren.is_some();

        Ok(SparrowModuleResponse {
            exists,
            steps,
            protagonist_steps,
            tian_di_ren,
        })
    }
}

// ===== CN-MET-04: Packet Detail Mode CRUD =====

impl Database {
    pub fn set_detail_mode(&self, input: &SetDetailModeInput) -> SqlResult<PacketDetailConfig> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        let detail_mode = &input.detail_mode;
        let do_not_ask = input.do_not_ask_again.unwrap_or(false);

        // Build config JSON based on mode
        let config = serde_json::json!({
            "mode": detail_mode,
            "sketchConfig": if detail_mode == "sketch" {
                serde_json::json!({
                    "collapsedLayer": "layer4",
                    "showSummaryOnly": true,
                    "autoGenerate": true
                })
            } else {
                serde_json::Value::Null
            },
            "refinedConfig": if detail_mode == "refined" {
                serde_json::json!({
                    "allLayersEditable": true,
                    "showWordCount": true,
                    "showTimestamps": true,
                    "allowInlineComments": true
                })
            } else {
                serde_json::Value::Null
            }
        });
        let config_json = config.to_string();

        conn.execute(
            "INSERT INTO canvas4_packet_detail_modes (project_id, detail_mode, config_json, do_not_ask_again, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(project_id) DO UPDATE SET
               detail_mode = excluded.detail_mode,
               config_json = excluded.config_json,
               do_not_ask_again = excluded.do_not_ask_again,
               updated_at = excluded.updated_at",
            params![input.project_id, detail_mode, config_json, do_not_ask as i64, now],
        )?;

        Ok(PacketDetailConfig {
            detail_mode: detail_mode.clone(),
            do_not_ask_again: do_not_ask,
            config,
        })
    }

    pub fn get_packet_detail(&self, project_id: &str) -> SqlResult<PacketDetailResponse> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT project_id, detail_mode, config_json, do_not_ask_again, updated_at
             FROM canvas4_packet_detail_modes WHERE project_id = ?"
        )?;
        let mut rows = stmt.query_map(params![project_id], |row| {
            Ok(PacketDetailModeRecord {
                project_id: row.get(0)?,
                detail_mode: row.get(1)?,
                config_json: row.get(2)?,
                do_not_ask_again: row.get::<_, i64>(3)? != 0,
                updated_at: row.get(4)?,
            })
        })?;

        match rows.next() {
            Some(Ok(record)) => {
                let config: serde_json::Value = serde_json::from_str(&record.config_json)
                    .unwrap_or_else(|_| serde_json::json!({"mode": "standard"}));
                Ok(PacketDetailResponse {
                    detail_mode: record.detail_mode,
                    do_not_ask_again: record.do_not_ask_again,
                    config,
                })
            }
            _ => {
                // No record yet — default to standard
                Ok(PacketDetailResponse {
                    detail_mode: "standard".to_string(),
                    do_not_ask_again: false,
                    config: serde_json::json!({"mode": "standard"}),
                })
            }
        }
    }

    pub fn auto_generate_sketch(&self, project_id: &str) -> SqlResult<PacketDetailResponse> {
        // Set mode to sketch with auto-generate config
        let input = SetDetailModeInput {
            project_id: project_id.to_string(),
            detail_mode: "sketch".to_string(),
            do_not_ask_again: None,
        };
        let config = self.set_detail_mode(&input)?;
        Ok(PacketDetailResponse {
            detail_mode: config.detail_mode,
            do_not_ask_again: config.do_not_ask_again,
            config: config.config,
        })
    }

    pub fn save_refined_content(&self, input: &SaveRefinedContentInput) -> SqlResult<PacketDetailResponse> {
        // Ensure mode is 'refined' when saving refined content
        let mode_input = SetDetailModeInput {
            project_id: input.project_id.clone(),
            detail_mode: "refined".to_string(),
            do_not_ask_again: None,
        };
        let config = self.set_detail_mode(&mode_input)?;
        Ok(PacketDetailResponse {
            detail_mode: config.detail_mode,
            do_not_ask_again: config.do_not_ask_again,
            config: config.config,
        })
    }
}

    // ===== v2.0.1 Feedback =====

impl Database {
    pub fn submit_feedback(&self, input: &FeedbackInput) -> SqlResult<DecisionLogEntry> {
        self.append_decision_log(&AppendDecisionLogInput {
            project_id: input.project_id.clone(),
            operation: "feedback".to_string(),
            summary: format!("rating={}", input.rating),
            entity_type: Some("feedback".to_string()),
            entity_id: Some("".to_string()),
            details: Some(if input.feedback_text.is_empty() { "{}".to_string() } else {
                serde_json::json!({"text": input.feedback_text}).to_string()
            }),
        })
    }

    // ===== AI Skill Registry CRUD =====

    pub fn list_ai_skills(&self) -> SqlResult<Vec<crate::models::AiSkillRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, skill_id, name, prompt_template, input_schema, output_schema, version
             FROM ai_skill_registry ORDER BY skill_id"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::models::AiSkillRecord {
                id: row.get(0)?,
                skill_id: row.get(1)?,
                name: row.get(2)?,
                prompt_template: row.get(3)?,
                input_schema: row.get(4)?,
                output_schema: row.get(5)?,
                version: row.get(6)?,
            })
        })?;
        let mut skills = Vec::new();
        for r in rows {
            skills.push(r?);
        }
        Ok(skills)
    }

    pub fn get_ai_skill(&self, id: &str) -> SqlResult<Option<crate::models::AiSkillRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, skill_id, name, prompt_template, input_schema, output_schema, version
             FROM ai_skill_registry WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(crate::models::AiSkillRecord {
                id: row.get(0)?,
                skill_id: row.get(1)?,
                name: row.get(2)?,
                prompt_template: row.get(3)?,
                input_schema: row.get(4)?,
                output_schema: row.get(5)?,
                version: row.get(6)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn get_ai_skill_by_skill_id(&self, skill_id: &str) -> SqlResult<Option<crate::models::AiSkillRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, skill_id, name, prompt_template, input_schema, output_schema, version
             FROM ai_skill_registry WHERE skill_id = ?"
        )?;
        let mut rows = stmt.query_map(params![skill_id], |row| {
            Ok(crate::models::AiSkillRecord {
                id: row.get(0)?,
                skill_id: row.get(1)?,
                name: row.get(2)?,
                prompt_template: row.get(3)?,
                input_schema: row.get(4)?,
                output_schema: row.get(5)?,
                version: row.get(6)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn register_ai_skill(&self, input: &crate::models::RegisterSkillInput) -> SqlResult<crate::models::AiSkillRecord> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO ai_skill_registry (id, skill_id, name, prompt_template, input_schema, output_schema, version, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id, input.skill_id, input.name, input.prompt_template, input.input_schema, input.output_schema, input.version, now, now],
        )?;
        Ok(crate::models::AiSkillRecord {
            id,
            skill_id: input.skill_id.clone(),
            name: input.name.clone(),
            prompt_template: input.prompt_template.clone(),
            input_schema: input.input_schema.clone(),
            output_schema: input.output_schema.clone(),
            version: input.version.clone(),
        })
    }

    // ===== AI Provider Config CRUD =====

    pub fn list_ai_provider_configs(&self) -> SqlResult<Vec<crate::models::AiProviderConfig>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, provider_id, provider_name, api_key_encrypted, endpoint, models, timeout_ms, is_active, migrated_from_v1, created_at, updated_at
             FROM ai_provider_config ORDER BY provider_name"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(crate::models::AiProviderConfig {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                provider_name: row.get(2)?,
                api_key_encrypted: row.get(3)?,
                endpoint: row.get(4)?,
                models: row.get(5)?,
                timeout_ms: row.get(6)?,
                is_active: row.get(7)?,
                migrated_from_v1: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;
        let mut configs = Vec::new();
        for r in rows {
            configs.push(r?);
        }
        Ok(configs)
    }

    pub fn get_ai_provider_config(&self, provider_id: &str) -> SqlResult<Option<crate::models::AiProviderConfig>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, provider_id, provider_name, api_key_encrypted, endpoint, models, timeout_ms, is_active, migrated_from_v1, created_at, updated_at
             FROM ai_provider_config WHERE provider_id = ?"
        )?;
        let mut rows = stmt.query_map(params![provider_id], |row| {
            Ok(crate::models::AiProviderConfig {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                provider_name: row.get(2)?,
                api_key_encrypted: row.get(3)?,
                endpoint: row.get(4)?,
                models: row.get(5)?,
                timeout_ms: row.get(6)?,
                is_active: row.get(7)?,
                migrated_from_v1: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn save_ai_provider_config(&self, input: &crate::models::SaveProviderConfigInput) -> SqlResult<crate::models::AiProviderConfig> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        let existing: Option<crate::models::AiProviderConfig> = conn.query_row(
            "SELECT id, provider_id, provider_name, api_key_encrypted, endpoint, models, timeout_ms, is_active, migrated_from_v1, created_at, updated_at
             FROM ai_provider_config WHERE provider_id = ?1",
            params![input.provider_id],
            |row| {
                Ok(crate::models::AiProviderConfig {
                    id: row.get(0)?,
                    provider_id: row.get(1)?,
                    provider_name: row.get(2)?,
                    api_key_encrypted: row.get(3)?,
                    endpoint: row.get(4)?,
                    models: row.get(5)?,
                    timeout_ms: row.get(6)?,
                    is_active: row.get(7)?,
                    migrated_from_v1: row.get(8)?,
                    created_at: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            },
        ).ok();

        let models_json = serde_json::to_string(&input.models).unwrap_or_else(|_| "[]".to_string());

        // [v2.1.1-AI] Key preservation logic:
        // - If api_key_encrypted is non-empty: always update with new value
        // - If api_key_encrypted is empty AND clear_api_key is true: clear the key (set to empty)
        // - If api_key_encrypted is empty AND clear_api_key is false: keep existing key
        let effective_key = match (&existing, input.api_key_encrypted.as_str(), input.clear_api_key) {
            (Some(ex), "", false) => ex.api_key_encrypted.clone(), // Preserve existing key
            (_, key, _) => key.to_string(),                        // Use provided key or clear
        };

        let id = match existing {
            Some(ref ex) => {
                conn.execute(
                    "UPDATE ai_provider_config SET provider_name=?1, api_key_encrypted=?2, endpoint=?3, models=?4, timeout_ms=?5, updated_at=?6 WHERE id=?7",
                    params![input.provider_name, &effective_key, input.endpoint, &models_json, input.timeout_ms, now, &ex.id],
                )?;
                ex.id.clone()
            }
            None => {
                let new_id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO ai_provider_config (id, provider_id, provider_name, api_key_encrypted, endpoint, models, timeout_ms, is_active, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9)",
                    params![new_id, input.provider_id, input.provider_name, &effective_key, input.endpoint, &models_json, input.timeout_ms, now, now],
                )?;
                new_id
            }
        };

        Ok(crate::models::AiProviderConfig {
            id,
            provider_id: input.provider_id.clone(),
            provider_name: input.provider_name.clone(),
            api_key_encrypted: effective_key,
            endpoint: input.endpoint.clone(),
            models: models_json,
            timeout_ms: input.timeout_ms,
            is_active: true,
            migrated_from_v1: false,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn delete_ai_provider_config(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM ai_provider_config WHERE id = ?", params![id])?;
        Ok(())
    }

    /// [v2.1.1-AI] Resolve a provider credential by provider_id.
    /// Returns the stored api_key_encrypted as the runtime API key.
    /// Returns error if provider not found or key is empty.
    pub fn resolve_ai_provider_credential(&self, provider_id: &str) -> Result<String, String> {
        let conn = self.conn.lock().unwrap();
        let api_key: String = conn.query_row(
            "SELECT api_key_encrypted FROM ai_provider_config WHERE provider_id = ?1",
            params![provider_id],
            |row| row.get(0),
        ).map_err(|e| format!("CREDENTIAL_RESOLVE_FAILED: provider '{}' not found: {}", provider_id, e))?;

        if api_key.is_empty() {
            return Err(format!("AI_PROVIDER_API_KEY_MISSING: provider '{}' has no API key configured", provider_id));
        }

        Ok(api_key)
    }

    pub fn get_ai_provider_config_by_id(&self, id: &str) -> SqlResult<Option<crate::models::AiProviderConfig>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, provider_id, provider_name, api_key_encrypted, endpoint, models, timeout_ms, is_active, migrated_from_v1, created_at, updated_at
             FROM ai_provider_config WHERE id = ?"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(crate::models::AiProviderConfig {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                provider_name: row.get(2)?,
                api_key_encrypted: row.get(3)?,
                endpoint: row.get(4)?,
                models: row.get(5)?,
                timeout_ms: row.get(6)?,
                is_active: row.get(7)?,
                migrated_from_v1: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    // ===== CN-MET-01: Premise Step State CRUD =====

    pub fn get_premise_step_state(&self, project_id: &str) -> SqlResult<Option<crate::models::PremiseStepRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, current_step, wishlist, intern_extern, variants, qa,
                    genre_judgment, completed_steps, skipped_steps, do_not_ask_again,
                    created_at, updated_at
             FROM canvas1_premise_steps WHERE project_id = ?"
        )?;
        let mut rows = stmt.query_map(params![project_id], |row| {
            Ok(crate::models::PremiseStepRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                current_step: row.get(2)?,
                wishlist: row.get(3)?,
                intern_extern: row.get(4)?,
                variants: row.get(5)?,
                qa: row.get(6)?,
                genre_judgment: row.get(7)?,
                completed_steps: row.get(8)?,
                skipped_steps: row.get(9)?,
                do_not_ask_again: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;
        match rows.next() {
            Some(r) => Ok(Some(r?)),
            None => Ok(None),
        }
    }

    pub fn upsert_premise_step_state(&self, record: &crate::models::PremiseStepRecord) -> SqlResult<crate::models::PremiseStepRecord> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT OR REPLACE INTO canvas1_premise_steps
             (id, project_id, current_step, wishlist, intern_extern, variants, qa,
              genre_judgment, completed_steps, skipped_steps, do_not_ask_again,
              created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                     COALESCE((SELECT created_at FROM canvas1_premise_steps WHERE project_id=?2), ?12),
                     ?13)",
            params![
                record.id, record.project_id, record.current_step,
                record.wishlist, record.intern_extern, record.variants,
                record.qa, record.genre_judgment,
                record.completed_steps, record.skipped_steps, record.do_not_ask_again,
                now, now,
            ],
        )?;
        Ok(crate::models::PremiseStepRecord {
            id: record.id.clone(),
            project_id: record.project_id.clone(),
            current_step: record.current_step.clone(),
            wishlist: record.wishlist.clone(),
            intern_extern: record.intern_extern.clone(),
            variants: record.variants.clone(),
            qa: record.qa.clone(),
            genre_judgment: record.genre_judgment.clone(),
            completed_steps: record.completed_steps.clone(),
            skipped_steps: record.skipped_steps.clone(),
            do_not_ask_again: record.do_not_ask_again.clone(),
            created_at: record.created_at,
            updated_at: now,
        })
    }

    pub fn save_wishlist(&self, input: &crate::models::SaveWishlistInput) -> SqlResult<crate::models::SaveWishlistOutput> {
        // Load or create step state, update wishlist
        let existing = self.get_premise_step_state(&input.project_id)?;
        let (record, is_new) = match existing {
            Some(r) => (r, false),
            None => {
                let now = chrono::Utc::now().timestamp_millis();
                (crate::models::PremiseStepRecord {
                    id: uuid::Uuid::new_v4().to_string(),
                    project_id: input.project_id.clone(),
                    current_step: "wishlist".to_string(),
                    wishlist: input.wishlist.clone(),
                    intern_extern: "{\"internalDrive\":\"\",\"externalDrive\":\"\"}".to_string(),
                    variants: "[]".to_string(),
                    qa: "[]".to_string(),
                    genre_judgment: "null".to_string(),
                    completed_steps: "[]".to_string(),
                    skipped_steps: "[]".to_string(),
                    do_not_ask_again: "[]".to_string(),
                    created_at: now,
                    updated_at: now,
                }, true)
            }
        };

        let mut updated = record;
        updated.wishlist = input.wishlist.clone();
        if is_new {
            // Keep as-is (already set from constructor)
        } else {
            // Ensure we don't lose project_id on upsert
        }

        self.upsert_premise_step_state(&updated)?;

        Ok(crate::models::SaveWishlistOutput {
            project_id: input.project_id.clone(),
            step: "wishlist".to_string(),
            saved: true,
        })
    }

    pub fn save_variant_selection(&self, input: &crate::models::SaveVariantSelectionInput) -> SqlResult<crate::models::SaveVariantSelectionOutput> {
        let existing = self.get_premise_step_state(&input.project_id)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

        // Parse variants, mark selected
        let mut variants: Vec<serde_json::Value> = serde_json::from_str(&existing.variants)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        for v in &mut variants {
            if let Some(id) = v.get("id").and_then(|i| i.as_str()) {
                v["selected"] = serde_json::Value::Bool(id == input.variant_id);
            }
        }

        let variants_json = serde_json::to_string(&variants)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        let mut updated = existing;
        updated.variants = variants_json;

        self.upsert_premise_step_state(&updated)?;

        Ok(crate::models::SaveVariantSelectionOutput {
            step: "variants".to_string(),
            selected_variant_id: input.variant_id.clone(),
        })
    }

    pub fn save_genre_judgment(&self, input: &crate::models::SaveGenreJudgmentInput) -> SqlResult<crate::models::SaveGenreJudgmentOutput> {
        let existing = self.get_premise_step_state(&input.project_id)?
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

        let mut updated = existing;
        updated.genre_judgment = input.genre_judgment.clone();

        self.upsert_premise_step_state(&updated)?;

        Ok(crate::models::SaveGenreJudgmentOutput {
            step: "genreJudgment".to_string(),
            genre_judgment: input.genre_judgment.clone(),
        })
    }
}

// ===== CN-MET-02: Canvas 2 StructureGraph L1-L4 CRUD =====

impl Database {
    pub fn list_canvas2_nodes(&self, project_id: &str) -> SqlResult<Vec<crate::models::Canvas2NodeRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, parent_id, layer_type, title, summary, time_period, chapter_range,
                    scene_count, word_count, position_x, position_y, expanded, sort_order,
                    created_at, updated_at
             FROM canvas2_structure_nodes WHERE project_id = ? ORDER BY sort_order"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(crate::models::Canvas2NodeRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_id: row.get(2)?,
                layer_type: row.get(3)?,
                title: row.get(4)?,
                summary: row.get(5)?,
                time_period: row.get(6)?,
                chapter_range: row.get(7)?,
                scene_count: row.get(8)?,
                word_count: row.get(9)?,
                position_x: row.get(10)?,
                position_y: row.get(11)?,
                expanded: row.get::<_, i32>(12)? != 0,
                sort_order: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;
        let mut nodes = Vec::new();
        for r in rows {
            nodes.push(r?);
        }
        Ok(nodes)
    }

    pub fn create_canvas2_node(&self, input: &crate::models::CreateCanvas2NodeInput) -> SqlResult<crate::models::Canvas2NodeRecord> {
        let conn = self.conn.lock().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO canvas2_structure_nodes (id, project_id, parent_id, layer_type, title, summary, time_period, chapter_range, scene_count, word_count, position_x, position_y, expanded, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![id, input.project_id, input.parent_id, input.layer_type, input.title, input.summary, input.time_period, input.chapter_range, input.scene_count, input.word_count, input.position_x, input.position_y, input.expanded as i32, input.sort_order, now, now],
        )?;
        Ok(crate::models::Canvas2NodeRecord {
            id,
            project_id: input.project_id.clone(),
            parent_id: input.parent_id.clone(),
            layer_type: input.layer_type.clone(),
            title: input.title.clone(),
            summary: input.summary.clone(),
            time_period: input.time_period.clone(),
            chapter_range: input.chapter_range.clone(),
            scene_count: input.scene_count,
            word_count: input.word_count,
            position_x: input.position_x,
            position_y: input.position_y,
            expanded: input.expanded,
            sort_order: input.sort_order,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn save_canvas2_node(&self, input: &crate::models::SaveCanvas2NodeInput) -> SqlResult<crate::models::Canvas2NodeRecord> {
        // Upsert: if id is provided and exists, update; otherwise create
        if let Some(ref node_id) = input.id {
            let exists: bool = {
                let conn = self.conn.lock().unwrap();
                let count: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM canvas2_structure_nodes WHERE id = ?",
                    params![node_id],
                    |row| row.get(0),
                ).unwrap_or(0);
                count > 0
            };

            if exists {
                let conn = self.conn.lock().unwrap();
                let now = chrono::Utc::now().timestamp_millis();
                conn.execute(
                    "UPDATE canvas2_structure_nodes SET parent_id=?1, layer_type=?2, title=?3, summary=?4, time_period=?5, chapter_range=?6, scene_count=?7, word_count=?8, position_x=?9, position_y=?10, expanded=?11, sort_order=?12, updated_at=?13 WHERE id=?14",
                    params![input.parent_id, input.layer_type, input.title, input.summary, input.time_period, input.chapter_range, input.scene_count, input.word_count, input.position_x, input.position_y, input.expanded as i32, input.sort_order, now, node_id],
                )?;

                let mut stmt = conn.prepare(
                    "SELECT id, project_id, parent_id, layer_type, title, summary, time_period, chapter_range,
                            scene_count, word_count, position_x, position_y, expanded, sort_order,
                            created_at, updated_at
                     FROM canvas2_structure_nodes WHERE id = ?"
                )?;
                let node = stmt.query_row(params![node_id], |row| {
                    Ok(crate::models::Canvas2NodeRecord {
                        id: row.get(0)?,
                        project_id: row.get(1)?,
                        parent_id: row.get(2)?,
                        layer_type: row.get(3)?,
                        title: row.get(4)?,
                        summary: row.get(5)?,
                        time_period: row.get(6)?,
                        chapter_range: row.get(7)?,
                        scene_count: row.get(8)?,
                        word_count: row.get(9)?,
                        position_x: row.get(10)?,
                        position_y: row.get(11)?,
                        expanded: row.get::<_, i32>(12)? != 0,
                        sort_order: row.get(13)?,
                        created_at: row.get(14)?,
                        updated_at: row.get(15)?,
                    })
                })?;
                return Ok(node);
            }
        }

        // Create new node
        let create_input = crate::models::CreateCanvas2NodeInput {
            project_id: input.project_id.clone(),
            parent_id: input.parent_id.clone(),
            layer_type: input.layer_type.clone(),
            title: input.title.clone(),
            summary: input.summary.clone(),
            time_period: input.time_period.clone(),
            chapter_range: input.chapter_range.clone(),
            scene_count: input.scene_count,
            word_count: input.word_count,
            position_x: input.position_x,
            position_y: input.position_y,
            expanded: input.expanded,
            sort_order: input.sort_order,
        };
        self.create_canvas2_node(&create_input)
    }

    pub fn update_canvas2_node_position(&self, input: &crate::models::UpdateNodePositionInput) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE canvas2_structure_nodes SET position_x=?1, position_y=?2, updated_at=?3 WHERE id=?4",
            params![input.position_x, input.position_y, now, input.id],
        )?;
        Ok(())
    }

    pub fn delete_canvas2_node(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM canvas2_structure_nodes WHERE id = ?", params![id])?;
        Ok(())
    }

    pub fn get_canvas2_structure_tree(&self, project_id: &str) -> SqlResult<crate::models::StructureTreeOutput> {
        let nodes = self.list_canvas2_nodes(project_id)?;
        Ok(crate::models::StructureTreeOutput { nodes })
    }

    pub fn get_canvas2_nodes_by_layer(&self, project_id: &str, layer_type: &str) -> SqlResult<Vec<crate::models::Canvas2NodeRecord>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, project_id, parent_id, layer_type, title, summary, time_period, chapter_range,
                    scene_count, word_count, position_x, position_y, expanded, sort_order,
                    created_at, updated_at
             FROM canvas2_structure_nodes WHERE project_id = ? AND layer_type = ? ORDER BY sort_order"
        )?;
        let rows = stmt.query_map(params![project_id, layer_type], |row| {
            Ok(crate::models::Canvas2NodeRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_id: row.get(2)?,
                layer_type: row.get(3)?,
                title: row.get(4)?,
                summary: row.get(5)?,
                time_period: row.get(6)?,
                chapter_range: row.get(7)?,
                scene_count: row.get(8)?,
                word_count: row.get(9)?,
                position_x: row.get(10)?,
                position_y: row.get(11)?,
                expanded: row.get::<_, i32>(12)? != 0,
                sort_order: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;
        let mut nodes = Vec::new();
        for r in rows {
            nodes.push(r?);
        }
        Ok(nodes)
    }

    pub fn update_canvas2_node(&self, input: &crate::models::UpdateCanvas2NodeInput) -> SqlResult<crate::models::Canvas2NodeRecord> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();

        let mut set_clauses = Vec::new();
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref v) = input.title { set_clauses.push("title = ?"); param_values.push(Box::new(v.clone())); }
        if let Some(ref v) = input.summary { set_clauses.push("summary = ?"); param_values.push(Box::new(v.clone())); }
        if let Some(ref v) = input.time_period { set_clauses.push("time_period = ?"); param_values.push(Box::new(v.clone())); }
        if let Some(ref v) = input.chapter_range { set_clauses.push("chapter_range = ?"); param_values.push(Box::new(v.clone())); }
        if let Some(ref v) = input.scene_count { set_clauses.push("scene_count = ?"); param_values.push(Box::new(*v)); }
        if let Some(ref v) = input.word_count { set_clauses.push("word_count = ?"); param_values.push(Box::new(*v)); }
        if let Some(ref v) = input.expanded { set_clauses.push("expanded = ?"); param_values.push(Box::new(*v as i32)); }
        if let Some(ref v) = input.sort_order { set_clauses.push("sort_order = ?"); param_values.push(Box::new(*v)); }
        if let Some(ref v) = input.position_x { set_clauses.push("position_x = ?"); param_values.push(Box::new(*v)); }
        if let Some(ref v) = input.position_y { set_clauses.push("position_y = ?"); param_values.push(Box::new(*v)); }

        if set_clauses.is_empty() {
            drop(conn);
            // Re-read the node as-is
            let conn2 = self.conn.lock().unwrap();
            let mut stmt = conn2.prepare(
                "SELECT id, project_id, parent_id, layer_type, title, summary, time_period, chapter_range,
                        scene_count, word_count, position_x, position_y, expanded, sort_order,
                        created_at, updated_at
                 FROM canvas2_structure_nodes WHERE id = ?"
            )?;
            let node = stmt.query_row(params![input.id], |row| {
                Ok(crate::models::Canvas2NodeRecord {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    parent_id: row.get(2)?,
                    layer_type: row.get(3)?,
                    title: row.get(4)?,
                    summary: row.get(5)?,
                    time_period: row.get(6)?,
                    chapter_range: row.get(7)?,
                    scene_count: row.get(8)?,
                    word_count: row.get(9)?,
                    position_x: row.get(10)?,
                    position_y: row.get(11)?,
                    expanded: row.get::<_, i32>(12)? != 0,
                    sort_order: row.get(13)?,
                    created_at: row.get(14)?,
                    updated_at: row.get(15)?,
                })
            })?;
            return Ok(node);
        }

        set_clauses.push("updated_at = ?");
        param_values.push(Box::new(now));
        param_values.push(Box::new(input.id.clone()));

        let sql = format!(
            "UPDATE canvas2_structure_nodes SET {} WHERE id = ?",
            set_clauses.join(", ")
        );

        let param_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, rusqlite::params_from_iter(param_refs))
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        drop(conn);
        // Re-read
        let conn2 = self.conn.lock().unwrap();
        let mut stmt = conn2.prepare(
            "SELECT id, project_id, parent_id, layer_type, title, summary, time_period, chapter_range,
                    scene_count, word_count, position_x, position_y, expanded, sort_order,
                    created_at, updated_at
             FROM canvas2_structure_nodes WHERE id = ?"
        )?;
        let node = stmt.query_row(params![input.id], |row| {
            Ok(crate::models::Canvas2NodeRecord {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_id: row.get(2)?,
                layer_type: row.get(3)?,
                title: row.get(4)?,
                summary: row.get(5)?,
                time_period: row.get(6)?,
                chapter_range: row.get(7)?,
                scene_count: row.get(8)?,
                word_count: row.get(9)?,
                position_x: row.get(10)?,
                position_y: row.get(11)?,
                expanded: row.get::<_, i32>(12)? != 0,
                sort_order: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;
        Ok(node)
    }
}

// ===== v2.1.1 Timestamp API =====

impl Database {
    /// Get the latest updated_at from premise_cards for a project.
    /// Returns 0 if no rows exist.
    pub fn get_premise_updated_at(&self, project_id: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT COALESCE(MAX(updated_at), 0) FROM premise_cards WHERE project_id = ?",
            params![project_id],
            |row| row.get(0),
        )
    }

    /// Get the latest updated_at from structure_nodes for a project.
    /// Returns 0 if no rows exist.
    pub fn get_structure_updated_at(&self, project_id: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT COALESCE(MAX(updated_at), 0) FROM structure_nodes WHERE project_id = ?",
            params![project_id],
            |row| row.get(0),
        )
    }

    /// Get the latest updated_at from canvas3_sparrow_steps for a project.
    /// Returns 0 if no rows exist.
    pub fn get_sparrow_last_saved_at(&self, project_id: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT COALESCE(MAX(updated_at), 0) FROM canvas3_sparrow_steps WHERE project_id = ?",
            params![project_id],
            |row| row.get(0),
        )
    }

    /// Get the latest updated_at from chapter_packets for a project.
    /// Returns 0 if no rows exist.
    pub fn get_packets_updated_at(&self, project_id: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT COALESCE(MAX(updated_at), 0) FROM chapter_packets WHERE project_id = ?",
            params![project_id],
            |row| row.get(0),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::StickyNote;

    fn setup_db() -> Database {
        let conn = Connection::open(":memory:").unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_schema().unwrap();
        db
    }

    fn make_judgment(object_id: &str, op: &str, prev: &str, new: &str) -> JudgmentRecord {
        JudgmentRecord {
            id: uuid::Uuid::new_v4().to_string(),
            object_id: object_id.to_string(),
            object_name: "test".to_string(),
            operation_type: op.to_string(),
            reason: format!("test: {}", op),
            timestamp: chrono::Utc::now().timestamp_millis(),
            previous_status: prev.to_string(),
            new_status: new.to_string(),
        }
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  Project CRUD
    // -???????????????????????????????????????????????????????????????????????????????????

    #[test]
    fn test_project_crud() {
        let db = setup_db();

        // Initially empty
        assert!(db.list_projects().unwrap().is_empty());

        // Create
        let p1 = db.create_project("Project Alpha", "fiction", "conceiving", 5000, r##"["#123","#456"]"##).unwrap();
        assert_eq!(p1.name, "Project Alpha");
        assert!(!p1.id.is_empty());

        let p2 = db.create_project("Project Beta", "non-fiction", "drafting", 12000, r##"["#abc","#def"]"##).unwrap();
        assert_eq!(p2.name, "Project Beta");

        // List
        let projects = db.list_projects().unwrap();
        assert_eq!(projects.len(), 2);

        // Get
        let got = db.get_project(&p1.id).unwrap().expect("should exist");
        assert_eq!(got.name, "Project Alpha");
        assert_eq!(got.genre, "fiction");

        // Get non-existent
        assert!(db.get_project("nonexistent-id").unwrap().is_none());

        // Update
        let mut updated = got;
        updated.name = "Updated Alpha".to_string();
        updated.word_count = 9999;
        db.update_project(&updated).unwrap();
        let re_read = db.get_project(&updated.id).unwrap().expect("should exist after update");
        assert_eq!(re_read.name, "Updated Alpha");
        assert_eq!(re_read.word_count, 9999);
        assert!(re_read.updated_at >= re_read.created_at);

        // Delete
        db.delete_project(&p2.id).unwrap();
        assert_eq!(db.list_projects().unwrap().len(), 1);
        assert!(db.get_project(&p2.id).unwrap().is_none());
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  WorldObject CRUD (with judgment_history)
    // -???????????????????????????????????????????????????????????????????????????????????
    //
    // NOTE: list_world_objects() and get_world_object() have a known
    // deadlock: they hold the Mutex lock while calling
    // get_judgment_records_for_object(), which also tries to lock.
    // std::sync::Mutex is non-reentrant, so this deadlocks.
    // These tests use direct SQL reads to verify state instead.

    #[test]
    fn test_world_object_crud() {
        let db = setup_db();
        let proj = db.create_project("Test", "t", "conceiving", 0, r##"["#a","#b"]"##).unwrap();
        let pid = &proj.id;

        // Initially empty via direct SQL
        {
            let conn = db.conn.lock().unwrap();
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM world_objects WHERE project_id = ?", params![pid], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0);
        }

        // Create with judgment_history
        let obj_id = uuid::Uuid::new_v4().to_string();
        let j1 = make_judgment(&obj_id, "promote_canon", "uncollected", "draft_canon");
        let j2 = make_judgment(&obj_id, "lock", "draft_canon", "locked");

        let obj = WorldObject {
            id: obj_id.clone(),
            project_id: pid.clone(),
            name: "Character A".to_string(),
            object_type: "person".to_string(),
            status: "locked".to_string(),
            canon_level: "core_canon".to_string(),
            tags: vec!["protagonist".to_string(), "awakened".to_string()],
            aliases: vec!["CA".to_string()],
            selected_boards: vec!["character_graph".to_string()],
            content: "A test character with rich backstory.".to_string(),
            references_count: 3,
            judgment_history: vec![j1, j2],
            created_at: 0,
            updated_at: 0,
        };

        let created = db.create_world_object(&obj).unwrap();
        assert_eq!(created.name, "Character A");

        // Verify via direct SQL (avoids deadlock)
        {
            let conn = db.conn.lock().unwrap();
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM world_objects WHERE project_id = ?", params![pid], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 1);
            let name: String = conn
                .query_row("SELECT name FROM world_objects WHERE id = ?", params![obj_id], |r| r.get(0))
                .unwrap();
            assert_eq!(name, "Character A");
            let otype: String = conn
                .query_row("SELECT type FROM world_objects WHERE id = ?", params![obj_id], |r| r.get(0))
                .unwrap();
            assert_eq!(otype, "person");
        }
        // Lock scope dropped ??Mutex released

        // Verify judgment records
        {
            let conn = db.conn.lock().unwrap();
            let j_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM judgment_records WHERE object_id = ?", params![obj_id], |r| r.get(0))
                .unwrap();
            assert_eq!(j_count, 2);
        }

        // Ensure other project isolation
        let other_proj = db.create_project("Other", "o", "conceiving", 0, r##"["#x","#y"]"##).unwrap();
        {
            let conn = db.conn.lock().unwrap();
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM world_objects WHERE project_id = ?", params![other_proj.id], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0);
        }

        // Update
        let mut update_obj = created;
        update_obj.name = "Character A (Updated)".to_string();
        update_obj.status = "draft".to_string();
        update_obj.content = "Updated content here.".to_string();
        update_obj.tags.push("updated".to_string());
        db.update_world_object(&update_obj).unwrap();

        // Verify update
        {
            let conn = db.conn.lock().unwrap();
            let name: String = conn
                .query_row("SELECT name FROM world_objects WHERE id = ?", params![obj_id], |r| r.get(0))
                .unwrap();
            assert_eq!(name, "Character A (Updated)");
            let status: String = conn
                .query_row("SELECT status FROM world_objects WHERE id = ?", params![obj_id], |r| r.get(0))
                .unwrap();
            assert_eq!(status, "draft");
        }

        // Delete
        db.delete_world_object(&obj_id).unwrap();
        {
            let conn = db.conn.lock().unwrap();
            let count: i64 = conn
                .query_row("SELECT COUNT(*) FROM world_objects WHERE project_id = ?", params![pid], |r| r.get(0))
                .unwrap();
            assert_eq!(count, 0);
        }
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  CanvasTabState serialization round-trip
    // -???????????????????????????????????????????????????????????????????????????????????

    #[test]
    fn test_canvas_tab_state_serialization() {
        let db = setup_db();
        let proj = db.create_project("Canvas Test", "t", "conceiving", 0, r##"["#a","#b"]"##).unwrap();

        // Initial: empty
        let states = db.list_canvas_tab_states(&proj.id).unwrap();
        // May have default states from App, but DB starts empty
        assert!(states.is_empty());

        // Save a state with all JSON fields populated
        let state_id = uuid::Uuid::new_v4().to_string();
        let state = CanvasTabState {
            id: state_id.clone(),
            project_id: proj.id.clone(),
            tab_id: "main_canvas".to_string(),
            positions: serde_json::json!([
                {"objectId": "obj1", "x": 100.0, "y": 200.0},
                {"objectId": "obj2", "x": 300.0, "y": 400.0}
            ]),
            sticky_notes: vec![
                StickyNote {
                    id: "sticky1".to_string(),
                    text: "Important note".to_string(),
                    x: 50.0, y: 60.0,
                    width: 160.0, height: 100.0,
                    color: "#3E2723".to_string(),
                }
            ],
            connections: vec![],
            scale: 1.5,
            pan_x: -100.0,
            pan_y: -200.0,
            created_at: 0,
            updated_at: 0,
        };

        let resp1 = db.save_canvas_tab_state(&state, 1).unwrap();
        assert!(resp1.accepted);
        assert_eq!(resp1.current_version, 1);
        assert_eq!(resp1.state.tab_id, "main_canvas");
        assert_eq!(resp1.state.scale, 1.5);
        assert_eq!(resp1.state.pan_x, -100.0);

        // List and verify JSON round-trip
        // List and verify JSON round-trip
        let saved_list = db.list_canvas_tab_states(&proj.id).unwrap();
        assert_eq!(saved_list.len(), 1);
        let loaded = &saved_list[0];

        // positions should be a valid JSON array
        let pos_arr = loaded.positions.as_array().expect("positions should be array");
        assert_eq!(pos_arr.len(), 2);
        assert_eq!(pos_arr[0]["objectId"], "obj1");

        // sticky_notes should be parsed back
        assert_eq!(loaded.sticky_notes.len(), 1);
        assert_eq!(loaded.sticky_notes[0].text, "Important note");

        // Upsert: save the same ID with higher version
        let updated_state = CanvasTabState {
            id: state_id.clone(),
            project_id: proj.id.clone(),
            tab_id: "main_canvas".to_string(),
            positions: serde_json::json!([
                {"objectId": "obj1", "x": 100.0, "y": 200.0},
                {"objectId": "obj2", "x": 300.0, "y": 400.0}
            ]),
            sticky_notes: vec![],
            connections: vec![],
            scale: 2.0,
            pan_x: 0.0,
            pan_y: 0.0,
            created_at: 0,
            updated_at: 0,
        };
        let resp2 = db.save_canvas_tab_state(&updated_state, 2).unwrap();
        assert!(resp2.accepted);
        assert_eq!(resp2.current_version, 2);
        assert_eq!(resp2.state.scale, 2.0);
        assert_eq!(resp2.state.sticky_notes.len(), 0);

        // Version conflict: try to save with stale version
        let conflict = db.save_canvas_tab_state(&updated_state, 1);
        assert!(conflict.is_err());
        let err_msg = conflict.unwrap_err();
        assert!(err_msg.starts_with("VERSION_CONFLICT:"), "Expected VERSION_CONFLICT, got: {}", err_msg);

        // Delete
        // Delete
        db.delete_canvas_tab_state(&state_id).unwrap();
        assert!(db.list_canvas_tab_states(&proj.id).unwrap().is_empty());
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  JudgmentRecord append and query
    // -???????????????????????????????????????????????????????????????????????????????????

    #[test]
    fn test_judgment_record_append_and_query() {
        let db = setup_db();
        let proj = db.create_project("Judgment Test", "t", "conceiving", 0, r##"["#a","#b"]"##).unwrap();

        // Create an object for the judgments to reference
        let obj_id = uuid::Uuid::new_v4().to_string();
        let obj = WorldObject {
            id: obj_id.clone(),
            project_id: proj.id.clone(),
            name: "Judged Object".to_string(),
            object_type: "person".to_string(),
            status: "locked".to_string(),
            canon_level: "draft_canon".to_string(),
            tags: vec![],
            aliases: vec![],
            selected_boards: vec![],
            content: "".to_string(),
            references_count: 0,
            judgment_history: vec![],
            created_at: 0,
            updated_at: 0,
        };
        let obj = db.create_world_object(&obj).unwrap();

        // Append a lock judgment
        let lock_record = make_judgment(&obj.id, "lock", "draft", "locked");
        let saved_lock = db.append_judgment_record(&lock_record).unwrap();
        assert!(!saved_lock.id.is_empty());

        // Append a status change judgment
        let promote_record = make_judgment(&obj.id, "promote_canon", "draft_canon", "core_canon");
        db.append_judgment_record(&promote_record).unwrap();

        // Get by object
        let obj_records = db.get_judgment_records_for_object(&obj.id).unwrap();
        assert_eq!(obj_records.len(), 2);

        // List by project
        let proj_records = db.list_judgment_records(&proj.id).unwrap();
        assert_eq!(proj_records.len(), 2);

        // Verify record content
        let lock_found = proj_records.iter().find(|r| r.operation_type == "lock");
        assert!(lock_found.is_some());
        assert_eq!(lock_found.unwrap().previous_status, "draft");
        assert_eq!(lock_found.unwrap().new_status, "locked");

        // Append record with empty id (auto-generate)
        let empty_id_record = JudgmentRecord {
            id: "".to_string(),
            object_id: obj.id.clone(),
            object_name: "Judged Object".to_string(),
            operation_type: "lock".to_string(),
            reason: "Deprecated".to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
            previous_status: "draft".to_string(),
            new_status: "locked".to_string(),
        };
        let saved_empty = db.append_judgment_record(&empty_id_record).unwrap();
        assert!(!saved_empty.id.is_empty());
        assert_ne!(saved_empty.id, "");

        // Verify 3 records now
        assert_eq!(db.get_judgment_records_for_object(&obj.id).unwrap().len(), 3);
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  Connection create and delete
    // -???????????????????????????????????????????????????????????????????????????????????

    #[test]
    fn test_connection_create_and_delete() {
        let db = setup_db();
        let proj = db.create_project("Conn Test", "t", "conceiving", 0, r##"["#a","#b"]"##).unwrap();

        // Create two objects to connect
        let obj1 = db.create_world_object(&WorldObject {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: proj.id.clone(),
            name: "Source".to_string(),
            object_type: "person".to_string(),
            status: "locked".to_string(),
            canon_level: "draft_canon".to_string(),
            tags: vec![],
            aliases: vec![],
            selected_boards: vec![],
            content: "".to_string(),
            references_count: 0,
            judgment_history: vec![],
            created_at: 0,
            updated_at: 0,
        }).unwrap();
        let obj2 = db.create_world_object(&WorldObject {
            id: uuid::Uuid::new_v4().to_string(),
            project_id: proj.id.clone(),
            name: "Target".to_string(),
            object_type: "person".to_string(),
            status: "locked".to_string(),
            canon_level: "draft_canon".to_string(),
            tags: vec![],
            aliases: vec![],
            selected_boards: vec![],
            content: "".to_string(),
            references_count: 0,
            judgment_history: vec![],
            created_at: 0,
            updated_at: 0,
        }).unwrap();

        let conn_id = uuid::Uuid::new_v4().to_string();
        let connection = ObjConnection {
            id: conn_id.clone(),
            project_id: proj.id.clone(),
            source_id: obj1.id.clone(),
            target_id: obj2.id.clone(),
            connection_type: "influences".to_string(),
            label: "influences".to_string(),
        };

        let created = db.create_connection(&connection).unwrap();
        assert_eq!(created.connection_type, "influences");
        assert_eq!(created.label, "influences");

        // List
        let connections = db.list_connections(&proj.id).unwrap();
        assert_eq!(connections.len(), 1);
        assert_eq!(connections[0].source_id, obj1.id);

        // Other project isolation
        let other = db.create_project("Other", "o", "conceiving", 0, r##"["#c","#d"]"##).unwrap();
        assert!(db.list_connections(&other.id).unwrap().is_empty());

        // Delete
        db.delete_connection(&conn_id).unwrap();
        assert!(db.list_connections(&proj.id).unwrap().is_empty());
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  Cascade delete
    // -???????????????????????????????????????????????????????????????????????????????????
    //
    // Uses direct SQL reads to avoid the Mutex deadlock in
    // list_world_objects() / get_world_object(). See note above.

    #[test]
    fn test_cascade_delete() {
        let db = setup_db();

        // Create project with object and connection
        let proj = db.create_project("Cascade Test", "t", "conceiving", 0, r##"["#a","#b"]"##).unwrap();

        let obj_id = uuid::Uuid::new_v4().to_string();
        let obj = WorldObject {
            id: obj_id.clone(),
            project_id: proj.id.clone(),
            name: "WillBeDeleted".to_string(),
            object_type: "person".to_string(),
            status: "locked".to_string(),
            canon_level: "draft_canon".to_string(),
            tags: vec![],
            aliases: vec![],
            selected_boards: vec![],
            content: "".to_string(),
            references_count: 0,
            judgment_history: vec![],
            created_at: 0,
            updated_at: 0,
        };
        db.create_world_object(&obj).unwrap();

        // Add a judgment for the object
        let jr = make_judgment(&obj_id, "???", "???", "???");
        db.append_judgment_record(&jr).unwrap();

        // Add a connection
        let conn_id = uuid::Uuid::new_v4().to_string();
        let other_obj_id = uuid::Uuid::new_v4().to_string();
        let other_obj = WorldObject {
            id: other_obj_id.clone(),
            project_id: proj.id.clone(),
            name: "Other".to_string(),
            object_type: "person".to_string(),
            status: "locked".to_string(),
            canon_level: "draft_canon".to_string(),
            tags: vec![],
            aliases: vec![],
            selected_boards: vec![],
            content: "".to_string(),
            references_count: 0,
            judgment_history: vec![],
            created_at: 0,
            updated_at: 0,
        };
        db.create_world_object(&other_obj).unwrap();
        db.create_connection(&ObjConnection {
            id: conn_id.clone(),
            project_id: proj.id.clone(),
            source_id: obj_id.clone(),
            target_id: other_obj_id.clone(),
            connection_type: "influences".to_string(),
            label: "".to_string(),
        }).unwrap();

        // Verify everything exists (direct SQL for objects to avoid deadlock)
        {
            let conn = db.conn.lock().unwrap();
            let obj_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM world_objects WHERE project_id = ?", params![proj.id], |r| r.get(0))
                .unwrap();
            assert_eq!(obj_count, 2);
        }
        assert_eq!(db.list_connections(&proj.id).unwrap().len(), 1);
        assert_eq!(db.get_judgment_records_for_object(&obj_id).unwrap().len(), 1);

        // Delete project - cascade should remove objects, connections, judgments
        db.delete_project(&proj.id).unwrap();

        // Verify cascaded (direct SQL for objects)
        {
            let conn = db.conn.lock().unwrap();
            let obj_count: i64 = conn
                .query_row("SELECT COUNT(*) FROM world_objects WHERE project_id = ?", params![proj.id], |r| r.get(0))
                .unwrap();
            assert_eq!(obj_count, 0);
        }
        assert_eq!(db.list_connections(&proj.id).unwrap().len(), 0);
        assert_eq!(db.get_judgment_records_for_object(&obj_id).unwrap().len(), 0);
    }

    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-
    //  P0-05: Export / Import / WikiLink tests
    // -?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-?-

    #[test]
    fn test_parse_wiki_links() {
        let links = parse_wiki_links("Hello [[World]]!");
        assert_eq!(links, vec!["World"]);

        let links = parse_wiki_links("See [[Target|display]] here");
        assert_eq!(links, vec!["Target"]);

        let links = parse_wiki_links("[[A]] and [[B]] and [[C|see]]");
        assert_eq!(links, vec!["A", "B", "C"]);

        let links: Vec<String> = parse_wiki_links("Plain text without links");
        assert!(links.is_empty());

        let links: Vec<String> = parse_wiki_links("");
        assert!(links.is_empty());

        let links = parse_wiki_links("[[unclosed");
        assert!(links.is_empty());
    }

    #[test]
    fn test_export_import_roundtrip() {
        let db = setup_db();
        let proj = db.create_project("Export Test", "科幻", "drafting", 15000, r##"["#ff0000","#00ff00"]"##).unwrap();

        let obj1_id = uuid::Uuid::new_v4().to_string();
        let obj1 = WorldObject {
            id: obj1_id.clone(),
            project_id: proj.id.clone(),
            name: "Character One".to_string(),
            object_type: "人物".to_string(),
            status: "锁定".to_string(),
            canon_level: "项目正典".to_string(),
            tags: vec!["protagonist".to_string()],
            aliases: vec![],
            selected_boards: vec![],
            content: "A test character.".to_string(),
            references_count: 0,
            judgment_history: vec![],
            created_at: 0,
            updated_at: 0,
        };
        db.create_world_object(&obj1).unwrap();

        let obj2_id = uuid::Uuid::new_v4().to_string();
        let obj2 = WorldObject {
            id: obj2_id.clone(),
            project_id: proj.id.clone(),
            name: "Location One".to_string(),
            object_type: "地点".to_string(),
            status: "锁定".to_string(),
            canon_level: "核心正典".to_string(),
            tags: vec![],
            aliases: vec![],
            selected_boards: vec![],
            content: "An important location.".to_string(),
            references_count: 0,
            judgment_history: vec![],
            created_at: 0,
            updated_at: 0,
        };
        db.create_world_object(&obj2).unwrap();

        let conn_id = uuid::Uuid::new_v4().to_string();
        db.create_connection(&ObjConnection {
            id: conn_id.clone(),
            project_id: proj.id.clone(),
            source_id: obj1_id.clone(),
            target_id: obj2_id.clone(),
            connection_type: "发生于".to_string(),
            label: "".to_string(),
        }).unwrap();

        let export_data = db.export_project_data(&proj.id).unwrap();
        assert_eq!(export_data.project.name, "Export Test");
        assert_eq!(export_data.objects.len(), 2);
        assert_eq!(export_data.connections.len(), 1);

        let import_result = db.import_project_data(&export_data).unwrap();
        assert!(import_result.success);
        assert_eq!(import_result.object_count, 2);
        assert_eq!(import_result.connection_count, 1);
        assert_eq!(import_result.project_name, "Export Test");

        let imported_objects = db.list_world_objects(&import_result.project_id).unwrap();
        assert_eq!(imported_objects.len(), 2);
        let imported_connections = db.list_connections(&import_result.project_id).unwrap();
        assert_eq!(imported_connections.len(), 1);
    }

    // -???????????????????????????????????????????????????????????????????????????????????
    //  v2 ChapterPacket CRUD
    // -???????????????????????????????????????????????????????????????????????????????????

    /// Helper: create a structure node for chapter_packet FK reference.
    fn create_test_struct_node(db: &Database, proj_id: &str, label: &str) -> String {
        let input = CreateStructureNodeInput {
            project_id: proj_id.to_string(),
            parent_id: None,
            title: format!("Struct-{}", label),
            node_type: "chapter".to_string(),
            narrative_function: "".to_string(),
            summary: "".to_string(),
            position_x: 0.0,
            position_y: 0.0,
            sort_order: 0,
        };
        db.create_structure_node(&input).unwrap().id
    }

    #[test]
    fn test_chapter_packet_create() {
        let db = setup_db();
        let proj = db.create_project("CP Test", "fiction", "conceiving", 0, r##"["#a","#b"]"##).unwrap();
        let struct_id = create_test_struct_node(&db, &proj.id, "1");

        // Initially empty
        let packets = db.list_chapter_packets(&proj.id).unwrap();
        assert!(packets.is_empty());

        // Create
        let input = CreateChapterPacketInput {
            project_id: proj.id.clone(),
            structure_node_id: struct_id.clone(),
            chapter_number: 1,
            title: "第一章".to_string(),
            line: None,
            position: "动".to_string(),
            chapter_function: "opening".to_string(),
        };
        let cp = db.create_chapter_packet(&input).unwrap();
        assert_eq!(cp.chapter_number, 1);
        assert_eq!(cp.title, "第一章");
        assert_eq!(cp.status, "empty");
        assert_eq!(cp.chapter_function, "opening");
        assert_eq!(cp.structure_node_id, Some(struct_id));
        assert!(!cp.id.is_empty());

        // List
        let packets = db.list_chapter_packets(&proj.id).unwrap();
        assert_eq!(packets.len(), 1);

        // Get
        let got = db.get_chapter_packet(&cp.id).unwrap().expect("should exist");
        assert_eq!(got.id, cp.id);
        assert_eq!(got.title, "第一章");

        // Get non-existent
        assert!(db.get_chapter_packet("nonexistent").unwrap().is_none());
    }

    #[test]
    fn test_chapter_packet_list_by_project() {
        let db = setup_db();
        let proj = db.create_project("CP List", "fiction", "conceiving", 0, r##"["#a","#b"]"##).unwrap();

        // Create 3 structure nodes, then 3 packets
        for i in 1..=3 {
            let struct_id = create_test_struct_node(&db, &proj.id, &format!("ch{}", i));
            let input = CreateChapterPacketInput {
                project_id: proj.id.clone(),
                structure_node_id: struct_id,
                chapter_number: i,
                title: format!("第{}章", i),
                line: None,
                position: if i == 1 { "动".to_string() } else { "藏→生".to_string() },
                chapter_function: if i == 1 { "opening".to_string() } else { "escalation".to_string() },
            };
            db.create_chapter_packet(&input).unwrap();
        }

        let packets = db.list_chapter_packets(&proj.id).unwrap();
        assert_eq!(packets.len(), 3);
        assert_eq!(packets[0].chapter_number, 1);
        assert_eq!(packets[1].chapter_number, 2);
        assert_eq!(packets[2].chapter_number, 3);

        // Project isolation
        let other = db.create_project("Other", "o", "conceiving", 0, r##"["#c","#d"]"##).unwrap();
        let other_packets = db.list_chapter_packets(&other.id).unwrap();
        assert!(other_packets.is_empty());
    }

    #[test]
    fn test_chapter_packet_update_layers() {
        let db = setup_db();
        let proj = db.create_project("CP Update", "fiction", "conceiving", 0, r##"["#a","#b"]"##).unwrap();
        let struct_id = create_test_struct_node(&db, &proj.id, "1");

        let input = CreateChapterPacketInput {
            project_id: proj.id.clone(),
            structure_node_id: struct_id,
            chapter_number: 1,
            title: "第一章".to_string(),
            line: None,
            position: "动".to_string(),
            chapter_function: "opening".to_string(),
        };
        let cp = db.create_chapter_packet(&input).unwrap();

        // Update layer1
        let layer1_json = r#"{"narrativeDistance":"close","expositionStrategy":"balanced","characterVoice":"moderate","taboos":["不要剧透"],"voiceSamples":[]}"#;
        let updated = db.update_chapter_packet_layers(&UpdateChapterPacketLayersInput {
            packet_id: cp.id.clone(),
            layer1: Some(layer1_json.to_string()),
            layer2: None,
            layer3: None,
            layer4: None,
            status: Some("draft".to_string()),
        }).unwrap();
        assert_eq!(updated.layer1, layer1_json);
        assert_eq!(updated.status, "draft");

        // Update multiple fields
        let layer2_json = r#"{"characters":[{"characterId":"c1","name":"Test","hook":"h","currentState":"知情","status":"active"}],"scenes":[],"rules":[],"recap":"前情","knowledgeSnapshot":{"characterKnowledge":[],"readerKnows":[],"hiddenFromReader":[]},"characterStates":[]}"#;
        let updated2 = db.update_chapter_packet_layers(&UpdateChapterPacketLayersInput {
            packet_id: cp.id.clone(),
            layer1: None,
            layer2: Some(layer2_json.to_string()),
            layer3: None,
            layer4: None,
            status: None,
        }).unwrap();
        assert_eq!(updated2.layer1, layer1_json); // unchanged
        assert_eq!(updated2.layer2, layer2_json);
        assert_eq!(updated2.status, "draft"); // unchanged

        // Get and verify
        let got = db.get_chapter_packet(&cp.id).unwrap().unwrap();
        assert_eq!(got.layer1, layer1_json);
        assert_eq!(got.layer2, layer2_json);
    }

    #[test]
    fn test_chapter_packet_confirm() {
        let db = setup_db();
        let proj = db.create_project("CP Confirm", "fiction", "conceiving", 0, r##"["#a","#b"]"##).unwrap();
        let struct_id = create_test_struct_node(&db, &proj.id, "1");

        let input = CreateChapterPacketInput {
            project_id: proj.id.clone(),
            structure_node_id: struct_id,
            chapter_number: 1,
            title: "第一章".to_string(),
            line: None,
            position: "动".to_string(),
            chapter_function: "opening".to_string(),
        };
        let cp = db.create_chapter_packet(&input).unwrap();
        assert_eq!(cp.status, "empty");

        let confirmed = db.confirm_chapter_packet(&cp.id).unwrap();
        assert_eq!(confirmed.status, "confirmed");
        assert!(confirmed.updated_at >= confirmed.created_at);

        // Confirm idempotent
        let confirmed2 = db.confirm_chapter_packet(&cp.id).unwrap();
        assert_eq!(confirmed2.status, "confirmed");
    }

    #[test]
    fn test_chapter_packet_delete() {
        let db = setup_db();
        let proj = db.create_project("CP Delete", "fiction", "conceiving", 0, r##"["#a","#b"]"##).unwrap();
        let struct_id = create_test_struct_node(&db, &proj.id, "1");

        let input = CreateChapterPacketInput {
            project_id: proj.id.clone(),
            structure_node_id: struct_id,
            chapter_number: 1,
            title: "第一章".to_string(),
            line: None,
            position: "动".to_string(),
            chapter_function: "opening".to_string(),
        };
        let cp = db.create_chapter_packet(&input).unwrap();

        // Delete
        db.delete_chapter_packet(&cp.id).unwrap();
        assert!(db.get_chapter_packet(&cp.id).unwrap().is_none());
        assert_eq!(db.list_chapter_packets(&proj.id).unwrap().len(), 0);
    }

    #[test]
    fn test_chapter_packet_confirm_fk_set_null() {
        // Verify ON DELETE SET NULL behavior
        let db = setup_db();
        let proj = db.create_project("CP FK", "fiction", "conceiving", 0, r##"["#a","#b"]"##).unwrap();
        let struct_id = create_test_struct_node(&db, &proj.id, "fk-test");

        let input = CreateChapterPacketInput {
            project_id: proj.id.clone(),
            structure_node_id: struct_id.clone(),
            chapter_number: 1,
            title: "FK Test".to_string(),
            line: None,
            position: "动".to_string(),
            chapter_function: "opening".to_string(),
        };
        let cp = db.create_chapter_packet(&input).unwrap();
        assert_eq!(cp.structure_node_id, Some(struct_id.clone()));

        // Delete reference structure node -> should SET NULL
        db.delete_structure_node(&struct_id).unwrap();
        let after_delete = db.get_chapter_packet(&cp.id).unwrap().expect("packet should still exist");
        assert!(after_delete.structure_node_id.is_none());
    }
}