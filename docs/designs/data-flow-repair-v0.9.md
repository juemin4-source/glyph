# 织梦机 `/整理` 数据流重构 v0.9

> **版本**：v0.9-draft  
> **日期**：2026-07-30  
> **状态**：紧急修复 — 当前 `/整理` 管道存在根本性数据流错误  

---

## 一、问题诊断

### 1.1 当前数据流

```
/整理
  → runProjectAiTask
    → createProjectPlan()        ← AI 根据用户输入做计划
    → collectEvidence()          ← Gate B 搜索：找关键词相关内容
    → callLlm()                  ← 生成回答或文件内容
    → commitWrite()              ← Gate C 写入文件
  → 返回 markdown 报告
```

### 1.2 三个致命缺陷

**缺陷 A：数据来源——搜索不是读取**

`collectEvidence()` 使用 `searchFileContent` 搜索关键词，而不是读取全部文件。对于 15 万字的长篇小说：

- AI 只搜到跟 prompt 关键词命中的几章
- 后半部内容完全不可见
- 输出只能基于不完整的信息

**缺陷 B：输出框架——没有理论指导**

`runProjectAiTask` 的 system prompt 是通用阅读助手，不知道 Craft Skill 体系：

- AI 用自己的"通用世界观分类"（人物/地点/组织）
- 不是你的六部理论（审美/读者/人物/命运/现场/深处）
- 输出跟 40 个 Craft Skill 毫无关系

**缺陷 C：上下文窗口——长内容天然溢出**

15 万字远超过模型上下文窗口（DeepSeek v4 窗口有限）。AI 只能看到开头部分内容，后面的章节完全不可见。

---

## 二、修复设计

### 2.1 新数据流

```
/整理
  → Phase 1: 全量读取
  │     listProjectTextFiles → 列出所有 .md
  │     for each file → readFile → 收集全文
  │
  → Phase 2: 分块处理
  │     如果总字数 > 模型上下文限制（如 > 50000 字）
  │     → 按章节/字数分块
  │     → 每块单独用 AI 提取（Craft Skill 框架）
  │
  → Phase 3: Craft Skill 分类
  │     每块提取结果按六部理论归类：
  │     ├── 审美篇（CS-01~04）：具象、复调、余地、得度
  │     ├── 人物篇（CS-10~18）：私、处、执、为、已 等
  │     ├── 命运篇（CS-19~24）：时位、节气、周期等
  │     ├── 读者篇（CS-05~09）：欲望入口、类型承诺等
  │     ├── 现场篇（CS-25~32）：定势、物色、身位等
  │     └── 深处篇（CS-33~37）：分形、涌现、有无等
  │
  → Phase 4: 合并去重
  │     各块结果合并，去重
  │
  → Phase 5: 写入文件
  │     按 Craft Skill 框架创建设定文件
  │     → 写入 设定集/ 目录
  │
  → Phase 6: 返回报告
  │     完成摘要 + 文件列表 + 统计
```

### 2.2 分块策略

```
15 万字小说的处理方式：

块 1：第 1-3 章（约 4 万字）→ 提取 → Craft Skill 分析
块 2：第 4-6 章（约 4 万字）→ 提取 → Craft Skill 分析
块 3：第 7-10 章（约 4 万字）→ 提取 → Craft Skill 分析
块 4：第 11-13 章（约 3 万字）→ 提取 → Craft Skill 分析

每块输出结构化 JSON，最后合并
```

每块的提取 prompt 包含：

```
1. 该块原文（完整或摘要）
2. 输出要求：按下面框架提取设定信息
   审美篇：具体描写、复调视角、留白余地
   人物篇：私（自我边界）、处（处境限制）、执（执念）、为（行动模式）
   命运篇：时位（当前所处阶段）、节气（情绪气候）
   现场篇：定势（场景张力）、物色（物品叙事）、身位（视点）
```

### 2.3 Craft Skill 分类输出格式

```json
{
  "chunk": "第1-3章",
  "extractions": {
    "人物篇": [
      {
        "skill": "CS-11",
        "name": "私诊断",
        "target": "刘凛",
        "evidence": "原文引用",
        "analysis": "把自由视为'我'的一部分，不愿被他人掌控命运"
      }
    ],
    "现场篇": [
      {
        "skill": "CS-25",
        "name": "定势诊断",
        "target": "第一章山谷场景",
        "evidence": "原文引用",
        "analysis": "势为'舒缓'——日常生活的平静节奏"
      }
    ]
  }
}
```

### 2.4 输出文件结构

