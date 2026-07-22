export interface ReorderPosition { parentId: string | null; index: number }
export interface ReorderResult {
  updatedUnits: import("./narrative-unit").NarrativeUnit[]
  updatedRelationships: import("./narrative-relationship").NarrativeRelationship[]
}
