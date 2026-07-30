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

## 三、依赖

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

## 四、实现路径

### Phase 1：核心管道（~3h）

| 项 | 估时 |
|------|------|
| 实现文件读取 + 分块逻辑 | 0.5h |
| 构建 Craft Skill system prompt | 1h（从 craft-skill-architecture.json 提取） |
| 每个分块调用 callLlm + 解析 | 0.5h |
| 合并 + 去重逻辑 | 0.5h |
| 写入文件 + 返回报告 | 0.5h |

### Phase 2：优化（~2h）

| 项 | 估时 |
|------|------|
| 增量处理（只处理新/变更的文件） | 1h |
| 进度反馈（分块处理时显示"正在处理第 X/Y 块"） | 0.5h |
| 错误恢复（某块失败不影响已处理的结果） | 0.5h |

---

## 五、否决方向

- ❌ 不走 `runProjectAiTask`——它是 Chat 管道，不是批量分析管道
- ❌ 不做全量 AI 重写——AI 只提取和分类，不修改原文
- ❌ 不依赖外部向量数据库——本地文件 + 分块足够
- ❌ 不分块并行处理——串行更稳定，避免上下文混淆
