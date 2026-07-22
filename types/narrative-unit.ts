export type NarrativeUnitType = 'chapter' | 'scene' | 'plot_point' | 'transition'

export type FateNode =
  | '藏' | '生' | '动' | '长' | '育' | '止' | '杀' | '归'
  | '将动' | '将育' | '将杀' | '将藏'

export interface NarrativeUnit {
  id: string
  projectId: string
  type: NarrativeUnitType
  parentId: string | null
  order: number
  title: string
  content: string
  fateNode: FateNode | null
  linkedCards: string[]
  metadata?: { originalType?: string }
  createdAt: string
  updatedAt: string
}
