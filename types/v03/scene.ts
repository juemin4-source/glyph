export type SceneType = 'normal' | 'plot_point' | 'transition' | 'climax'

export interface SceneFrontmatter {
  title: string
  type: SceneType
  chapter: number
  order: number
  tags: string[]
  linkedCards: string[]
  next: BranchTarget[]
  createdAt: string
  updatedAt: string
}

export interface BranchTarget {
  target: string
  label: string
  condition?: string
}