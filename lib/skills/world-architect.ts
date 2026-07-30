/**
 * world-architect Skill
 *
 * Analyzes novel text and extracts world-building information following
 * the World Building Component Table framework (麻雀世界观 + 天/地/人).
 *
 * Input: project text content (chapters, notes, outlines)
 * Output: structured JSON with all world-building dimensions
 *
 * This is a fixed-interface function — callers don't know the internal
 * prompt, only the input/output contract.
 */

import type { AiModel } from '../../types/ai';
import { callLlm, type LlmResponse } from '../llm-client';

// ════════════════════════════════════════════════════════════════
//  Types — public interface
// ════════════════════════════════════════════════════════════════

export interface WorldArchitectInput {
  /** Provider configuration for LLM call */
  model: AiModel;
  endpoint: string;
  apiKey: string;
  /** Project text files with content */
  texts: { path: string; content: string }[];
  /** Optional signal for cancellation */
  signal?: AbortSignal;
  /** Progress callback */
  onProgress?: (detail: string) => void;
}

export interface SparrowSchemaOutput {
  coreQuestion: string;
  aestheticSignature: string;
  coreMechanism: string;
  worldLack: string;
  protagonistLack: string;
  rulesAndCost: string;
  enforcer: string;
  currentSituation: string;
  compressionField: string;
  effectivePast?: string;
  supplySystem?: string;
  identityQualifications?: string;
  faithAndTaboo?: string;
  dailyInterface?: string;
}

export interface HeavenSection {
  cosmology?: { worldOrigin: string; humanPosition: string; fateView: string; deathView: string };
  coreMechanism?: { mechanism: string; source: string; scope: string;失控后果: string };
  magicSystem?: { source: string; users: string; limitations: string; cost: string };
}

export interface EarthSection {
  locations: { name: string; type: string; description: string; significance: string }[];
  geography?: { terrain: string; climate: string; resources: string };
}

export interface FactionEntry {
  name: string; goal: string; resources: string; leader: string; allies: string; enemies: string;
}

export interface PeopleSection {
  factions: FactionEntry[];
  culture?: { classSystem: string; identityRules: string; faith: string; taboos: string };
  economy?: { resources: string; producers: string;分配者: string };
}

export interface CharacterEntry {
  name: string; role: string; archetype: string; want: string; flaw: string;
}

export interface CharacterSection {
  protagonist: CharacterEntry;
  allies: CharacterEntry[];
  enemies: CharacterEntry[];
  grayCharacters: CharacterEntry[];
}

export interface WorldArchitectOutput {
  sparrowSchema: SparrowSchemaOutput;
  heaven: HeavenSection;
  earth: EarthSection;
  people: PeopleSection;
  characters: CharacterSection;
  /** Raw analysis text for reference */
  _raw: string;
}

// ════════════════════════════════════════════════════════════════
//  System prompt — the World Building Component Table
// ════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `你是一个世界构建分析工具。你的任务是从小说正文中提取世界观设定信息，按以下框架输出 JSON。

## 框架结构

### 一、麻雀世界观（P0 骨架）
这是每个故事必须有的核心设定。从正文中推断：

1. 核心追问：读者为什么继续看？这个故事最让读者追问什么？
2. 美学辨识度：世界第一眼的气质（颜色、材质、气味、光线、时代感）
3. 核心异常/机制：让故事前提成立的规则或异常
4. 世界缺憾：这个世界缺什么？什么稀缺到足以制造命运？
5. 主角缺憾：主角缺什么？为什么偏偏是他被卷进去？
6. 规则与代价：世界允许什么、禁止什么？越界会怎样？
7. 执行人：谁制定、解释、执行规则？
8. 当前局势：为什么故事现在发生？
9. 压缩场：哪个地点/组织最能集中体现世界规则？

以下可选（P1，尽量提取但非必须）：
10. 有效旧事：过去哪件事仍在影响当下？
11. 供养系统：世界靠什么维持？谁生产？谁分配？
12. 身份/资格：谁有资格做什么？
13. 信仰与禁忌：人们相信什么？什么不能做？
14. 日常接口：普通人怎样接触规则？

