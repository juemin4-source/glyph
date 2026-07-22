import type { NarrativeUnit, NarrativeUnitType } from "../types/narrative-unit"
import type { NarrativeRelationship } from "../types/narrative-relationship"

export function parseMD(markdown: string, projectId: string) {
  const units: NarrativeUnit[] = []
  const relationships: NarrativeRelationship[] = []

  if (!markdown || markdown.trim().length === 0) {
    return { units, relationships, summary: { chapters: 0, scenes: 0, plotPoints: 0, wordCount: 0 } }
  }

  const lines = markdown.split("\n")
  const stack: { id: string; level: number }[] = []
  let currentUnitId: string | null = null
  let order = 0
  let wordCount = 0
  let chapters = 0, scenes = 0, plotPoints = 0
  let inCodeBlock = false
  let contentBuffer: string[] = []

  function flushContent(targetId: string | null) {
    if (targetId && contentBuffer.length > 0) {
      const unit = units.find(u => u.id === targetId)
      if (unit) {
        unit.content = contentBuffer.join("\n").trim()
        for (const line of contentBuffer) wordCount += line.split(/\s+/).filter(w => w.length > 0).length
      }
    }
    contentBuffer = []
  }

  for (const raw of lines) {
    const trimmed = raw.trim()
    if (trimmed.startsWith("```")) { inCodeBlock = !inCodeBlock; if (currentUnitId) contentBuffer.push(raw); continue }
    if (inCodeBlock) { if (currentUnitId) contentBuffer.push(raw); continue }
    if (trimmed.startsWith(">")) { if (currentUnitId) contentBuffer.push(trimmed.replace(/^>\s?/, "")); continue }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const title = headingMatch[2].trim()
      if (!title) continue

      flushContent(currentUnitId)
      let nodeType: NarrativeUnitType
      if (level === 1) { nodeType = "chapter"; chapters++ }
      else if (level <= 3) { nodeType = "scene"; scenes++ }
      else { nodeType = "plot_point"; plotPoints++ }

      while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop()
      const parentId = stack.length > 0 ? stack[stack.length - 1].id : null
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      units.push({ id, projectId, type: nodeType, parentId, order: order++, title, content: "", fateNode: null, linkedCards: [], createdAt: now, updatedAt: now })
      stack.push({ id, level })
      currentUnitId = id
      wordCount += title.split(/\s+/).filter(w => w.length > 0).length
      continue
    }
    if (currentUnitId) contentBuffer.push(raw)
  }
  flushContent(currentUnitId)

  for (let i = 0; i < units.length - 1; i++)
    relationships.push({ id: crypto.randomUUID(), projectId, sourceId: units[i].id, targetId: units[i + 1].id, type: "sequence" })

  return { units, relationships, summary: { chapters, scenes, plotPoints, wordCount } }
}

export function exportToMD(units: NarrativeUnit[]): string {
  if (units.length === 0) return ""
  const sorted = [...units].sort((a, b) => a.order - b.order)
  const childrenMap = new Map<string, NarrativeUnit[]>()
  for (const u of sorted) { if (u.parentId) { const k = childrenMap.get(u.parentId) || []; k.push(u); childrenMap.set(u.parentId, k) } }
  const lines: string[] = []
  function writeNode(u: NarrativeUnit, depth: number) {
    lines.push("#".repeat(Math.min(depth + 1, 6)) + " " + u.title)
    if (u.content?.trim()) { lines.push(""); lines.push(u.content.trim()) }
    lines.push("")
    const kids = (childrenMap.get(u.id) || []).sort((a, b) => a.order - b.order)
    for (const k of kids) writeNode(k, depth + 1)
  }
  for (const u of sorted.filter(u => !u.parentId).sort((a, b) => a.order - b.order)) writeNode(u, 0)
  return lines.join("\n").trimEnd()
}
