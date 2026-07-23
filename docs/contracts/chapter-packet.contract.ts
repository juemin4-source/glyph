/**
 * chapter-packet.contract.ts — 织梦机 v2 Round C 唯一主实体。
 *
 * 四层自包含细纲包。任意 AI 拿到此包即可写出符合故事气质、没有幻觉的正文。
 *
 * 设计约束：
 * - 除顶层字段外，所有子结构内联为 JSON TEXT 列
 * - 四层各自独立 JSON，不跨层引用（便于可移植性导出）
 */

// ─── 顶层类型 ───

export type PacketStatus = 'empty' | 'draft' | 'confirmed' | 'writing' | 'completed';

export interface ChapterPacket {
  id: string;
  projectId: string;
  structureNodeId: string | null;   // 关联画板②的 StructureNode（可空，ON DELETE SET NULL）
  chapterNumber: number;
  title: string;
  line?: string;                    // 线路（预留，从 StructureNode 同步）
  position: string;                 // 时位，如 "动" | "藏→生"
  chapterFunction: string;          // 本章功能枚举：opening|setup|escalation|...

  // ─── 四层（全部为 JSON TEXT） ───
  layer1: string;                   // Layer ① 写作契约 (JSON)
  layer2: string;                   // Layer ② 活跃设定 + 知识快照 (JSON)
  layer3: string;                   // Layer ③ 剧情压缩层 (JSON)
  layer4: string;                   // Layer ④ AI 执行层 (JSON)

  // ─── 元数据 ───
  status: PacketStatus;
  mode: string;                     // 预留三档：'fast' | 'standard' | 'detailed'
  assumptionCount: number;          // 临时假设数量（便于 UI 显示提醒）
  createdAt: number;
  updatedAt: number;
}

// ─── Layer ①：写作契约 ───

export interface WritingContract {
  narrativeDistance: 'close' | 'medium' | 'distant';
  expositionStrategy: 'show_dont_tell' | 'balanced' | 'explain_all';
  characterVoice: 'distinct' | 'moderate' | 'uniform';
  taboos: string[];
  voiceSamples: {
    characterId: string;
    sample: string;
  }[];
}

// ─── Layer ②：活跃设定 + 知识快照 ───

export interface ActiveCharacter {
  characterId: string;
  name: string;
  hook: string;
  currentState: string;
  status: string;
}

export interface ActiveScene {
  name: string;
  atmosphere: string;
}

export interface ActiveRule {
  ruleId: string;
  title: string;
  description: string;
}

export interface CharacterKnowledge {
  characterId: string;
  knownFacts: { fact: string; source: string }[];
  unknownFacts: { fact: string; source: string }[];
}

export interface ActiveContext {
  characters: ActiveCharacter[];
  scenes: ActiveScene[];
  rules: ActiveRule[];
  recap: string;
  knowledgeSnapshot: {
    characterKnowledge: CharacterKnowledge[];
    readerKnows: string[];
    hiddenFromReader: string[];
  };
  characterStates: {
    characterId: string;
    currentStatus: string;
    relationshipChanges: {
      targetId: string;
      newRelation: string;
    }[];
  }[];
}

// ─── Layer ③：剧情压缩层 ───

export interface Assumption {
  id: string;
  content: string;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  resolution?: 'adopted' | 'rejected' | 'pending';
}

export interface Establish {
  type: 'establish' | 'foreshadow' | 'pressure';
  subject: string;
  change?: string;
}

export interface NarrativeCompression {
  lines: string[];
  position: {
    from: string;
    to?: string;
  };
  chapterFunction: string;
  narrative: string;                // 80-250 字压缩叙事
  releases: string[];               // 释放列表
  establishes: Establish[];          // 建立/伏笔/章尾压力
  annotations: string[];            // 注释
  assumptions: Assumption[];        // 临时假设
}

// ─── Layer ④：执行层 ───

export interface Scene {
  label: string;
  location: string;
  summary: string;
  rhythm: 'slow' | 'medium' | 'fast';
  pov: string;
  sceneGoal: string;
  conflict: string;
  turn?: string;
  allowedKnowledge: string[];
  forbiddenKnowledge: string[];
  keyDialog?: string[];
}

export interface ExecutionLayer {
  scenes: Scene[];
  taboos: string[];
}

// ─── 输入/输出类型 ───

export interface CreateChapterPacketInput {
  projectId: string;
  structureNodeId: string;
  chapterNumber: number;
  title: string;
  line?: string;
  position: string;
  chapterFunction: string;
}

export interface UpdateLayersInput {
  packetId: string;
  layer1?: string;
  layer2?: string;
  layer3?: string;
  layer4?: string;
  status?: PacketStatus;
}

export interface ListPacketsInput {
  projectId: string;
}

export interface GetPacketInput {
  id: string;
}

export interface ConfirmPacketInput {
  packetId: string;
}

export interface DeletePacketInput {
  id: string;
}

// ─── CN-MET-04: Detail Mode Types (additive-only) ───

export type DetailMode = 'sketch' | 'standard' | 'refined';

export interface SketchConfig {
  collapsedLayer: 'layer4';
  showSummaryOnly: boolean;
  maxNodesPerLevel?: number;
  autoGenerate: boolean;
}

export interface RefinedConfig {
  allLayersEditable: true;
  showWordCount: boolean;
  showTimestamps: boolean;
  allowInlineComments: boolean;
}

export interface PacketDetailLevel {
  mode: DetailMode;
  sketchConfig?: SketchConfig;
  refinedConfig?: RefinedConfig;
}

// ─── CN-MET-04: Detail Mode Input Types ───

export interface SetDetailModeInput {
  projectId: string;
  detailMode: DetailMode;
  doNotAskAgain?: boolean;
}

export interface GetPacketDetailInput {
  projectId: string;
}

export interface PacketDetailResponse {
  detailMode: DetailMode;
  doNotAskAgain: boolean;
  config: PacketDetailLevel;
}

export interface AutoGenerateSketchInput {
  projectId: string;
}

export interface SaveRefinedContentInput {
  projectId: string;
  layer4: string;
  wordCount?: number;
}
