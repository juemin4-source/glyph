// ===== UI-Layer Types for 织梦机 World Objects =====
// These are in-memory types used by the UI components, separate from
// the tauri-api persistence types. A future bridge layer maps between them.

export type ObjectType = '人物' | '地点' | '组织' | '规则/机制' | '事件' | '物品' | '术语' | '章节';

export const OBJECT_TYPES: ObjectType[] = [
  '人物', '地点', '组织', '规则/机制', '事件', '物品', '术语', '章节'
];

export type ObjectStatus = '占位' | '草稿' | '待定' | '待验证' | '锁定' | '废弃';

export const OBJECT_STATUSES: ObjectStatus[] = [
  '占位', '草稿', '待定', '待验证', '锁定', '废弃'
];

export type CanonLevel = '未收录' | '草案正典' | '项目正典' | '核心正典';

export const CANON_LEVELS: CanonLevel[] = [
  '未收录', '草案正典', '项目正典', '核心正典'
];

export const CANON_COLORS: Record<CanonLevel, string> = {
  '未收录': '#666666',
  '草案正典': '#CE93D8',
  '项目正典': '#90CAF9',
  '核心正典': '#FFB74D',
};

export type NavTab = '文档' | '画板' | '设定集' | '判断记录' | '正典手册' | 'AI';

export type CanvasTab = '角色关系图' | '时间线' | '设定推演图';

export const CANVAS_TABS: CanvasTab[] = ['角色关系图', '时间线', '设定推演图'];

export type ConnectionType = '相关' | '影响' | '冲突' | '支撑' | '替代' | '属于' | '发生于' | '导致';

export const CONNECTION_TYPES: ConnectionType[] = [
  '相关', '影响', '冲突', '支撑', '替代', '属于', '发生于', '导致'
];

export type JudgmentOperation = '锁定' | '废弃' | '待验证' | '提升正典' | '收录';

export interface JudgmentRecord {
  id: string;
  objectId: string;
  objectName: string;
  operationType: JudgmentOperation;
  reason: string;
  timestamp: number;
  previousStatus: string;
  newStatus: string;
}

export interface WorldObject {
  id: string;
  projectId?: string;
  name: string;
  type: ObjectType;
  status: ObjectStatus;
  canonLevel: CanonLevel;
  tags: string[];
  aliases: string[];
  selectedBoards: string[];
  content: string;
  referencesCount: number;
  judgmentHistory: JudgmentRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface Connection {
  id: string;
  projectId?: string;
  sourceId: string;
  targetId: string;
  type: ConnectionType;
  label: string;
}

export interface CanvasNodePosition {
  objectId: string;
  x: number;
  y: number;
}

export interface StickyNote {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface CanvasTabState {
  id?: string;
  projectId?: string;
  tabId: CanvasTab;
  positions: Record<string, CanvasNodePosition>;
  stickyNotes: StickyNote[];
  connections: Connection[];
  scale: number;
  panX: number;
  panY: number;
}

export interface TemplatePreset {
  type: ObjectType;
  defaultStatus: ObjectStatus;
  defaultTags: string[];
  defaultContent: string;
}

export type CanvasToolMode = 'select' | 'drag' | 'addObject' | 'text' | 'addSticky' | 'addConnection' | 'partition' | 'template';

export interface StatusDisplayConfig {
  border: string;
  background: string;
  text: string;
}

export const STATUS_DISPLAY: Record<ObjectStatus, StatusDisplayConfig> = {
  '占位': { border: '2px dashed #555', background: '#1a1a1a', text: '#888' },
  '草稿': { border: '2px solid #555', background: '#1e1e1e', text: '#ccc' },
  '待定': { border: '2px solid #2196F3', background: '#0D47A1', text: '#90CAF9' },
  '待验证': { border: '2px solid #FF9800', background: '#E65100', text: '#FFCC80' },
  '锁定': { border: '2px solid #4CAF50', background: '#1B5E20', text: '#A5D6A7' },
  '废弃': { border: '2px solid #f44336', background: '#B71C1C', text: '#EF9A9A' }
};

export interface Project {
  id: string;
  title: string;
  genre: string;
  status: 'drafting' | 'conceiving' | 'editing' | 'done' | 'demo';
  wordCount: number;
  gradient: [string, string];
}

// ===== v1.2 New Types =====

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'failed' | 'offline';

export interface ChangelogEntry {
  timestamp: number;
  action: 'create_object' | 'delete_object' | 'update_object' | 'move_canvas_node' | 'create_connection' | 'delete_connection' | 'update_canvas_state';
  objectId: string;
  snapshot: Record<string, any>;
}

export type SyncOperationType = 'createObject' | 'updateObject' | 'deleteObject' | 'saveCanvasState' | 'createConnection' | 'deleteConnection' | 'appendJudgment';

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  payload: any;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttempt?: number;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  path: string;
  objectCount: number;
  connectionCount: number;
}

export interface ImportResult {
  success: boolean;
  projectId: string;
  projectName: string;
  objectCount: number;
  connectionCount: number;
}

export interface CanvasTabStateResponse {
  state: CanvasTabState;
  accepted: boolean;
  currentVersion: number;
  error?: 'VERSION_CONFLICT';
}

export interface GenreGradient {
  genre: string;
  gradient: [string, string];
}

export const GENRE_GRADIENTS: GenreGradient[] = [
  { genre: '科幻', gradient: ['#667eea', '#764ba2'] },
  { genre: '奇幻', gradient: ['#0f2027', '#203a43'] },
  { genre: '武侠', gradient: ['#8e0e00', '#1f1c18'] },
  { genre: '悬疑', gradient: ['#232526', '#414345'] },
  { genre: '言情', gradient: ['#e44d26', '#f16529'] },
  { genre: '历史', gradient: ['#283048', '#859398'] },
  { genre: '都市', gradient: ['#2c3e50', '#3498db'] },
  { genre: '末世', gradient: ['#1a1a2e', '#16213e'] },
  { genre: '恐怖', gradient: ['#0f0c29', '#302b63'] },
  { genre: '其他', gradient: ['#6366f1', '#8b5cf6'] },
  { genre: '未分类', gradient: ['#6366f1', '#8b5cf6'] },
];

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  presetObjectTypes: Array<{ type: ObjectType; name: string }>;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: '空白开始',
    description: '从零开始，自由创作',
    presetObjectTypes: [],
  },
  {
    id: 'three-act',
    name: '经典三幕式',
    description: '开端→发展→高潮 三幕结构',
    presetObjectTypes: [
      { type: '章节', name: '第一幕：开端' },
      { type: '章节', name: '第二幕：发展' },
      { type: '章节', name: '第三幕：高潮' },
    ],
  },
  {
    id: 'character-driven',
    name: '角色驱动',
    description: '以核心角色为中心展开',
    presetObjectTypes: [
      { type: '人物', name: '主角' },
      { type: '人物', name: '配角' },
      { type: '人物', name: '反派' },
    ],
  },
  {
    id: 'world-first',
    name: '世界先行',
    description: '先构建世界观和规则',
    presetObjectTypes: [
      { type: '规则/机制', name: '世界基础规则' },
      { type: '地点', name: '核心场景' },
      { type: '组织', name: '主要势力' },
    ],
  },
];