### 二、天：法则、机制和可能性
- 宇宙观（世界来源、人的位置、命运观、死亡观）
- 核心异常详情（来源、影响范围、可控程度、失控后果）
- 特殊能力/技术/魔法（来源、使用者、限制、代价）

### 三、地：空间、自然和行动条件
- 关键地点（主角起点、权力中心、边缘区、禁区、最终场所）
- 地理自然（地形、气候、资源、交通）

### 四、人：人在世界中如何组织生活
- 势力组织（名称、目的、资源、代表人物、敌友关系、日常接口）
- 社会结构（阶级、身份、资格、流动可能）
- 文化与日常（衣、食、住、行、语言、符号、禁忌）
- 经济供养（基本资源、生产者、分配者、被延后者）

### 五、人物（从世界观推导）
- 主角（谁最适合承受核心追问？他的缺憾是什么？他想拿回什么？）
- 盟友（谁让主角继续行动？谁照见主角另一面？）
- 敌人（谁维护旧规则？谁从缺憾中受益？）
- 灰色人物（谁在规则缝隙里活着？谁知道真相但不说全？）

### 六、故事机制（按题材触发）
真相机制（悬疑类）：核心秘密、知情者、隐瞒者、揭示顺序、真相代价
权力机制（权谋类）：最高权力、继承规则、背叛成本、清算方式
战争机制（战争类）：战争原因、资源、地理、平民代价
成长机制（成长类）：起点状态、压力来源、旧答案、变化代价、最终状态

## 输出格式

只输出 JSON。格式：
{
  "sparrowSchema": { "coreQuestion": "...", ... },
  "heaven": { "cosmology": {...}, "coreMechanism": {...} },
  "earth": { "locations": [...] },
  "people": { "factions": [...] },
  "characters": { "protagonist": {...}, "allies": [...], "enemies": [...] },
  "mechanisms": {}
}

