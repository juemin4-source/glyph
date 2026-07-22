export type NarrativeRelationshipType = 'sequence'

export interface NarrativeRelationship {
  id: string
  projectId: string
  sourceId: string
  targetId: string
  type: NarrativeRelationshipType
  metadata?: { originalType?: string }
}
