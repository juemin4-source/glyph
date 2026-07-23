// Glyph Gate A: Filesystem types

export interface FsProject {
  projectId: string;
  name: string;
  rootPath: string;
  genre: string;
  createdAt: number;
  lastOpenedAt: number;
  updatedAt: number;
}

export interface DirEntry {
  name: string;
  /** Path relative to project root */
  path: string;
  isDir: boolean;
  extension: string;
  size: number;
  modifiedAt: number;
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
  paths: string[];
  timestamp: number;
}

export interface FileTab {
  path: string;
  name: string;
  isDirty: boolean;
  content: string | null;
  cursorLine?: number;
  cursorColumn?: number;
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
}
