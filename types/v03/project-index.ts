import type { SceneType, BranchTarget } from './scene'
import type { CardType } from './card'

export interface ProjectIndex {
  scenes: SceneIndexEntry[]
  cards: CardIndexEntry[]
  links: LinkEntry[]
  projectMeta: ProjectMeta
}

export interface SceneIndexEntry {
  id: string
  title: string
  type: SceneType
  chapter: number
  order: number
  tags: string[]
  linkedCards: string[]
  next: BranchTarget[]
  wordCount: number
  updatedAt: string
}

export interface CardIndexEntry {
  id: string
  title: string
  type: CardType
  tags: string[]
  linkedScenes: string[]
  updatedAt: string
}

export interface LinkEntry {
  from: string
  to: string
  type: 'bidirectional'
}

export interface ProjectMeta {
  name: string
  sceneCount: number
  cardCount: number
  totalWords: number
  lastIndexedAt: string
}