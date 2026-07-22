export interface MigrationState {
  completed: boolean
  completedAt: string | null
  projectId: string
  unitCount: number
  relationshipCount: number
}
