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
import type { PipelineState } from './docs/contracts/project.contract';
import type {
  FsProject,
  DirEntry,
  SessionState,
  CreateFsProjectOutput,
  ExportToFsResult,
  ContentSearchResult,
  FileReadResult,
  FileWriteResult,
  AiFileActionInput,
  AiFileActionOutput,
} from './types/fs';

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
//  Glyph v0.1: Outline Reorder API
// ══════════════════════════════════════════

export function reorderOutline(objectId: string, parentId: string | null, sortOrder: number): Promise<void> {
  return invoke('reorder_outline', { objectId, parentId, sortOrder });
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

// ══════════════════════════════════════════
//  Gate A: Filesystem Project API
// ══════════════════════════════════════════

export function createFsProject(
  name: string,
  rootPath: string,
  genre?: string,
): Promise<CreateFsProjectOutput> {
  return invoke('create_fs_project', { name, rootPath, genre });
}

export function openFsProject(rootPath: string): Promise<FsProject> {
  return invoke('open_fs_project', { rootPath });
}

export function listFsProjects(): Promise<FsProject[]> {
  return invoke('list_fs_projects');
}

export function removeFsProject(projectId: string): Promise<void> {
  return invoke('remove_fs_project', { projectId });
}

// ══════════════════════════════════════════
//  Gate B: Content Search
// ══════════════════════════════════════════

export function searchFileContent(
  projectRoot: string,
  query: string,
  maxResults?: number,
  filePattern?: string,
): Promise<ContentSearchResult> {
  return invoke('search_file_content', { projectRoot, query, maxResults, filePattern });
}

// ══════════════════════════════════════════
//  Gate A: File/Directory Operations
// ══════════════════════════════════════════

export function listDirectory(
  projectRoot: string,
  subPath?: string,
): Promise<DirEntry[]> {
  return invoke('list_directory', { projectRoot, subPath });
}

export function readFile(
  projectRoot: string,
  path: string,
): Promise<string> {
  return invoke('read_file', { projectRoot, path });
}

export function readFileState(
  projectRoot: string,
  path: string,
): Promise<FileReadResult> {
  return invoke('read_file_state', { projectRoot, path });
}

export function writeFile(
  projectRoot: string,
  path: string,
  content: string,
): Promise<void> {
  return invoke('write_file', { projectRoot, path, content });
}

export function writeFileChecked(
  projectRoot: string,
  path: string,
  content: string,
  expectedVersion: string | null,
): Promise<FileWriteResult> {
  return invoke('write_file_checked', {
    projectRoot,
    path,
    content,
    expectedVersion,
  });
}

export async function pickDirectory(title: string): Promise<string | null> {
  const selected = await invoke<string | null>('plugin:dialog|open', {
    options: { directory: true, multiple: false, title },
  });
  return typeof selected === 'string' ? selected : null;
}


export function commitAiFileAction(
  projectRoot: string,
  input: AiFileActionInput,
): Promise<AiFileActionOutput> {
  return invoke('commit_ai_file_action', { projectRoot, input });
}

export function createTextFile(
  projectRoot: string,
  path: string,
  content: string,
): Promise<FileWriteResult> {
  return invoke('create_text_file', { projectRoot, path, content });
}

export function createFile(
  projectRoot: string,
  path: string,
): Promise<void> {
  return invoke('create_file', { projectRoot, path });
}

export function createDirectory(
  projectRoot: string,
  path: string,
): Promise<void> {
  return invoke('create_directory', { projectRoot, path });
}

export function renameFile(
  projectRoot: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  return invoke('rename_file', { projectRoot, oldPath, newPath });
}

export function deleteFile(
  projectRoot: string,
  path: string,
): Promise<void> {
  return invoke('delete_file', { projectRoot, path });
}

export function deleteDirectory(
  projectRoot: string,
  path: string,
): Promise<void> {
  return invoke('delete_directory', { projectRoot, path });
}

// ══════════════════════════════════════════
//  Gate A: Session State
// ══════════════════════════════════════════

export function getSessionState(
  projectRoot: string,
): Promise<SessionState> {
  return invoke('get_session_state', { projectRoot });
}

export function saveSessionState(
  projectRoot: string,
  state: SessionState,
): Promise<void> {
  return invoke('save_session_state', { projectRoot, state });
}

// ══════════════════════════════════════════
//  Gate A: File Watcher
// ══════════════════════════════════════════

export function watchProject(projectRoot: string): Promise<void> {
  return invoke('watch_project', { projectRoot });
}

export function unwatchProject(projectRoot: string): Promise<void> {
  return invoke('unwatch_project', { projectRoot });
}

// ══════════════════════════════════════════
//  Gate A: Migration
// ══════════════════════════════════════════

export function exportToFsProject(
  projectId: string,
  outputPath: string,
): Promise<ExportToFsResult> {
  return invoke('export_to_fs_project', { projectId, outputPath });
}
