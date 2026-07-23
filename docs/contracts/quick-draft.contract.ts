/**
 * quick-draft.contract.ts — 织梦机 v2.0.1 QuickDraft 类型定义。
 *
 * QuickDraft 是快速起草功能：用户在输入框中写下想法，
 * 系统自动生成 premise + 章节草稿，并持久化到 quick_drafts 表。
 *
 * 设计约束：
 * - 引用已有 contract 类型时使用 `import type`，不可导入 runtime 值
 * - chapters 存储为 JSON 字符串（与 SQLite TEXT 模式匹配）
 */

export interface QuickDraftGenerateInput {
  projectId: string;
  userInput: string;
}

export interface QuickDraftTransferInput {
  draftId: string;
}

export interface QuickDraft {
  id: string;
  projectId: string;
  userInput: string;
  premiseText: string;
  premiseType: string;
  chapters: string;         // JSON string of Array<{title, content}>
  status: 'draft' | 'transferred';
  createdAt: number;
}

export interface QuickDraftGenerateResult {
  draft: QuickDraft;
  previewTitle: string;
  previewContent: string;   // concatenated chapter content for preview
}
