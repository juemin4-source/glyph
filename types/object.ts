// 织梦机 Object 类型定义
// 数据契约 v0.1.1

export type ObjectType =
  | 'character' | 'location' | 'organization' | 'rule'
  | 'event' | 'scene' | 'item' | 'term' | 'chapter'
  | 'idea' | 'question' | 'option' | 'judgment' | 'principle'
  | 'uncategorized'

export type ObjectStatus =
  | 'placeholder' | 'draft' | 'pending' | 'to_verify'
  | 'locked' | 'discarded' | 'archived'

export type CanonLevel =
  | 'uncollected' | 'draft_canon' | 'project_canon' | 'core_canon'

export interface ObjectEntry {
  id: string
  title: string
  type: ObjectType
  status: ObjectStatus
  canonLevel: CanonLevel
  tags: string[]
  aliases: string[]
  docPath: string
  linkedBoards: string[]
  refCount: number
  createdAt: string
  updatedAt: string
}

// ObjectFrontmatter — embedded in the `.md` file's frontmatter block for object documents
export interface ObjectFrontmatter {
  id: string
  title: string
  type: ObjectType
  status: ObjectStatus
  canonLevel: CanonLevel
  tags: string[]
  aliases: string[]
  slug?: string
  createdAt: string
  updatedAt: string
  lastJudgmentAt?: string
  judgmentCount?: number
}