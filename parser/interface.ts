import type { StoryNode } from '@/types'

export interface MarkdownParser {
  parse(markdown: string, projectId: string): StoryNode[]
}
