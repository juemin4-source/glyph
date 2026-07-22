export type CardType = 'character' | 'scene' | 'item'

export interface SettingCard {
  id: string
  projectId: string
  type: CardType
  name: string
  fields: Record<string, string>
  tags: string[]
  createdAt: string
  updatedAt: string
}
