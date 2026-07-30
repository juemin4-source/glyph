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

export interface FileToWrite {
  /** Relative path from project root, e.g. "设定集/世界观.md" */
  path: string;
  /** Full markdown content */
  content: string;
}

export interface WorldArchitectOutput {
  sparrowSchema: SparrowSchemaOutput;
  heaven: HeavenSection;
  earth: EarthSection;
  people: PeopleSection;
  characters: CharacterSection;
  /** Files to be written to the project's 设定集/ directory */
  files: FileToWrite[];
  /** Raw analysis text for reference */
  _raw: string;
}

// ════════════════════════════════════════════════════════════════
//  System prompt — the World Building Component Table
// ════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `你是一个世界构建分析工具。你的任务是从小说正文中提取世界观设定信息，按以下框架输出 JSON。

## 框架结构

### 优先级
- P0：骨架项。少了它，故事很难开始运行
- P1：触发项。题材、尺度需要时再填
- P2：加厚项。用来增加质感、层次和可信度
- P3：资料项。可放资料库，正文未必调用

所有字段标注 P0/P1/P2/P3，按优先级决定是否填充。先从正文中提取 P0 和 P1。

---

### 一、麻雀世界观（P0 骨架，先填这张表）

| P0 | 核心追问 | 这个故事最想让读者追问什么？ |
| P0 | 美学辨识度 | 第一眼的气质——颜色、材质、气味、光线、时代感 |
| P0 | 核心异常/机制 | 最关键的异常、规则或压迫机制 |
| P0 | 世界缺憾 | 世界缺什么？什么稀缺到足以制造命运？ |
| P0 | 主角缺憾 | 主角缺什么？为什么偏偏是他被卷进去？ |
| P0 | 规则与代价 | 允许什么、禁止什么？越界会怎样？ |
| P0 | 执行人 | 谁制定、解释、执行奖励和惩罚？ |
| P0 | 当前局势 | 为什么故事现在发生？此刻世界正在发生什么变化？ |
| P0 | 压缩场 | 哪个地点/组织/群体/事件最能集中体现世界规则？ |
| P1 | 有效旧事 | 过去哪件事仍然影响当下？ |
| P1 | 真相/悬念 | 读者最想知道什么？答案如何分层揭开？ |
| P1 | 供养系统 | 世界靠什么维持？谁生产、谁分配、谁被延后？ |
| P1 | 身份/名分/资格 | 谁有资格做什么？谁没资格？ |
| P1 | 信仰与禁忌 | 人们相信什么？什么不能说、不能碰、不能查？ |
| P1 | 日常接口 | 普通人每天怎样接触世界规则？ |

### 二、天：法则、机制和可能性

#### 1. 宇宙观
- 世界来源（P1）：世界如何形成？这个解释可靠吗？
- 世界边界（P2）：世界之外是什么？边界能否越过？
- 人的位置（P1）：人是中心、工具、资源、受造物，还是旁观者？
- 命运观（P1）：命运能否改变？谁能改？代价是什么？
- 死亡观（P1）：死后如何？死者是否仍有权利和影响？
- 时间观（P2）：时间是线性、循环、断裂、可回溯，还是可交易？
- 真相观（P1）：真相能否被知道？谁垄断解释？

#### 2. 核心异常/核心机制
- 核心异常（P0）：最关键的世界规则是什么？
- 来源（P0）：来自自然、技术、神明、制度、污染、旧罪还是血统？
- 影响范围（P0）：人人受影响，还是少数人？
- 可见程度（P1）：普通人知道它吗？是否被隐瞒？
- 可利用程度（P1）：能否被训练、交易、垄断、武器化？
- 失控后果（P0）：失控后会怎样？
- 与主角关系（P0）：主角是受害者、执行者、受益者、见证者、继承者还是误入者？

#### 3. 特殊能力/技术/魔法
- 来源（P1）、使用者（P1）、门槛（P1）、能做什么/不能做什么（P1）
- 使用代价（P1）、监管者（P1）、研究机构（P1）
- 日常影响（P2）、极限形态（P2）

### 三、地：空间、自然和行动条件

#### 1. 空间结构
- 主要舞台（P0）、压缩场（P0，重复则合并）
- 中心与边缘（P1）、禁区（P1）、边境（P1）
- 流放地（P2）、圣地（P2）

#### 2. 地理自然
- 地形（P1）、气候（P1）、资源分布（P1）、交通（P1）
- 灾害（P1）、动植物（P2）、环境代价（P2）

#### 3. 关键地点
- 主角起点（P0）、权力中心（P1）、资源中心（P1）
- 边缘区（P1）、灰区/黑市（P1）、旧址（P1）、最终场所（P1）

### 四、人：人在世界中如何组织生活

#### 1. 人群
- 主要人群（P1）、多数与少数（P1）、被排除者（P1）、命名方式（P1）
- 移民/外来者（P2）、混血/边缘者（P2）

#### 2. 有效历史
- 旧事件（P1）、旧罪（P1）、旧失败（P1）、隐瞒的历史（P1）
- 历史进入日常（P1）

