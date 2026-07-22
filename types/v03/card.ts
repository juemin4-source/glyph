export type CardType = 'character' | 'location' | 'concept'

export interface CardFrontmatter {
  title: string
  type: CardType
  tags: string[]
  fields: Record<string, string>
  linkedScenes: string[]
  createdAt: string
  updatedAt: string
}