```
设定集/
├── 审美篇/
│   ├── 具象描写.md
│   ├── 复调结构.md
│   └── 留白余地.md
├── 人物篇/
│   ├── 主角_刘凛.md
│   ├── 配角_刘洪.md
│   └── 配角色_胡珣.md
├── 命运篇/
│   ├── 时位分析.md
│   └── 节气气候.md
├── 现场篇/
│   ├── 经典场景分析.md
│   └── 物色索引.md
├── 读者篇/
│   ├── 欲望入口.md
│   └── 类型承诺.md
└── 深处篇/
    ├── 分形结构.md
    └── 母题索引.md
```

### 2.5 `/整理` handler 实现

Handler 不再调用 `runProjectAiTask`，而是实现独立的处理管道：

```typescript
handler: async (_args, task) => {
  // 1. 读取全部文件
  const files = await listProjectTextFiles(project.rootPath);
  const contents = [];
  for (const f of files) {
    contents.push({ path: f.path, content: await readFile(project.rootPath, f.path) });
  }
  
  // 2. 按字数分块
  const chunks = splitIntoChunks(contents, MAX_CHUNK_SIZE);
  
  // 3. 每块单独处理（串行，避免上下文溢出）
  const allExtractions = [];
  for (const chunk of chunks) {
    const result = await callLlm([
      { role: 'system', content: buildCraftSkillPrompt() },
      { role: 'user', content: chunk.text }
    ], { model, endpoint, apiKey, timeout: 120000 });
    allExtractions.push(parseExtractions(result.content));
  }
  
  // 4. 合并去重
  const merged = mergeExtractions(allExtractions);
  
  // 5. 写入文件
  for (const [category, items] of Object.entries(merged)) {
    const content = formatSettingFile(category, items);
    await createTextFile(project.rootPath, `设定集/${category}/index.md`, content);
  }
  
  // 6. 返回报告
  return `## 设定整理完成\n\n处理了 ${files.length} 个文件，共 ${totalChars} 字，提取了 ${merged.total} 条设定。`;
}
```

---

## 三、透明可见性——核心要求

### 3.1 当前问题

```
用户看到的是：                          实际发生的是：
/整理                                    /整理
  ↓                                        ↓
"AI 正在分析项目…"（1% → 100%）         读取文件（无反馈）
  ↓                                        ↓
"完成"                                  搜索（无反馈）
                                          ↓
                                         LLM 调用（30s+ 无反馈）
                                          ↓
                                         写入文件（无反馈）
```

用户完全不知道：
- 读了多少文件？每个文件多少字？
- 正在处理第几块？总共几块？
- 每块提取到了什么？
- 写入了几条设定？

### 3.2 要求

每次 `patchTask` 更新 `phaseDetail` 必须反映真实进度：

```
[开始] 读取项目文件…
  → 读取第 3/12 个文件（化水.md 约 38000 字）
  → 共 151755 字，需分 4 块处理

[块 1/4] 正在分析第 1-3 章（约 40000 字）
  → 提取到：人物 4 个、场景 3 个、物色 6 件
  → Craft Skill 匹配：CS-11(私), CS-25(定势)

[块 2/4] 正在分析第 4-6 章（约 40000 字）
  → 提取到：人物 2 个、命运时位 1 处
  → Craft Skill 匹配：CS-19(时位), CS-26(物色)

[合并] 合并 4 块结果…
  → 人物 12 个（去重后 9 个）
  → 场景 8 个、物色 15 件

[写入] 正在创建设定文件…
  → 人物篇/主角_刘凛.md ✅
  → 现场篇/经典场景分析.md ✅

[完成] 处理了 12 个文件，提取 42 条设定
```

### 3.3 实现方式

Handler 内部每次状态变化都调用 `patchTask`：

```typescript
patchTask(taskId, { phase: 'searching', phaseDetail: '读取第 3/12 个文件…' });
patchTask(taskId, { phase: 'generating', phaseDetail: '块 1/4：分析第 1-3 章…' });
patchTask(taskId, { phase: 'committing', phaseDetail: '写入 人物篇/主角.md…' });
```

### 3.4 错误可见性

某块处理失败时：

```
块 3/4：分析第 7-9 章 → 失败（LLM 返回格式异常）
  ⚠ 跳过第 3 块，继续处理第 4 块
  → 最终报告会标记"部分成功（3/4 块完成）"