#### 3. 权力结构
- 政体（P1）、最高权力（P1）、法统/合法性（P1）
- 法律（P1）、暴力机关（P1）、豁免者（P1）
- 腐败方式（P2）、申诉机制（P2）

#### 4. 势力组织
- 名称（P1）、最终目的（P1）、掌握资源（P1）
- 代表人物（P1）、敌友关系（P1）、日常接口（P1）
- 内部裂痕（P2）、变质风险（P2）

#### 5. 经济与供养
- 基本资源（P1）、生产者（P1）、分配者（P1）
- 享用者（P1）、被延后者（P1）、贫民日常（P1）
- 人如何变成资源（P1）

#### 6. 社会结构
- 阶级（P1）、身份（P1）、名分（P1）、资格（P1）
- 社会流动（P1）、成功标准（P1）、失败标准（P1）

#### 7. 文化与日常
- 衣、食、住、行（P2）、语言（P2）、符号与颜色（P2）
- 礼仪（P2）、医疗（P2）、普通人的一天（P1）

#### 8. 信仰与禁忌
- 核心信仰（P1）、解释者（P1）、禁忌（P1）、破禁代价（P1）
- 异端（P2）、信仰裂痕（P2）

### 五、故事机制补充表（按题材触发，不必全填）

#### 真相机制（悬疑/调查/秘密/家庭旧事/反转）
事实真相、关系真相、历史真相、知情者、隐瞒者、揭示顺序、真相代价

#### 权力机制（权谋/宫廷/家族/职场/门派）
最高权力、名分、资源、执行人、反对者、继承规则、清算方式

#### 战争机制（战争/军事/末日/王国冲突）
战争原因、资源、军制、后勤、地理、平民代价

#### 亲密关系机制（爱情/家庭/师徒/同伴）
关系障碍、身份差异、关系代价、第三方压力

#### 成长/相变机制（成长/堕落/觉醒/救赎）
起点状态、压力来源、旧答案、旧答案失效、变化代价、最终状态

### 六、世界观推人物

#### 1. 主角（P0）
- 谁最适合承受核心追问？
- 他是受害者、执行者、受益者、见证者、继承者还是误入者？
- 世界缺憾如何刺中他？他自己的缺憾是什么？
- 他想拿回什么？他越往前走会失去什么？

#### 2. 盟友（P1）
- 谁能让主角继续行动？谁能照见主角另一面？
- 谁携带旧经验或旧答案？

#### 3. 敌人（P1）
- 谁维护世界原来的运行方式？谁从世界缺憾里受益？
- 谁执行规则和代价？谁害怕主角揭开问题？

#### 4. 灰色人物（P1）
- 谁在规则缝隙里活着？谁知道真相但不说全？
- 谁靠漏洞/黑市/沉默/旧债获利？

#### 5. 龙套/缺席人物/群体人物（P2，可选）

---

## 输出要求

### 1. 分析正文后，按以上框架提取设定信息，输出 JSON

### 2. 同时生成设定文件
根据提取到的设定，创建以下文件（按优先级，提取到多少写多少，不必全部创建）：

| 文件路径 | 内容 |
|----------|------|
| 设定集/00-世界观概览.md | 麻雀世界观 + 世界基础 + 宇宙观概要 |
| 设定集/01-地域/01-空间结构.md | 空间结构、地理自然概要 |
| 设定集/01-地域/02-关键地点.md | 各地点的详细设定 |
| 设定集/02-人物/01-主角.md | 主角的完整档案 |
| 设定集/02-人物/02-其他人物.md | 盟友、敌人、灰色人物等 |
| 设定集/03-势力组织.md | 各组织的详细设定 |
| 设定集/04-能力体系.md | 核心机制、特殊能力/技术/魔法 |
| 设定集/05-经济与社会.md | 经济、社会结构、文化、信仰 |
| 设定集/06-故事机制.md | 按题材触发，选填 |

每个文件用 markdown 格式，标注信息来源。

### 3. JSON 输出结构

{
  "sparrowSchema": { 麻雀世界观的 14 个字段 },
  "heaven": { 天：宇宙观、核心异常、特殊能力 },
  "earth": { "locations": [关键地点列表] },
  "people": { "factions": [势力列表] },
  "characters": { "protagonist": 主角, "allies": [], "enemies": [], "grayCharacters": [] },
  "files": [
    { "path": "设定集/00-世界观概览.md", "content": "markdown" },
    { "path": "设定集/01-地域/02-关键地点.md", "content": "markdown" }
  ]
}

无法从正文推断的字段设为空字符串或空数组。files 至少包含一个文件。不要输出任何其他文字。`;

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

  // Merge files (later chunks supplement, not replace)
  for (let i = 1; i < outputs.length; i++) {
    const existingPaths = new Set(base.files.map((f) => f.path));
    for (const file of outputs[i].files) {
      if (!existingPaths.has(file.path)) {
        base.files.push(file);
      }
    }
  }

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
    files: [],
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
    if (Array.isArray(parsed.files)) {
      output.files = parsed.files.filter((f: any) => f.path && f.content);
    }
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
