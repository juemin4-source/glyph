// 织梦机 Board 类型定义
// 数据契约 v0.1.1

export type BoardType =
  | 'free' | 'character_relation' | 'timeline' | 'deduction'
  | 'chapter_layout' | 'force_relation' | 'foreshadowing'
  | 'logic_loop' | 'mind_map'

export type RelationType =
  | 'related' | 'influences' | 'conflicts' | 'supports'
  | 'replaces' | 'belongs_to' | 'occurs_at' | 'leads_to'
  | 'hidden' | 'betrays' | 'allies' | 'hostile'

export type BoardElementKind =
  | 'object' | 'text' | 'sticky' | 'section' | 'table' | 'image'

export interface BoardElement {
  id: string
  kind: BoardElementKind
  x: number; y: number
  width?: number; height?: number
  zIndex?: number
  style?: Record<string, any>
}

export interface BoardEdge {
  id: string
  sourceId: string
  targetId: string
  type: RelationType
  label?: string
}

export interface Board {
  id: string
  title: string
  type: BoardType
  projectId: string
  elements: BoardElement[]
  edges: BoardEdge[]
  viewport?: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}
