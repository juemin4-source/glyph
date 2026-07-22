/**
 * quick-draft.ts — AI 一键速写生成
 *
 * 直接走 TS callLlm 管线，不经过 Rust 命令。
 * 根据用户的输入，生成前提文本和章节内容。
 */

import { callLlm } from '../llm-client';
import type { QuickDraftGenerateResult } from '../../contracts/quick-draft.contract';

export interface QuickDraftInput {
  projectId: string;
  userInput: string;
}

/**
 * 调用本地 LLM 根据用户输入生成速写内容。
 */
export async function generateQuickDraft(input: QuickDraftInput): Promise<QuickDraftGenerateResult> {
  const { projectId, userInput } = input;

  const prompt = `你是一个专业的故事创作者。根据用户输入的创作灵感，生成一个简单的故事大纲和第一章内容。

## 用户输入
${userInput}

请严格按照以下 JSON 格式输出，不要包含其他内容：
{
  "title": "故事标题",
  "premise": "一句话故事前提",
  "chapters": [
    { "title": "章节标题", "content": "该章节的正文内容" }
  ]
}

生成 1-2 章内容作为开头，每章 200-500 字。`;

  const messages = [
    { role: 'system' as const, content: '你是一个专业的故事创作者，擅长根据灵感快速生成故事内容。你只输出 JSON。' },
    { role: 'user' as const, content: prompt },
  ];

  const model = {
    id: 'qwen3:8b', name: 'qwen3:8b', providerId: 'ollama',
    providerName: 'Ollama', description: '本地 Qwen 38B',
    costPer1KTokens: 0, icon: '🖥️', available: true,
  };

  try {
    const result = await callLlm(messages, { model, apiKey: '', timeout: 120000 });
    const parsed = JSON.parse(result.content);
    const title = parsed.title || '速写草稿';
    const premise = parsed.premise || '';
    const chapters = Array.isArray(parsed.chapters) ? parsed.chapters : [];

    const chaptersJson = JSON.stringify(chapters.map((c: any) => ({
      title: c.title || '章节',
      content: c.content || '',
    })));

    const previewTitle = title;
    const previewContent = chapters.map((c: any) => c.content || '').join('\n\n');

    return {
      draft: {
        id: `qd_${Date.now()}`,
        projectId,
        userInput,
        premiseText: premise,
        premiseType: 'quick_draft',
        chapters: chaptersJson,
        status: 'draft',
        createdAt: Date.now(),
      },
      previewTitle,
      previewContent,
    };
  } catch (err: any) {
    console.error('[quick-draft] LLM call failed:', err);
    // Fallback: return a basic result so UI doesn't crash
    const fallbackContent = `根据「${userInput}」的灵感，一个故事正在酝酿中……\n\n请重试生成，或调整输入内容。`;
    return {
      draft: {
        id: `qd_${Date.now()}`, projectId, userInput,
        premiseText: userInput, premiseType: 'quick_draft',
        chapters: JSON.stringify([{ title: '草稿', content: fallbackContent }]),
        status: 'draft', createdAt: Date.now(),
      },
      previewTitle: '速写草稿',
      previewContent: fallbackContent,
    };
  }
}
