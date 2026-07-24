import type { DirEntry, FsProject, SearchMatch } from './fs';

export interface EditorSelectionContext {
  start: number;
  end: number;
  text: string;
  cursorOffset: number;
  startLine: number;
  endLine: number;
}

export type ReadonlyAiPhase =
  | 'idle'
  | 'planning'
  | 'searching'
  | 'reading'
  | 'answering'
  | 'completed'
  | 'cancelled'
  | 'error';

export interface ReadPlan {
  searchQueries: string[];
  includeCurrentFile: boolean;
  requestedFiles: string[];
  focus: string;
}

export type EvidenceKind =
  | 'selection'
  | 'current-file'
  | 'explicit-file'
  | 'search-result'
  | 'read-file'
  | 'read-error';

export interface ReadEvidence {
  id: string;
  kind: EvidenceKind;
  filePath: string | null;
  title: string;
  detail: string;
  excerpt: string;
  query?: string;
  matchCount?: number;
  truncated?: boolean;
}

export interface ReadonlyAiProgress {
  phase: ReadonlyAiPhase;
  detail: string;
  files?: string[];
}

export interface ReadonlyAiResult {
  answer: string;
  evidence: ReadEvidence[];
  plan: ReadPlan;
  providerLabel: string;
}

export interface ReadonlyAiTaskInput {
  userInput: string;
  project: FsProject;
  currentFilePath: string | null;
  currentFileContent: string | null;
  selection: EditorSelectionContext | null;
  providerId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ReadonlyAiProgress) => void;
}

export interface ReadonlyProviderChoice {
  id: string;
  configId: string;
  providerId: string;
  providerName: string;
  modelId: string;
  endpoint: string;
  timeoutMs: number;
  hasApiKey: boolean;
  label: string;
}

export interface ResolvedFileReference {
  ref: string;
  exactMatch: string | null;
  candidates: string[];
}

export interface ProjectFileIndex {
  files: DirEntry[];
  truncated: boolean;
  unreadableDirectories: string[];
}

export interface SearchExecution {
  query: string;
  result: {
    matches: SearchMatch[];
    totalFilesSearched: number;
    truncated: boolean;
  } | null;
  error: string | null;
}

export interface ReadonlyTaskCard {
  id: string;
  userInput: string;
  createdAt: number;
  phase: ReadonlyAiPhase;
  phaseDetail: string;
  answer: string;
  evidence: ReadEvidence[];
  error: string | null;
  providerLabel: string | null;
}
