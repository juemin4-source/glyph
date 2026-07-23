/**
 * decision-log.contract.ts — 织梦机 v2 D 轮 Decision Log 类型定义。
 *
 * Decision Log 是追加式审计表，记录所有关键操作（临时假设采纳/驳回、
 * AI 生成确认、packet 确认、设定写入等）。
 *
 * 设计约束：
 * - 追加模式，不可删除（UI 可隐藏，但数据不可销毁）
 * - 不依赖外部审计系统
 * - 不修改已有 contract（chapter-packet / setting 等）
 */

// ─── 操作类型枚举 ───

export type DecisionOperation =
  // 章节包
  | 'packet_created'
  | 'packet_confirmed'
  | 'packet_ai_generated'
  | 'packet_deleted'
  // AI 输出三态
  | 'ai_suggestion_created'
  | 'ai_suggestion_accepted'
  | 'ai_suggestion_rejected'
  | 'write_preview_created'
  | 'write_preview_confirmed'
  | 'write_preview_rejected'
  // 临时假设
  | 'assumption_adopted'
  | 'assumption_rejected'
  // 正文
  | 'draft_generated'
  | 'draft_confirmed'
  | 'manual_edit';

// ─── 数据结构 ───

export interface DecisionLogEntry {
  id: string;
  projectId: string;
  operation: DecisionOperation;
  summary: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  createdAt: number;
}

// ─── 输入/输出类型 ───

export interface AppendDecisionLogInput {
  projectId: string;
  operation: DecisionOperation;
  summary: string;
  entityType?: string;
  entityId?: string;
  details?: string;
}

export interface ListDecisionLogsInput {
  projectId: string;
}

export interface GetDecisionLogInput {
  id: string;
}
