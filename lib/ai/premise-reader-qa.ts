/**
 * premise-reader-qa.ts — AI 生成读者问答
 *
 * 直接走 TS callLlm 管线，不经过 Rust 命令。
 * 根据选中的前提变体，生成读者可能会问的问题。
 */

import { callLlm } from '../llm-client';
import type { PremiseVariant, ReaderQuestion } from '../../docs/contracts/premise.contract';

export interface GenerateReaderQAInput {
  variants: PremiseVariant[];
  selectedVariantId: string;
}

export interface GenerateReaderQAResult {
  questions: ReaderQuestion[];
}

/**
 * 根据选中的前提变体，调用 LLM 生成 5-7 个读者问答。
 */
export async function generateReaderQA(input: GenerateReaderQAInput): Promise<GenerateReaderQAResult> {
  const { variants, selectedVariantId } = input;
  const selected = variants.find(v => v.id === selectedVariantId) || variants[0];

  const prompt = `你是一个专业的故事编辑。根据以下故事前提变体，生成 5-7 个读者在读完整本书后最可能提出的问题。

## 故事变体

标题: ${selected.title}
概要: ${selected.summary}
核心冲突: ${selected.coreConflict}

请严格按照以下 JSON 数组格式输出，不要包含其他内容：
[
  {
    "question": "读者可能会问的问题",
    "category": "情节|角色|世界观|主题"
  }
]

问题要有深度，能引发讨论，而不是简单的事实性问题。`;

  const messages = [
    { role: 'system' as const, content: '你是一个专业的故事编辑，擅长从故事前提中提炼读者可能关心的问题。你只输出 JSON。' },
    { role: 'user' as const, content: prompt },
  ];

  const model = {
    id: 'qwen3:8b', name: 'qwen3:8b', providerId: 'ollama',
    providerName: 'Ollama', description: '本地 Qwen 38B',
    costPer1KTokens: 0, icon: '🖥️', available: true,
  };

  try {
    const result = await callLlm(messages, {
      model, apiKey: '', timeout: 60000,
      outputSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            category: { type: 'string', enum: ['情节', '角色', '世界观', '主题'] },
          },
          required: ['question', 'category'],
        },
      },
    });

    let questions: ReaderQuestion[];
    try {
      const parsed = JSON.parse(result.content);
      questions = (Array.isArray(parsed) ? parsed : []).map((q: any, i: number) => ({
        id: `q_${Date.now()}_${i}`,
        question: q.question || '',
        category: q.category || '情节',
      }));
    } catch {
      questions = extractQuestionsFromText(result.content);
    }

    if (questions.length === 0) questions = getFallbackQuestions();
    return { questions };
  } catch (err: any) {
    console.error('[premise-reader-qa] LLM call failed:', err);
    return { questions: getFallbackQuestions() };
  }
}

function extractQuestionsFromText(text: string): ReaderQuestion[] {
  try {
    const match = text.match(/\[\s*\{.*\}\s*\]/s);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return (Array.isArray(parsed) ? parsed : []).map((q: any, i: number) => ({
        id: `q_${Date.now()}_${i}`, question: q.question || '', category: q.category || '情节',
      }));
    }
  } catch { /* fall through */ }
  return [];
}

function getFallbackQuestions(): ReaderQuestion[] {
  return [
    { id: `fb_${Date.now()}_0`, question: '主角的核心动机是什么？是什么驱动他/她踏上这段旅程？', category: '角色' },
    { id: `fb_${Date.now()}_1`, question: '故事世界中最独特的一条规则是什么？', category: '世界观' },
    { id: `fb_${Date.now()}_2`, question: '最大的反转可能在哪个环节出现？', category: '情节' },
    { id: `fb_${Date.now()}_3`, question: '这个故事最打动人的情感核心是什么？', category: '主题' },
    { id: `fb_${Date.now()}_4`, question: '配角中有哪个可能会成为读者最喜爱的角色？', category: '角色' },
  ];
}
