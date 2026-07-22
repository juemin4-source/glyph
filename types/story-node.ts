import type { NodeSizeMode } from './canvas'

export type NodeType = 'plot' | 'character_beat' | 'twist' | 'foreshadow' | 'note'

export interface StoryNode {
  id: string
  projectId: string
  type: NodeType
  title: string
  content: string // Markdown
  x: number
  y: number
  sizeMode?: NodeSizeMode
  createdAt: string
  updatedAt: string
}