无法从正文推断的字段设为空字符串或空数组。不要输出任何其他文字。`;

// ════════════════════════════════════════════════════════════════
//  Implementation
// ════════════════════════════════════════════════════════════════

const MAX_CHUNK_CHARS = 40000;

/** Split text array into chunks by character count */
function splitIntoChunks(texts: { path: string; content: string }[], maxChars: number): { path: string; content: string }[][] {
  const chunks: { path: string; content: string }[][] = [];
  let current: { path: string; content: string }[] = [];
  let currentSize = 0;

  for (const t of texts) {
    if (currentSize + t.content.length > maxChars && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(t);
    currentSize += t.content.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Parse JSON from LLM response, with markdown code block fallback */
function parseJson(text: string): any {
  try { return JSON.parse(text); } catch { /* try markdown block */ }
  const m = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (m) try { return JSON.parse(m[1]); } catch { /* try outer braces */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fail */ }
  return null;
}

/** Merge multiple outputs (for chunked processing) */
function mergeOutputs(outputs: WorldArchitectOutput[]): WorldArchitectOutput {
  const base = outputs[0];
  if (outputs.length === 1) return base;

  // Merge locations (dedup by name)
  const allLocations = outputs.flatMap((o) => o.earth.locations);
  const seen = new Set<string>();
  base.earth.locations = allLocations.filter((l) => {
    const key = l.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Merge factions (dedup by name)
  const allFactions = outputs.flatMap((o) => o.people.factions);
  const seenF = new Set<string>();
  base.people.factions = allFactions.filter((f) => {
    const key = f.name.toLowerCase();
    if (seenF.has(key)) return false;
    seenF.add(key);
    return true;
  });

  // Merge characters (dedup by name)
  const allAllies = outputs.flatMap((o) => o.characters.allies);
  const seenA = new Set<string>();
  base.characters.allies = allAllies.filter((c) => {
    const key = c.name.toLowerCase();
    if (seenA.has(key)) return false;
    seenA.add(key);
    return true;
  });

  // Merge raw text
  base._raw = outputs.map((o) => o._raw).join('\n\n---\n\n');
  return base;
}

/** Empty output template */
function emptyOutput(): WorldArchitectOutput {
  return {
    sparrowSchema: {
      coreQuestion: '', aestheticSignature: '', coreMechanism: '', worldLack: '',
      protagonistLack: '', rulesAndCost: '', enforcer: '', currentSituation: '', compressionField: '',
    },
    heaven: {},
    earth: { locations: [] },
    people: { factions: [] },
    characters: { protagonist: {} as any, allies: [], enemies: [], grayCharacters: [] },
    _raw: '',
  };
}

// ════════════════════════════════════════════════════════════════
//  Public API
// ════════════════════════════════════════════════════════════════

/**
 * Analyze novel text and extract world-building information.
 *
 * @param input - Project text content + AI provider config
 * @param onProgress - Optional progress callback
 * @returns Structured world-building output
 */
export async function analyzeWorld(input: WorldArchitectInput): Promise<WorldArchitectOutput> {
  const { texts, model, endpoint, apiKey, signal } = input;
  const onProgress = input.onProgress || (() => {});

  const totalChars = texts.reduce((sum, t) => sum + t.content.length, 0);
  onProgress(`读取了 ${texts.length} 个文件，共 ${totalChars} 字`);

  // Split into chunks if needed
  const chunks = splitIntoChunks(texts, MAX_CHUNK_CHARS);
  const chunkCount = chunks.length;
  onProgress(`需分 ${chunkCount} 块处理`);

  const outputs: WorldArchitectOutput[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const chunk = chunks[i];
    const chunkText = chunk.map((t) => `--- ${t.path} ---\n${t.content}`).join('\n\n');
    const chunkInfo = chunk.map((t) => t.path).join(', ');
    onProgress(`块 ${i + 1}/${chunkCount}：正在分析 ${chunkInfo.slice(0, 60)}…`);

    let response: LlmResponse;
    try {
      response = await callLlm(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `正文内容：\n\n${chunkText.slice(0, MAX_CHUNK_CHARS)}` },
        ],
        { model, endpoint, apiKey, signal, timeout: 120000, outputType: 'detection' },
      );
    } catch (err: any) {
      onProgress(`块 ${i + 1}/${chunkCount} 失败：${err.message || err}，跳过`);
      continue;
    }

    const parsed = parseJson(response.content);
    if (!parsed) {
      onProgress(`块 ${i + 1}/${chunkCount}：AI 输出格式异常，跳过`);
      continue;
    }

    const output = emptyOutput();

    // Map parsed response to output structure
    if (parsed.sparrowSchema) {
      output.sparrowSchema = { ...output.sparrowSchema, ...parsed.sparrowSchema };
    }
    if (parsed.heaven) output.heaven = parsed.heaven;
    if (parsed.earth?.locations) output.earth.locations = parsed.earth.locations;
    if (parsed.earth?.geography) output.earth.geography = parsed.earth.geography;
    if (parsed.people?.factions) output.people.factions = parsed.people.factions;
    if (parsed.people?.culture) output.people.culture = parsed.people.culture;
    if (parsed.people?.economy) output.people.economy = parsed.people.economy;
    if (parsed.characters?.protagonist) output.characters.protagonist = parsed.characters.protagonist;
    if (parsed.characters?.allies) output.characters.allies = parsed.characters.allies;
    if (parsed.characters?.enemies) output.characters.enemies = parsed.characters.enemies;
    if (parsed.characters?.grayCharacters) output.characters.grayCharacters = parsed.characters.grayCharacters;
    output._raw = response.content;

    outputs.push(output);
    onProgress(`块 ${i + 1}/${chunkCount} 完成，提取到 ${output.earth.locations.length} 个地点、${output.people.factions.length} 个势力`);
  }

  if (outputs.length === 0) {
    throw new Error('所有分块处理均失败，没有提取到任何设定');
  }

  const merged = mergeOutputs(outputs);
  onProgress(`合并完成：${merged.earth.locations.length} 个地点、${merged.people.factions.length} 个势力、${merged.characters.allies.length + 1} 个人物`);
  return merged;
}
