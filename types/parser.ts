export interface MDParseResult {
  units: import("./narrative-unit").NarrativeUnit[]
  relationships: import("./narrative-relationship").NarrativeRelationship[]
  summary: { chapters: number; scenes: number; plotPoints: number; wordCount: number }
}
