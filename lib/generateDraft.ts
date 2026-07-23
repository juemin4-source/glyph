/**
 * generateDraft — 前端 AI 正文生成器 (织梦机 v2)
 *
 * 从已确认的 ChapterPacket 构造写作 prompt，调用 Router 生成正文 draft。
 *
 * [v2.1.1-AI] Rewired to use Router instead of direct callLlm.
 *
 * 硬规则：
 * - 不 mock AI
 * - 不自动覆盖正文（由调用方控制 preview + confirm）
 */
import type { ChapterPacket } from '../docs/contracts/chapter-packet.contract';
import type { AiModel } from '../types/ai';
import type { AiOutputType } from './ai-output';

// ─── Types ───

export interface GenerateDraftOptions {
  packet: ChapterPacket;
  model: AiModel;
  /** AI 输出三态：discuss | suggest | write_preview。默认 write_preview */
  outputType?: AiOutputType;
  /** Allows the caller to cancel a long-running generation. */
  signal?: AbortSignal;
}

// ─── Layer resolver (handles both string and parsed object layers) ───

function safeLayer<T>(layer: unknown, fallback: T): T {
  if (typeof layer === 'string') {
    try {
      return JSON.parse(layer) as T;
    } catch {
      return fallback;
    }
  }
  return (layer ?? fallback) as T;
}

// ─── Prompt Builder ───

export function buildDraftPrompt(packet: ChapterPacket): string {
  const l1: any = safeLayer(packet.layer1, {});
  const l2: any = safeLayer(packet.layer2, {});
  const l3: any = safeLayer(packet.layer3, {});
  const l4: any = safeLayer(packet.layer4, {});

  const lines: string[] = [
    '你是一个专业的小说作者。请根据以下细纲包写出本章正文。',
    '',
    '## 章节信息',
    `- 标题: ${packet.title}`,
    `- 章节号: 第${packet.chapterNumber}章`,
    `- 时位: ${packet.position || '未指定'}`,
    `- 功能: ${packet.chapterFunction || '未指定'}`,
    '',
  ];

  // Layer 1 — Writing Contract
  lines.push('## Layer ① 写作契约');
  lines.push(`- 叙事距离: ${l1.narrativeDistance || '中距'}`);
  lines.push(`- 信息策略: ${l1.expositionStrategy || '平衡'}`);
  lines.push(`- 人物声音: ${l1.characterVoice || '适中'}`);
  const taboos = Array.isArray(l1.taboos) ? l1.taboos.join('、') : '无';
  lines.push(`- 禁忌: ${taboos || '无'}`);
  lines.push('');

  // Layer 2 — Active Context
  lines.push('## Layer ② 活跃设定');
  lines.push('### 活跃角色');
  const chars = Array.isArray(l2.characters) ? l2.characters : [];
  if (chars.length > 0) {
    chars.forEach((c: any) => {
      lines.push(`- ${c.name || '?'}: ${c.currentState || c.status || ''}`);
    });
  } else {
    lines.push('（无活跃角色）');
  }

  lines.push('### 场景氛围');
  const scenes = Array.isArray(l2.scenes) ? l2.scenes : [];
  if (scenes.length > 0) {
    scenes.forEach((s: any) => {
      lines.push(`- ${s.name || '?'} (${s.atmosphere || ''})`);
    });
  } else {
    lines.push('（无活跃场景）');
  }

  lines.push('### 活跃规则');
  const rules = Array.isArray(l2.rules) ? l2.rules : [];
  if (rules.length > 0) {
    rules.forEach((r: any) => {
      lines.push(`- ${r.title || '?'}: ${r.description || ''}`);
    });
  } else {
    lines.push('（无活跃规则）');
  }

  lines.push('### 前情提要');
  lines.push(l2.recap || '（无前情提要）');
  lines.push('');

  // Layer 3 — Narrative Compression
  lines.push('## Layer ③ 剧情压缩');
  lines.push(`- 位置: ${l3.position?.from || ''} → ${l3.position?.to || ''}`);
  lines.push(`- 压缩叙事: ${l3.narrative || '（无）'}`);
  const releases = Array.isArray(l3.releases) ? l3.releases.join('、') : '无';
  lines.push(`- 释放: ${releases || '无'}`);
  const establishes = Array.isArray(l3.establishes) ? l3.establishes : [];
  if (establishes.length > 0) {
    lines.push('- 建立/伏笔:');
    establishes.forEach((e: any) => {
      lines.push(`  - ${e.subject || '?'} (${e.type || '?'})${e.change ? ' · ' + e.change : ''}`);
    });
  } else {
    lines.push('- 建立/伏笔: 无');
  }
  lines.push('');

  // Layer 4 — Execution Layer
  lines.push('## Layer ④ 执行层');
  lines.push('### 场景列表');
  const execScenes = Array.isArray(l4.scenes) ? l4.scenes : [];
  if (execScenes.length > 0) {
    execScenes.forEach((s: any, i: number) => {
      lines.push(
        `${i + 1}. ${s.label || '场景'} - ${s.summary || ''} (POV: ${s.pov || '-'}, 节奏: ${s.rhythm || '-'}, 地点: ${s.location || '-'})`,
      );
      if (s.sceneGoal) lines.push(`   目标: ${s.sceneGoal}`);
      if (s.conflict) lines.push(`   冲突: ${s.conflict}`);
    });
  } else {
    lines.push('（无场景）');
  }
  lines.push('');

  // Writing instructions
  lines.push('## 写作要求');
  lines.push('- 严格遵循叙事距离、信息策略和人物声音的设置');
  lines.push('- 避免违反禁忌');
  lines.push('- 每个场景按照执行层的设计展开');
  lines.push('- 使用丰富的中文文学语言，注意文笔和节奏');
  lines.push('- 字数建议: 3000-8000 字');
  lines.push('- 直接输出正文，不使用代码块包裹，不包含额外说明');

  return lines.join('\n');
}

// ─── Draft Generator ───

/**
 * 从 ChapterPacket 调用 AI 生成正文草案。
 * 返回纯文本正文，由调用方决定是否 preview 或直接插入。
 */
export async function generateDraftFromChapterPacket(options: GenerateDraftOptions): Promise<string> {
  const prompt = buildDraftPrompt(options.packet);

  // [v2.1.1-AI] Use Router instead of direct callLlm
  const { route, executeLlmCall } = await import('./ai/command-router');
  const routeOutput = await route({
    message: `写正文: ${options.packet.title}`,
    canvasId: 'text',
    projectId: options.packet.projectId,
    outputType: options.outputType || 'write_preview',
    providerId: options.model.providerId,
    modelId: options.model.id,
  });
  const llmResult = await executeLlmCall(routeOutput, [
    { role: 'user', content: prompt },
  ], { signal: options.signal });

  // Writer Agent gate: 生成后自动过方法论诊断
  const { runWriterAgent } = await import('./ai/writer-agent');
  const writerReport = await runWriterAgent(llmResult.content);
  console.log('[WriterAgent]', writerReport.summary);

  return llmResult.content;
}
