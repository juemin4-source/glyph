export type StructureNodeType = 'book' | 'phase' | 'position' | 'chapter';

/**
 * ChapterFunction — 本章功能枚举（Round C 新增）
 */
export type ChapterFunction =
  | 'opening'
  | 'setup'
  | 'escalation'
  | 'reversal'
  | 'reveal'
  | 'relationship_shift'
  | 'decision'
  | 'aftermath'
  | 'transition'
  | 'climax'
  | 'closure';

export interface StructureNode {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  nodeType: StructureNodeType;
  narrativeFunction: string;
  summary: string;
  positionX: number;
  positionY: number;
  sortOrder: number;
  /** Round C 新增：本章功能枚举 */
  chapterFunction?: ChapterFunction;
  /** Round C 新增：线路字段（预留） */
  line?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateStructureNodeInput {
  projectId: string;
  parentId: string | null;
  title: string;
  nodeType: StructureNodeType;
  narrativeFunction: string;
  summary: string;
  positionX: number;
  positionY: number;
  sortOrder: number;
  /** Round C 新增 */
  chapterFunction?: ChapterFunction;
  /** Round C 新增 */
  line?: string;
}

export interface UpdateStructureNodeInput {
  id: string;
  parentId: string | null;
  title: string;
  nodeType: StructureNodeType;
  narrativeFunction: string;
  summary: string;
  positionX: number;
  positionY: number;
  sortOrder: number;
  /** Round C 新增 */
  chapterFunction?: ChapterFunction;
  /** Round C 新增 */
  line?: string;
}

// ===== CN-MET-02: Canvas 2 StructureGraph L1-L4 Types =====

export type LayerType = 'book' | 'shiwei' | 'hou' | 'zhang';

export interface BookLayer {
  id: string;
  title: string;
  summary: string;
  children: ShiweiLayer[];
}

export interface ShiweiLayer {
  id: string;
  title: string;
  timePeriod: string;
  summary: string;
  children: HouLayer[];
}

export interface HouLayer {
  id: string;
  title: string;
  chapterRange: string;
  summary: string;
  children: ZhangLayer[];
}

export interface ZhangLayer {
  id: string;
  title: string;
  sceneCount: number;
  wordCount: number;
  summary: string;
}

export interface HierarchyBreadcrumb {
  layers: { type: LayerType; id: string; label: string }[];
  currentLayer: LayerType;
}

export interface StructureGraphState {
  layers: StructureGraphLayerState[];
  selectedNodeId?: string;
  zoomLevel: number;
  viewport: { x: number; y: number; zoom: number };
}

export interface StructureGraphLayerState {
  layerType: LayerType;
  nodeIds: string[];
  expandedNodeIds: string[];
  selectedNodeId?: string;
}

// Canvas2NodeRecord — matches Rust backend Canvas2NodeRecord
export interface Canvas2NodeRecord {
  id: string;
  projectId: string;
  parentId: string | null;
  layerType: LayerType;
  title: string;
  summary: string;
  timePeriod: string;
  chapterRange: string;
  sceneCount: number;
  wordCount: number;
  positionX: number;
  positionY: number;
  expanded: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface SaveCanvas2NodeInput {
  id?: string;
  projectId: string;
  parentId: string | null;
  layerType: LayerType;
  title: string;
  summary: string;
  timePeriod: string;
  chapterRange: string;
  sceneCount: number;
  wordCount: number;
  positionX: number;
  positionY: number;
  expanded: boolean;
  sortOrder: number;
}

export interface StructureTreeOutput {
  nodes: Canvas2NodeRecord[];
}

export interface UpdateNodePositionInput {
  id: string;
  positionX: number;
  positionY: number;
}

export interface ZoomToLayerInput {
  projectId: string;
  layerType: LayerType;
}

export interface ZoomToLayerOutput {
  nodes: Canvas2NodeRecord[];
}

export interface AiGenerateStructureInput {
  projectId: string;
}

export interface AiGenerateStructureOutput {
  nodes: Canvas2NodeRecord[];
  success: boolean;
  message: string;
}
