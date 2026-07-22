import { invoke } from '@tauri-apps/api/core';
import type {
  WorldObject,
  Connection,
  CanvasTabState,
  JudgmentRecord,
  ExportResult,
  ImportResult,
  CanvasTabStateResponse,
} from './types/world';
import type { PipelineState } from './contracts/project.contract';

// ══════════════════════════════════════════
//  Project API
// ══════════════════════════════════════════

export interface ProjectDTO {
  id: string;
  name: string;
  genre: string;
  status: string;
  wordCount: number;
  gradient: string;
  createdAt: number;
  updatedAt: number;
}

export function listProjects(): Promise<ProjectDTO[]> {
  return invoke('list_projects');
}

export function getProject(id: string): Promise<ProjectDTO | null> {
  return invoke('get_project', { id });
}

export function createProject(
  name: string,
  genre: string = '未分类',
  status: string = 'conceiving',
  wordCount: number = 0,
  gradient: string = '["#6366f1","#8b5cf6"]'
): Promise<ProjectDTO> {
  return invoke('create_project', { name, genre, status, wordCount, gradient });
}

export function updateProject(project: ProjectDTO): Promise<void> {
  return invoke('update_project', { project });
}

export function deleteProject(id: string): Promise<void> {
  return invoke('delete_project', { id });
}

// ══════════════════════════════════════════
//  WorldObject API
// ══════════════════════════════════════════

export function listWorldObjects(projectId: string): Promise<WorldObject[]> {
  return invoke('list_world_objects', { projectId });
}

export function getWorldObject(id: string): Promise<WorldObject | null> {
  return invoke('get_world_object', { id });
}

export function createWorldObject(object: WorldObject): Promise<WorldObject> {
  return invoke('create_world_object', { object });
}

export function updateWorldObject(object: WorldObject): Promise<void> {
  return invoke('update_world_object', { object });
}

export function deleteWorldObject(id: string): Promise<void> {
  return invoke('delete_world_object', { id });
}

// ══════════════════════════════════════════
//  JudgmentRecord API
// ══════════════════════════════════════════

export function listJudgmentRecords(projectId: string): Promise<JudgmentRecord[]> {
  return invoke('list_judgment_records', { projectId });
}

export function appendJudgmentRecord(record: JudgmentRecord): Promise<JudgmentRecord> {
  return invoke('append_judgment_record', { record });
}

// ══════════════════════════════════════════
//  Connection API
// ══════════════════════════════════════════

export function listConnections(projectId: string): Promise<Connection[]> {
  return invoke('list_connections', { projectId });
}

export function createConnection(connection: Connection): Promise<Connection> {
  return invoke('create_connection', { connection });
}

export function deleteConnection(id: string): Promise<void> {
  return invoke('delete_connection', { id });
}

// ══════════════════════════════════════════
//  CanvasTabState API
// ══════════════════════════════════════════

export function listCanvasTabStates(projectId: string): Promise<CanvasTabState[]> {
  return invoke('list_canvas_tab_states', { projectId });
}

export function saveCanvasTabState(state: CanvasTabState & { version?: number }): Promise<CanvasTabState | CanvasTabStateResponse> {
  return invoke('save_canvas_tab_state', { state });
}

export function deleteCanvasTabState(id: string): Promise<void> {
  return invoke('delete_canvas_tab_state', { id });
}

// ══════════════════════════════════════════
//  v1.2: Health check (P0-02)
// ══════════════════════════════════════════

export function ping(): Promise<string> {
  return invoke('ping');
}

// ══════════════════════════════════════════
//  v1.2: Export/Import (P0-05)
// ══════════════════════════════════════════

export function exportProject(projectId: string, outputPath: string): Promise<ExportResult> {
  return invoke('export_project', { projectId, outputPath });
}

export function importProject(inputPath: string): Promise<ImportResult> {
  return invoke('import_project', { inputPath });
}

// ══════════════════════════════════════════
//  v2 PipelineState API
// ══════════════════════════════════════════

export function getPipelineState(projectId: string): Promise<PipelineState> {
  return invoke('get_pipeline_state', { input: { projectId } });
}

export function savePipelineState(state: PipelineState): Promise<PipelineState> {
  return invoke('save_pipeline_state', { input: { state } });
}
