import type { StoryNode } from '@/types'
import type { MarkdownParser } from './interface'

export class HeadingParser implements MarkdownParser {
  parse(markdown: string, projectId: string): StoryNode[] {
    const lines = markdown.split('\n')
    const nodes: StoryNode[] = []
    const stack: { id: string; level: number }[] = []
    let order = 0

    for (const line of lines) {
      const match = line.match(/^(#+)\s+(.+)/)
      if (!match) continue

      const level = match[1].length
      const title = match[2].trim()
      if (!title) continue

      const id = crypto.randomUUID()

      let parentId: string | null = null
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }
      if (stack.length > 0) {
        parentId = stack[stack.length - 1].id
      }

      const node: StoryNode = {
        id,
        projectId,
        type: level === 1 ? 'plot' : 'note',
        title,
        content: '',
        x: 100 + order * 180,
        y: level === 1 ? 50 : 200,
        createdAt: '',
        updatedAt: ''
      }

      nodes.push(node)
      stack.push({ id, level })
      order++
    }

    return nodes
  }
}
