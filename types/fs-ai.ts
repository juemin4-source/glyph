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
  /** Conversation history: previous user inputs and AI answers */
  history?: string[];
  /** Project context summary (.glyph/context-summary.md) */
  contextSummary?: string;
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

// ══ Canon: 设定集 v0.5 ══

export type EntityType = '人物' | '地点' | '组织' | '物品';
export type EntityStatus = '草稿' | '待验证' | '已确认' | '废弃';
export type CanonLevel = '未收录' | '草案正典' | '项目正典' | '核心正典';

export interface SourceRef {
  filePath: string;
  textSnippet: string;
  offset: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  status: EntityStatus;
  canonLevel: CanonLevel;
  summary: string;
  detail: string;
  schemaKeys: string[];
  sourceRefs: SourceRef[];
  tags: string[];
  referencesCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface SparrowSchema {
  version: number;
  updatedAt: number;
  coreQuestion: string;
  aestheticSignature: string;
  coreMechanism: string;
  worldLack: string;
  protagonistLack: string;
  rulesAndCost: string;
  enforcer: string;
  currentSituation: string;
  compressionField: string;
  effectivePast?: string;
  supplySystem?: string;
  identityQualifications?: string;
  faithAndTaboo?: string;
  dailyInterface?: string;
}

export interface ScanCandidate {
  id: string;
  type: EntityType;
  name: string;
  appearingChapters: string[];
  evidenceText: string;
  sourcePath: string;
  confidence: 'high' | 'medium' | 'low';
  mergeIntoSuggestion?: string;
}

export function defaultSparrowSchema(): SparrowSchema {
  return {
    version: 1,
    updatedAt: Date.now(),
    coreQuestion: '',
    aestheticSignature: '',
    coreMechanism: '',
    worldLack: '',
    protagonistLack: '',
    rulesAndCost: '',
    enforcer: '',
    currentSituation: '',
    compressionField: '',
  };
}

export const CANON_LEVELS: CanonLevel[] = ['未收录', '草案正典', '项目正典', '核心正典'];
export const ENTITY_TYPES: EntityType[] = ['人物', '地点', '组织', '物品'];
export const ENTITY_STATUSES: EntityStatus[] = ['草稿', '待验证', '已确认', '废弃'];

export const CANON_COLORS: Record<CanonLevel, string> = {
  '未收录': '#666666',
  '草案正典': '#CE93D8',
  '项目正典': '#90CAF9',
  '核心正典': '#FFB74D',
};

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
  /** Version history from retries, ordered oldest first */
  versions?: { answer: string; commit: AiFileActionCommit | null; draft: string | null; createdAt: number }[];
  /** Index into versions[] for current display (undefined = original) */
  currentVersion?: number;
  /** True if a previous message was edited, making this task's context potentially stale */
  stale?: boolean;
}
