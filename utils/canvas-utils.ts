import type { StoryNode, Link, NodeType } from '@/types'

/**
 * Auto-layout nodes in a spaced tree pattern.
 * Each root-level group (level 1) starts a new row.
 */
export function autoLayout(
  nodes: StoryNode[],
  startX = 80,
  startY = 60,
  gapX = 220,
  gapY = 100
): StoryNode[] {
  // Reconstruct hierarchy from the parentId using level logic
  const roots: StoryNode[] = []
  const childrenMap = new Map<string, StoryNode[]>()
  const levelStack: { id: string; level: number }[] = []

  for (const node of nodes) {
    // Determine parent by level stack
    while (
      levelStack.length > 0 &&
      levelStack[levelStack.length - 1].level >= getNodeLevel(node)
    ) {
      levelStack.pop()
    }
    if (levelStack.length > 0) {
      const parentId = levelStack[levelStack.length - 1].id
      const kids = childrenMap.get(parentId) || []
      kids.push(node)
      childrenMap.set(parentId, kids)
    } else {
      roots.push(node)
    }
    levelStack.push({ id: node.id, level: getNodeLevel(node) })
  }

  const result: StoryNode[] = []
  let currentY = startY

  function place(nodes: StoryNode[], depth: number) {
    let currentX = startX
    const positioned: StoryNode[] = []

    for (const node of nodes) {
      positioned.push({
        ...node,
        x: currentX,
        y: currentY
      })
      currentX += gapX
    }

    result.push(...positioned)

    // Recurse children - each root's children go below
    if (positioned.length > 0) {
      const first = positioned[0]
      const allChildren: StoryNode[] = []
      for (const p of positioned) {
        const kids = childrenMap.get(p.id) || []
        allChildren.push(...kids)
      }
      if (allChildren.length > 0) {
        currentY += gapY
        place(allChildren, depth + 1)
        currentY -= gapY
      }
    }
  }

  place(roots, 0)
  return result
}

function getNodeLevel(node: StoryNode): number {
  // Derive level from type: plot = 1 (chapter-level), everything else = 2+
  return node.type === 'plot' ? 1 : node.type === 'note' ? 2 : 2
}

/**
 * Export nodes and content to structured Markdown.
 * Nodes without a parent link become h1, children become h2/h3.
 */
export function exportToMarkdown(nodes: StoryNode[], links: Link[]): string {
  if (nodes.length === 0) return ''

  const sorted = [...nodes].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y
    return a.x - b.x
  })

  const parentIdMap = new Map<string, string>()
  for (const link of links) {
    parentIdMap.set(link.targetId, link.sourceId)
  }

  const roots = sorted.filter((n) => !parentIdMap.has(n.id))
  const childrenMap = new Map<string, StoryNode[]>()
  for (const node of sorted) {
    const parentId = parentIdMap.get(node.id)
    if (parentId) {
      const kids = childrenMap.get(parentId) || []
      kids.push(node)
      childrenMap.set(parentId, kids)
    }
  }

  const lines: string[] = []

  function writeNode(node: StoryNode, depth: number) {
    const prefix = '#'.repeat(Math.min(depth + 1, 6))
    lines.push(`${prefix} ${node.title}`)
    if (node.content?.trim()) {
      lines.push('')
      lines.push(node.content.trim())
    }
    lines.push('')

    const kids = childrenMap.get(node.id) || []
    for (const kid of kids) {
      writeNode(kid, depth + 1)
    }
  }

  for (const root of roots) {
    writeNode(root, 0)
  }

  return lines.join('\n')
}
