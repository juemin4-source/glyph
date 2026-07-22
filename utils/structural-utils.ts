import type { NarrativeUnit, NarrativeUnitType } from "../types/narrative-unit"
import type { NarrativeRelationship } from "../types/narrative-relationship"
import type { ReorderPosition, ReorderResult } from "../types/structural"
import type { StoryNode, Link } from "../types"

const V1_TO_V2: Record<string, NarrativeUnitType> = {
  plot: "chapter", character_beat: "scene", twist: "plot_point",
  foreshadow: "plot_point", note: "transition"
}

export function getChildren(units: NarrativeUnit[], parentId: string): NarrativeUnit[] {
  return units.filter(u => u.parentId === parentId).sort((a, b) => a.order - b.order)
}

export function flattenTree(units: NarrativeUnit[]): NarrativeUnit[] {
  const roots = units.filter(u => !u.parentId).sort((a, b) => a.order - b.order)
  const result: NarrativeUnit[] = []
  function walk(u: NarrativeUnit) {
    result.push(u)
    for (const c of units.filter(x => x.parentId === u.id).sort((a, b) => a.order - b.order)) walk(c)
  }
  for (const r of roots) walk(r)
  return result
}

export function validateHierarchy(units: NarrativeUnit[]): string[] {
  const errors: string[] = []
  const map = new Map(units.map(u => [u.id, u]))
  for (const u of units) {
    if (!u.parentId) continue
    if (!map.has(u.parentId)) { errors.push(`INVALID_PARENT: unit "${u.id}" -> nonexistent "${u.parentId}"`); continue }
    const visited = new Set<string>(); let cur: string | null = u.parentId
    while (cur) {
      if (cur === u.id) { errors.push(`CIRCULAR_HIERARCHY: unit "${u.id}"`); break }
      if (visited.has(cur)) { errors.push(`CIRCULAR_HIERARCHY: loop at "${cur}"`); break }
      visited.add(cur); cur = map.get(cur)?.parentId ?? null
    }
  }
  return errors
}

export function migrateV1Node(n: StoryNode, projectId: string): NarrativeUnit {
  const now = new Date().toISOString()
  return { id: n.id, projectId, type: V1_TO_V2[n.type] ?? "transition", parentId: null, order: 0, title: n.title, content: n.content ?? "", fateNode: null, linkedCards: [], metadata: { originalType: n.type }, createdAt: n.createdAt || now, updatedAt: n.updatedAt || now }
}

export function migrateV1Link(l: Link): NarrativeRelationship {
  return { id: l.id, projectId: l.projectId, sourceId: l.sourceId, targetId: l.targetId, type: "sequence", metadata: { originalType: l.type } }
}

export function reorderNode(units: NarrativeUnit[], rels: NarrativeRelationship[], unitId: string, pos: ReorderPosition): ReorderResult {
  const updatedUnits = units.map(u => ({ ...u }))
  const updatedRels = rels.map(r => ({ ...r }))
  const node = updatedUnits.find(u => u.id === unitId)
  if (!node) return { updatedUnits, updatedRelationships: updatedRels }
  node.parentId = pos.parentId; node.order = pos.index
  const siblings = updatedUnits.filter(u => u.id !== unitId && u.parentId === pos.parentId).sort((a, b) => a.order - b.order)
  let o = 0
  for (const s of siblings) { if (o === pos.index) o++; s.order = o++ }
  if (node.order >= o) node.order = o
  return { updatedUnits, updatedRelationships: updatedRels }
}

export function exportToMD(units: NarrativeUnit[]): string {
  if (!units.length) return ""
  const sorted = [...units].sort((a, b) => a.order - b.order)
  const childrenMap = new Map<string, NarrativeUnit[]>()
  for (const u of sorted) { if (u.parentId) { const k = childrenMap.get(u.parentId) || []; k.push(u); childrenMap.set(u.parentId, k) } }
  const lines: string[] = []
  const getLevel = (t: NarrativeUnitType) => ({ chapter: 1, scene: 2, transition: 3, plot_point: 4 })[t] ?? 2
  function write(u: NarrativeUnit) {
    lines.push("#".repeat(getLevel(u.type)) + " " + u.title)
    if (u.content?.trim()) { lines.push(""); lines.push(u.content.trim()) }
    lines.push("")
    for (const c of (childrenMap.get(u.id) || []).sort((a, b) => a.order - b.order)) write(c)
  }
  for (const r of sorted.filter(u => !u.parentId).sort((a, b) => a.order - b.order)) write(r)
  return lines.join("\n").trimEnd()
}
