// 织梦机 Judgment 类型定义
// 数据契约 v0.1.1

export type JudgmentTargetType =
  | 'project' | 'document' | 'object'
  | 'board' | 'board_element' | 'board_edge'

export type JudgmentOperation =
  | 'lock' | 'unlock' | 'discard' | 'restore'
  | 'promote_canon' | 'demote_canon'
  | 'change_status' | 'change_type' | 'rename'

export interface JudgmentRecord {
  id: string
  targetType: JudgmentTargetType
  targetId: string
  operation: JudgmentOperation
  reason?: string
  before?: unknown
  after?: unknown
  createdAt: string
}
