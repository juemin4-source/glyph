/**
 * premise-variants.ts — AI 生成故事前提变体
 *
 * 直接走 TS Router → callLlm 管线，不经过 Rust 命令。
 * 2026-07-13: 从 premise_commands::generate_variants 存根改为真实 AI 调用。
 */

import { callLlm } from '../llm-client';
import type { PremiseVariant } from '../../contracts/premise.contract';
import type { WishlistItem } from '../../contracts/premise.contract';

export interface GenerateVariantsInput {
  wishlist: WishlistItem[];
  internalDrive: string;
  externalDrive: string;
}

export interface GenerateVariantsResult {
  variants: PremiseVariant[];
}

/**
 * 调用 LLM 生成 3 个故事前提变体。
 * 不经过 Router（因为不是用户消息），直接拼 prompt 调 callLlm。
 * 使用内置 provider 配置（用户需要在设置页配好）。
 */
export async function generateVariants(input: GenerateVariantsInput): Promise<GenerateVariantsResult> {
  const { wishlist, internalDrive, externalDrive } = input;

  // 构建 prompt
  const wishlistText = wishlist
    .filter(w => w.enabled)
    .map(w => `- [${w.category}] ${w.text}（优先级: ${w.priority}）`)
    .join('\n');

  const prompt = `你是一个专业的故事策划师。根据以下用户的需求清单，生成 3 个不同的故事前提变体。

## 用户愿望清单
${wishlistText || '（无）'}

## 内驱力
${internalDrive || '（未指定）'}

## 外驱力
${externalDrive || '（未指定）'}

请严格按照以下 JSON 数组格式输出，不要包含其他内容：
[
  {
    "title": "变体标题",
    "summary": "一句话概括故事核心",
    "coreConflict": "核心冲突描述"
  }
]

生成 3 个风格和方向各不相同的变体，每个变体要有鲜明的差异化。`;

  const messages = [
    { role: 'system' as const, content: '你是一个专业的故事策划师，擅长从用户需求中提炼故事前提。你只输出 JSON，不输出其他内容。' },
    { role: 'user' as const, content: prompt },
  ];

  // 本地 Qwen 38B（通过 Ollama）
  const model = {
    id: 'qwen3:8b',
    name: 'qwen3:8b',
    providerId: 'ollama',
    providerName: 'Ollama',
    description: '本地 Qwen 38B',
    costPer1KTokens: 0,
    icon: '🖥️',
    available: true,
  };

  const apiKey = ''; // 本地模型不需要 key

  try {
    const result = await callLlm(messages, {
      model,
      apiKey,
      timeout: 60000,
      outputSchema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            coreConflict: { type: 'string' },
          },
          required: ['title', 'summary', 'coreConflict'],
        },
      },
    });

    let variants: PremiseVariant[];
    try {
      const parsed = result.parsed?.status === 'valid' || result.parsed?.status === 'repaired'
        ? JSON.parse(result.content)
        : JSON.parse(result.content);
      variants = (Array.isArray(parsed) ? parsed : []).map((v: any, i: number) => ({
        id: `ai_${Date.now()}_${i}`,
        title: v.title || `变体 ${i + 1}`,
        summary: v.summary || '',
        coreConflict: v.coreConflict || '',
        selected: false,
      }));
    } catch {
      // 如果解析失败，从原始文本中提取
      variants = extractVariantsFromText(result.content);
    }

    if (variants.length === 0) {
      // 保险：保证至少返回 3 个占位
      variants = getFallbackVariants();
    }

    return { variants };
  } catch (err: any) {
    console.error('[premise-variants] LLM call failed:', err);
    // 出错时返回占位数据，让用户能继续流程
    return { variants: getFallbackVariants() };
  }
}

function extractVariantsFromText(text: string): PremiseVariant[] {
  try {
    // 尝试从文本中提取 JSON 数组
    const match = text.match(/\[\s*\{.*\}\s*\]/s);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return (Array.isArray(parsed) ? parsed : []).map((v: any, i: number) => ({
        id: `ai_${Date.now()}_${i}`,
        title: v.title || `变体 ${i + 1}`,
        summary: v.summary || '',
        coreConflict: v.coreConflict || '',
        selected: false,
      }));
    }
  } catch { /* fall through */ }
  return [];
}

function getFallbackVariants(): PremiseVariant[] {
  return [
    {
      id: `fb_${Date.now()}_0`,
      title: '英雄之旅',
      summary: '主角因意外事件被迫离开平凡生活，在冒险中成长并最终改变世界。',
      coreConflict: '主角的内心恐惧与外部威胁之间的对抗',
      selected: false,
    },
    {
      id: `fb_${Date.now()}_1`,
      title: '谜题 unravel',
      summary: '一个看似简单的谜团牵引出深埋多年的秘密，真相颠覆所有人的认知。',
      coreConflict: '追求真相的渴望 vs 真相可能带来的毁灭性后果',
      selected: false,
    },
    {
      id: `fb_${Date.now()}_2`,
      title: '抉择时刻',
      summary: '主角被迫在两个同样重要但彼此矛盾的价值之间做出选择，无论选哪个都要付出代价。',
      coreConflict: '两个正确选项之间的不可调和冲突',
      selected: false,
    },
  ];
}
