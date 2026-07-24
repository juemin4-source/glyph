// Filesystem-first workspace types.

export interface FsProject {
  id: string;
  name: string;
  rootPath: string;
  genre: string;
  createdAt: number;
  lastOpenedAt: number;
  updatedAt: number;
}

export interface DirEntry {
  name: string;
  /** Path relative to project root, always using forward slashes. */
  path: string;
  isDir: boolean;
  extension: string;
  size: number;
  modifiedAt: number;
}

export interface FileReadResult {
  content: string;
  modifiedAt: number;
  /** Stable content fingerprint used for conflict-safe writes. */
  version: string;
}

export interface FileWriteResult {
  modifiedAt: number;
  version: string;
}

export type FileSyncStatus =
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'save-error'
  | 'conflict'
  | 'missing';

export interface ExternalConflict {
  content: string;
  modifiedAt: number;
  version: string;
}

export interface SessionState {
  lastOpenFilePath: string | null;
  lastCursorLine: number | null;
  lastCursorColumn: number | null;
  lastScrollPosition: number | null;
  openFilePaths: string[];
  sidebarWidth: number | null;
  focusMode: boolean | null;
  lastEditMode: string | null;
  lastSessionAt: number;
}

export interface FileChangeEvent {
  /** Canonical project root that emitted the event. */
  projectRoot: string;
  /** Paths relative to that project root. */
  paths: string[];
  timestamp: number;
}

export interface CreateFsProjectOutput {
  project: FsProject;
  createdDirectories: string[];
  createdFiles: string[];
}

export interface ExportToFsResult {
  success: boolean;
  project: FsProject;
  objectCount: number;
  fileCount: number;
}

export interface SearchMatch {
  filePath: string;
  matchCount: number;
  previews: string[];
}

export interface ContentSearchResult {
  matches: SearchMatch[];
  totalFilesSearched: number;
  truncated: boolean;
}

export interface AiFileActionInput {
  operationId: string;
  actionType: 'create' | 'modify';
  targetPath: string;
  content: string;
  expectedVersion: string | null;
  instruction: string;
  changeSummary: string;
  evidencePaths: string[];
}

export interface AiFileActionOutput {
  operationId: string;
  actionType: 'create' | 'modify';
  targetPath: string;
  modifiedAt: number;
  version: string;
  snapshotPath: string | null;
  recordPath: string;
}
