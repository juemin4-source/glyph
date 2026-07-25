import type { DirEntry, FsProject, SearchMatch } from './fs';

export interface EditorSelectionContext {
  start: number;
  end: number;
  text: string;
  cursorOffset: number;
  startLine: number;
  endLine: number;
}

export type AiActionKind =
  | 'answer'
  | 'create_file'
  | 'replace_selection'
  | 'insert_at_cursor'
  | 'replace_file';

export type ProjectAiPhase =
  | 'idle'
  | 'planning'
  | 'searching'
  | 'reading'
  | 'preparing'
  | 'generating'
  | 'committing'
  | 'completed'
  | 'cancelled'
  | 'blocked'
  | 'error';

export interface ReadPlan {
  searchQueries: string[];
  includeCurrentFile: boolean;
  requestedFiles: string[];
  focus: string;
}

export interface ProjectAiPlan extends ReadPlan {
  action: AiActionKind;
  targetPath: string | null;
  changeSummary: string;
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

export interface ProjectAiProgress {
  phase: ProjectAiPhase;
  detail: string;
  files?: string[];
}

export interface PreparedWriteTarget {
  action: Exclude<AiActionKind, 'answer'>;
  targetPath: string;
  baseContent: string | null;
  baseVersion: string | null;
  baseEditorRevision: number | null;
  selection: EditorSelectionContext | null;
  cursorOffset: number | null;
}

export interface AiWriteProposal {
  operationId: string;
  action: Exclude<AiActionKind, 'answer'>;
  targetPath: string;
  instruction: string;
  changeSummary: string;
  generatedContent: string;
  finalContent: string;
  baseContent: string | null;
  expectedVersion: string | null;
  baseEditorRevision: number | null;
  evidencePaths: string[];
}

export interface AiFileActionCommit {
  operationId: string;
  actionType: 'create' | 'modify';
  targetPath: string;
  modifiedAt: number;
  version: string;
  snapshotPath: string | null;
  recordPath: string;
}

export type AiCommitStatus = 'committed' | 'blocked';

export interface AiCommitOutcome {
  status: AiCommitStatus;
  commit: AiFileActionCommit | null;
  reason: string | null;
}

export interface ProjectAiResult {
  answer: string;
  evidence: ReadEvidence[];
  plan: ProjectAiPlan;
  providerLabel: string;
  commit: AiFileActionCommit | null;
  draft: string | null;
}

export interface ProjectAiTaskInput {
  userInput: string;
  project: FsProject;
  currentFilePath: string | null;
  currentFileContent: string | null;
  selection: EditorSelectionContext | null;
  providerId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ProjectAiProgress) => void;
  prepareWrite: (plan: ProjectAiPlan, context: {
    currentFilePath: string | null;
    currentFileContent: string | null;
    selection: EditorSelectionContext | null;
  }) => Promise<PreparedWriteTarget>;
  commitWrite: (proposal: AiWriteProposal) => Promise<AiCommitOutcome>;
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

// ══════════════════════════════════════════
//  Gate D: Action History & Provenance
// ══════════════════════════════════════════

export interface AiActionSummary {
  operationId: string;
  actionType: string;
  targetPath: string;
  status: string;
  instruction: string;
  changeSummary: string;
  evidencePaths: string[];
  snapshotPath: string | null;
  oldVersion: string | null;
  newVersion: string | null;
  error: string | null;
  updatedAt: number;
  revertedAt: number | null;
}

export interface AiActionDetail extends AiActionSummary {
  glyphVersion: string;
}

export interface RevertAiActionInput {
  operationId: string;
  targetPath: string;
  expectedVersion: string;
}

export interface RevertAiActionResult {
  operationId: string;
  targetPath: string;
  restored: boolean;
  restoredVersion: string;
  preRevertSnapshot: string;
  reason: string | null;
}

export interface ProvenanceRecord {
  provenanceId: string;
  actionId: string;
  filePath: string;
  createdAt: number;
  textBlock: string;
  startOffset: number;
  endOffset: number;
  currentState: 'ai_original' | 'ai_edited_by_user' | 'uncertain' | 'removed';
  lastVerifiedVersion: string;
}

/** Input shape matching Rust ProvenanceRecordInput (fewer fields, used for saving). */
export interface ProvenanceRecordInput {
  actionId: string;
  filePath: string;
  textBlock: string;
  startOffset: number;
  endOffset: number;
}

export interface StartupRecoveryResult {
  actionsChecked: number;
  actionsRecovered: number;
  actionsFailed: number;
  details: string[];
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

export interface ProjectAiTaskCard {
  id: string;
  userInput: string;
  createdAt: number;
  phase: ProjectAiPhase;
  phaseDetail: string;
  answer: string;
  evidence: ReadEvidence[];
  error: string | null;
  providerLabel: string | null;
  plan: ProjectAiPlan | null;
  commit: AiFileActionCommit | null;
  draft: string | null;
}
