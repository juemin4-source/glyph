export type LinkType = 'timeline' | 'causality' | 'conflict' | 'emotion' | 'association'

export interface Link {
  id: string
  projectId: string
  sourceId: string
  targetId: string
  type: LinkType
  label?: string
}