```

不隐藏错误，不吞异常。

---

## 四、依赖

| 依赖 | 已有 | 说明 |
|------|------|------|
| `listProjectTextFiles` | ✅ lib/fs-ai-bridge.ts | 列出所有 .md 文件 |
| `readFile` | ✅ tauri-api.ts | 读取文件内容 |
| `createTextFile` | ✅ tauri-api.ts | 创建设定文件 |
| `callLlm` | ✅ lib/llm-client.ts | 直接调 LLM，不走 runProjectAiTask |
| Craft Skill prompt | ✅ docs/craft-skills/ | 40 个 Skill 的定义和 system prompt |
| 分块策略 | ❌ 新增 | `splitIntoChunks` 函数 |
| 合并逻辑 | ❌ 新增 | `mergeExtractions` 函数 |
| 格式化输出 | ❌ 新增 | `formatSettingFile` 函数 |

---

## 五、实现路径

### Phase 1：核心管道（~4h）

| 项 | 估时 | 可见性 |
|------|------|---------|
| 文件读取 + 分块逻辑 | 0.5h | 显示文件数和字数 |
| 构建 Craft Skill system prompt | 1h | — |
| 每块 callLlm + 解析（串行） | 1h | 显示"块 X/Y"和提取结果 |
| 合并 + 去重 | 0.5h | 显示去重前后数量 |
| 写入设定集文件 | 0.5h | 显示每个写入的文件名 |
| 返回报告 + 错误标记 | 0.5h | 显示成功/失败/跳过 |

**可见性覆盖：全流程每个步骤都有 `patchTask` 更新，用户不会看到黑箱。**

### Phase 2：优化（~2h）

| 项 | 估时 |
|------|------|
| 增量处理（只处理新/变更的文件） | 1h |
| 错误恢复（某块失败不影响其他块） | 0.5h |
| 取消支持（中断正在进行的处理） | 0.5h |

---

## 六、分步执行计划

### Step 1：创建 worldview-architect Skill（世界构建 Skill）

基于【附录】完整世界观构件表，创建一个可调用的 AI Skill。

```
Skill: world-architect
用途：分析小说正文，按世界观构件表提取设定信息
输入：项目正文（一个或多个 .md 文件）
输出：结构化 JSON，按 P0→P3 优先级排列

输出结构（顶层字段）：
├── sparrowSchema     → 麻雀世界观 P0 13 问
├── heaven            → 天：宇宙观、核心机制、能力体系
├── earth             → 地：空间结构、地理、关键地点
├── people            → 人：势力、文化、信仰、经济、社会
├── characters        → 人物：主角、盟友、敌人、灰色人物
└── mechanisms        → 故事机制（按题材触发）
```

**实现方式**：不是一段写死的 prompt，而是一个封装了 systemPrompt + outputSchema 的可调用函数。存放在 `lib/skills/world-architect.ts`。

```typescript
// lib/skills/world-architect.ts
interface WorldArchitectInput {
  texts: { path: string; content: string }[];
}

interface WorldArchitectOutput {
  sparrowSchema: SparrowSchema;
  heaven: HeavenSection;
  earth: EarthSection;
  people: PeopleSection;
  characters: CharacterSection;
  mechanisms: MechanismSection;
}

export async function analyzeWorld(input: WorldArchitectInput): Promise<WorldArchitectOutput> {
  // 1. 分块处理（如果内容过长）
  // 2. 调 callLlm 用构件表 prompt
  // 3. 解析结构化 JSON
  // 4. 合并返回
}
```

### Step 2：重写 `/整理` 命令

Handler 调 `analyzeWorld()` 代替 `runProjectAiTask()`：

```
/整理
  → listProjectTextFiles（列出所有 .md）
  → readFile（读取全文）
  → 如果总字数 > 阈值，分块
  → 调 analyzeWorld(skill) ← 世界构件 Skill
  → 拿到结构化 JSON
  → 按输出内容创建 设定集/ 文件
  → 更新 .glyph/context-summary.md
  → 返回完成报告（带进度透明可见性）
```

### Step 3：Craft Skill 接入（后续）

当 `world-architect` 稳定后，再把 Craft Skill 体系（CS-01~40）逐个封装成独立 Skill，按需调用。

```
world-architect → 世界观全量分析（Step 1）
character-analyzer → 调用 CS-11~15 深度分析人物（后续）
scene-analyzer → 调用 CS-25~32 分析场景（后续）
```

---

## 七、文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/skills/world-architect.ts` | 新建 | 世界构件 Skill 实现 |
| `components/FsAiPanel.tsx` | 改 | `/整理` handler 重写 |
| `lib/fs-ai-bridge.ts` | 不改 | 不再依赖 `runProjectAiTask` |
| `.glyph/context-summary.md` | 自动生成 | 更新摘要格式 |

**共 2 个文件需修改，1 个新增。** 低于复杂度阈值。

---

## 九、否决方向

- ❌ 不走 `runProjectAiTask`——它是 Chat 管道，不是批量分析管道
- ❌ 不做全量 AI 重写——AI 只提取和分类，不修改原文
- ❌ 不依赖外部向量数据库——本地文件 + 分块足够
- ❌ 不分块并行处理——串行更稳定，避免上下文混淆
