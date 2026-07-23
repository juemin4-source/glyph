# Obsidian Longform 调研报告

> 织梦机竞品调研 · 2026-07-08
> 背景：织梦机 v1.2 产品设计 Sprint 的一部分 — 学习 Longform 的写作项目管理设计，为织梦机的世界构建与叙事引擎提供参考

---

## 目录

1. [Longform 是什么](#1-longform-是什么)
2. [核心功能模型](#2-核心功能模型)
3. [项目管理流程](#3-项目管理流程)
4. [UI 交互分析](#4-ui-交互分析)
5. [关联生态：Inkswell 和 Scrivener](#5-关联生态inkswell-和-scrivener)
6. [织梦机借鉴与超越](#6-织梦机借鉴与超越)
7. [总结：决策建议](#7-总结决策建议)

---

## 1. Longform 是什么

**Longform** 是 Kevin Barrett（GitHub: [kevboh/longform](https://github.com/kevboh/longform)）开发的 Obsidian 社区插件，v2.1.0（2025年3月更新）。它让 Obsidian 能管理**多场景长篇写作项目**（小说、剧本、非虚构长文），是目前 Obsidian 生态中最主流的长篇写作项目管理方案。

### 定位

| 维度 | 定位 |
|------|------|
| 范围 | 单插件，非平台 |
| 约束 | 基于 Obsidian 生态，不独立运行 |
| 核心价值 | 把零散场景笔记组织为结构化项目 |
| 数据哲学 | 纯 frontmatter 驱动，不碰笔记正文 |

---

## 2. 核心功能模型

### 2.1 数据模型

Longform 的架构围绕**索引文件（Index File）** — 一个 YAML frontmatter 驱动的"脊柱"：

```yaml
longform:
  format: scenes           # "scenes" ｜ "single"
  title: 我的长篇          # 项目标题
  draftTitle: 初稿         # 当前草稿名称
  sceneFolder: /           # 场景存放子目录
  scenes:                  # 场景文件有序列表（无 .md）
    - 第一章
    - - 第二章-场景甲      # 嵌套数组 = 层级 / 缩进
      - 第二章-场景乙
    - 尾声
  ignoredFiles:            # 排除文件
    - 笔记
  workflow: Default        # 编译工作流
```

**核心设计原则：**

| 原则 | 含义 |
|------|------|
| **非破坏性** | Longform 只改索引文件，**从不修改**场景笔记正文 |
| **文件即数据** | 每个场景是一个独立的 `.md` 文件，无二进制格式锁定 |
| **YAML 即状态** | 项目结构、场景顺序、草稿版本全部编码在 frontmatter 中 |
| **兼容性优先** | Dataview、Templater 等可通过 frontmatter 读取元数据 |

### 2.2 项目类型

| 类型 | 说明 | 适用 |
|------|------|------|
| **Multi-Scene** | 多场景项目，每个场景一个文件 | 长篇小说、剧本、学术专著 |
| **Single-Scene** | 单文件项目 | 短篇、随笔、论文 |

### 2.3 草稿系统 (Drafts)

Longform 通过**共享 title** 来分组草稿。同一个 title 的多个项目自动归为一个"项目组"，在侧栏中折叠为版本集合。

| 功能 | 实现方式 |
|------|---------|
| 创建新草稿 | Project tab → (+) 按钮 |
| 重命名 | 右键 or 改 frontmatter 中的 `draftTitle` |
| 切换 | 侧栏点击不同草稿 |

**约束：** 无草稿间 diff、无版本对比、无分支管理。

### 2.4 编译系统 (Compile)

Longform 提供一个**工作流引擎**，将多个场景合并为一个手稿文件：

| 步骤类型 | 功能 |
|----------|------|
| Scene Steps | 格式化单个场景（标题、元数据、内容） |
| Separator Steps | 场景间分隔符（`***`、`#`、分页符） |
| Link Removal | 移除 wiki 链接、内部引用 |
| Output Formatting | 输出路径、文件名、文本变换 |

默认工作流开箱即用，社区提供可共享的编译步骤集。

**局限：** 没有原生的 `.docx`/`.epub`/`.pdf` 导出 — 需要 Pandoc 或其他插件的联动。

### 2.5 场景元数据生态

场景文件可以（且社区鼓励）包含丰富的前置元数据：

```yaml
---
type: scene
status: draft          # idea | outline | draft | revised | final
pov: 张三
characters:
  - 张三
  - 李四
setting: 长安城
timeline: 第三年秋
synopsis: 张三和李四在长安城相遇
word-goal: 2000
---
```

这些元数据通过 **Dataview** 可查询、可聚合，形成场景级的数据仪表盘。

---

## 3. 项目管理流程

### 3.1 用户流转

```txt
发现场景笔记散乱
     ↓
安装 Longform 插件
     ↓
右键文件夹 → Create Longform Project
     ↓
选择项目类型（Multi / Single）
     ↓
输入标题 → 生成索引文件
     ↓
Scenes Tab → 添加场景
     ↓
Drag & Drop 排序 / 缩进成章节
     ↓
写作（在各个场景文件中）
     ↓
Project Tab → 查看字数/进度
     ↓
Compile Tab → 合并为手稿
     ↓
导出/发布（需外部工具）
```

### 3.2 状态跟踪

| 维度 | 实现方式 | 评价 |
|------|---------|------|
| 场景状态 | 自定义 frontmatter 属性 `status` | 灵活但无约束，依赖用户纪律 |
| 字数统计 | 场景级 + 草稿级 + 项目级 | 基础但够用 |
| 写作目标 | 每日目标设定（侧栏显示） | 简单，无进度条/里程碑 |
| 草稿版本 | 共享 title 分组 | 基本，无 diff/分支 |

**缺失的能力：**
- 无 Bat 图 / Beat Sheet / Save the Cat 等结构模板
- 无版本对比（diff）
- 无可视化日历/里程碑
- 无协作/多人编辑
- 无正典/偏离检测

---

## 4. UI 交互分析

### 4.1 界面结构

```
Obsidian 窗口
├── 左侧边栏（文件资源管理器 + Longform 侧栏）
│   ├── Projects 列表（所有 Longform 项目）
│   └── 当前项目的草稿版本
├── 主编辑区（场景文件）
│   └── .longform-leaf CSS class（可自定义写作区样式）
├── Longform 面板（右侧/主区）
│   ├── Scenes Tab ── 场景树（拖拽排序）
│   ├── Project Tab ── 元数据 + 字数 + 草稿管理
│   └── Compile Tab ── 工作流 + 输出
└── 状态栏（字数 / 写作目标进度）
```

### 4.2 值得借鉴的交互

| 交互 | 优点 | 评分 |
|------|------|------|
| **场景树拖拽排序** | 直观、流畅，支持嵌套（章节→场景） | ⭐⭐⭐⭐⭐ |
| **三 Tab 面板** | 功能分区清晰，不互相干扰 | ⭐⭐⭐⭐ |
| **侧栏项目列表** | 跨仓库项目聚合，全局可见 | ⭐⭐⭐⭐ |
| **.longform-leaf CSS** | 场景独立样式，写作区沉浸 | ⭐⭐⭐⭐ |
| **选中即编辑** | 点击场景名称即打开对应文件 | ⭐⭐⭐ |
| **草稿版本分组** | 折叠式版本管理，空间利用好 | ⭐⭐⭐ |

### 4.3 交互缺陷

| 缺陷 | 影响 |
|------|------|
| 无**可视化画板**（Corkboard / 卡片墙） | 无法"看到"整体节奏 |
| 场景树**无预览/悬浮卡片** | 拖动时看不到内容摘要 |
| 编译流程**不可视** | 无法直观看到工作流图 |
| 无**正典引导** | 用户不知道哪些场景偏离了主线 |
| 侧栏**不显示场景状态** | 需要打开场景文件才能看 status |
| 无**批量操作** | 不能批量修改场景元数据 |

---

## 5. 关联生态：Inkswell 和 Scrivener

### 5.1 Inkswell（Longform 的进化版）

Inkswell（Daniel King，[GitHub](https://github.com/leethobbit/obsidian-inkswell-plugin)）是目前 Obsidian 生态中最完整的长篇写作套件，版本 v1.4.0（2026年7月），**完全向后兼容 Longform**。

| 维度 | Longform | Inkswell |
|------|----------|----------|
| **场景管理** | 基本拖拽树 | 树 + Kanban Board + Beat Sheets 联动 |
| **规划工具** | 无 | Save the Cat 等 7 种 Beat Sheet 模板 |
| **修订工具** | 无 | 场景检查清单、角色弧网格、风格一致性扫描 |
| **写作冲刺** | 仅每日目标 | 定时冲刺 + Deadline 计算 + Heatmap |
| **正典 / Codex** | 无 | 角色/地点/事件/物品百科，提及自动检测 |
| **导出** | 基本工作流 | Markdown + HTML + Pandoc 联动 |
| **发布计划** | 无 | 出版检查清单、预算、封面、ARC 跟踪 |
| **移动端** | 基本支持 | 平板专属布局，手机专注模式 |

**Inkswell 的关键设计哲学：**
- 本地优先，无网络调用、无遥测
- 无 AI（框架性工具，而非生成式工具）
- curated UX — 每个阶段只展示最重要的功能

### 5.2 Scrivener（行业金标准）

| 维度 | Scrivener | Longform | Inkswell |
|------|-----------|----------|----------|
| **Binder** | 原生分层 binder | 文件树 | 场景树 |
| **Corkboard** | 虚拟索引卡（可拖拽、可预览） | ❌ | Kanban（非卡片墙） |
| **编译** | 全格式编译引擎 | 基础工作流 | Pandoc 联动 |
| **非破坏性编辑** | ❌ 专有 `.scriv` 格式 | ✅ 纯 Markdown | ✅ 纯 Markdown |
| **双链** | ❌ | ✅ Obsidian 原生 | ✅ Obsidian 原生 |
| **成本** | 买断制 | 免费 | 免费 |
| **平台** | 桌面（Windows/Mac） | 全平台 | 全平台 |

**核心差距：** Scrivener 的 Corkboard（虚拟索引卡墙）是长篇作者留恋其生态的首要原因。它允许用户"看到"整本书的节奏，拖拽卡片重新排列，卡片上显示 synopsis 和状态标记。

---

## 6. 织梦机借鉴与超越

### 6.1 织梦机的独特定位

织梦机不是"又一个 Obsidian 写作插件"。它的核心定位是**世界构建与叙事引擎** — 不仅要管理写作项目，更要管理和验证**世界设定的内在一致性**。

### 6.2 可以借鉴的 Longform 设计

| Longform 设计 | 织梦机如何借鉴 |
|---------------|---------------|
| **索引文件（Index File）** | 织梦机的"世界脊柱" — 项目级别的 YAML/JSON 配置文件，管理场景、章节、正典规则 |
| **场景文件即数据** | 保持纯 Markdown 文件 + frontmatter 元数据的架构，不锁定格式 |
| **非破坏性原则** | 织梦机的任何操作不得修改用户场景正文（只改元数据/索引） |
| **侧栏项目聚合** | 织梦机侧栏显示所有世界/故事项目，支持快速切换 |
| **三 Tab 面板模式** | 场景管理 / 世界元数据 / 正典检查 三个核心面板 |
| **社区工作流** | 正典检查规则可共享（社区贡献的 ruleset） |
| **拖拽排序 + 嵌套层级** | 章节→场景→子场景的三层拖拽树 |

### 6.3 织梦机可以超越的方向

| 超越点 | Longform 现状 | 织梦机方案 |
|--------|--------------|-----------|
| **正典检查** | ❌ 无 | 场景级正典一致性检查（人物/地点/时间线是否与正典冲突） |
| **可视化画板** | ❌ 无 Corkboard | Canvas 集成 + 浮动场景卡片（显示 synopsis、状态、正典标记） |
| **场景状态仪表盘** | ❌ 无 | 按状态/章节/角色/位置多维度聚合的场景矩阵 |
| **写作目标里程碑** | 仅每日字数 | 里程碑 + 进度条 + 预测完成日期 + Deadline 推演 |
| **版本对比** | ❌ 无草稿 diff | 草稿间场景级的增删改 diff（利用 Git 或内部快照） |
| **场景预览** | ❌ 无 | 拖拽时悬浮卡片预览场景摘要 |
| **AI 辅助** | ❌ 不涉及 | 场景摘要生成、正典冲突检测、角色一致性检查 |
| **导出管道** | 仅 Markdown | 多渠道导出（Epub/PDF/Web/剧本格式）+ 自定义模板 |
| **协作** | ❌ 单人 | 多人世界构建（共享正典、分角色写作、合并流程） |
| **世界级元数据** | 只有场景元数据 | 全局角色档案、地点地图、时间线、关系图谱、事件年表 |
| **场景批量操作** | ❌ 无 | 批量修改元数据、批量标记状态、批量正典扫描 |

### 6.4 优先级建议

基于织梦机 v1.2 的 30 条问题和大秋验收结果，建议的分层：

| 优先级 | 功能 | 理由 |
|--------|------|------|
| **P0** | 正典检查引擎 | 这是织梦机的核心差异化，也是用户反馈最高频的痛点 |
| **P1** | 可视化画板（Canvas 场景卡） | 对标 Scrivener Corkboard，视觉化管理场景节奏 |
| **P1** | 场景状态仪表盘 | 让用户一眼看清整个项目的进度分布 |
| **P2** | 写作目标 + 里程碑 | 基本的项目管理诉求 |
| **P2** | 场景拖拽排序 | 对标 Longform 的核心交互 |
| **P3** | 版本对比 / 草稿管理 | 重要但可以先用手动方案 |
| **P3** | AI 正典冲突检测 | 差异化价值高但要等核心引擎稳定后 |
| **Later** | 协作 / 发布管道 | 平台阶段再考虑 |

### 6.5 不应做的

- ❌ 不做**通用笔记工具** — 织梦机是专用引擎，不是 Obsidian 替代品
- ❌ 不做**编辑器** — 沿用用户习惯的编辑器（Obsidian / VS Code / Typora）
- ❌ 不做**AI 生成** — 织梦机是正典管理工具，不是 AI 写手
- ❌ 不锁定格式 — 数据必须是可迁移的纯文本/JSON

---

## 7. 总结：决策建议

### Longform 的核心启示

Longform 证明了一个关键产品命题：**在纯 Markdown 生态中，用 frontmatter 驱动的索引文件可以实现不亚于 Scrivener 的项目管理能力**，同时保持文件的开放性和可迁移性。它的索引文件模式是织梦机最应该学习的架构决策。

### Inkswell 的启示

Inkswell 展示了 Longform 模式可以进化到什么程度 — 从"基本场景管理"扩展到"全生命周期写作套件"。织梦机不应该试图复制 Inkswell 的广度（那会变成 generic writing tool），而应该**聚焦在世界构建 + 正典管理**这个垂直领域。

### 织梦机的差异化定位

```txt
Scrivener = 写作项目管理（金标准输出 → 出版）
Longform  = 场景文件管理（Obsidian 写作生态）
Inkswell  = 写作全周期套件（Longform 的广度扩展）
织梦机    = 世界构建 + 正典引擎（在写作之前和之后的价值链）
```

织梦机的核心战场不在"怎么写完一本书"，而在**"如何保证构建的世界经得起推敲"**。这是 Longform/Inkswell/Scrivener 都不覆盖的空白地带。

### 推荐下一步

1. **架构决策**：采用 Longform 的索引文件模式，但扩展为"世界脊柱"（包含正典规则、角色档案、场景清单、时间线）
2. **最小 MVP**：场景树 + 正典检查（一个规则引擎 + UI 提示）
3. **UI 原型**：Canvas 画板上的场景卡片（参照 Scrivener Corkboard 交互）
4. **实施路线**：Scenes 面板 → 正典引擎 → Canvas 画板 → 仪表盘 → AI 辅助

---

## 参考资料

- [kevboh/longform — GitHub](https://github.com/kevboh/longform)
- [Longform Obsidian Stats](https://www.obsidianstats.com/plugins/longform)
- [Longform: 长篇写作的终极革命 — CSDN](https://blog.csdn.net/gitblog_01153/article/details/155742042)
- [Longform 使用指南 — Pkmer](https://pkmer.cn/Pkmer-Docs/10-obsidian/obsidian%E7%A4%BE%E5%8C%BA%E6%8F%92%E4%BB%B6/longform/)
- [Longform 多文档管理 — CSDN](https://blog.csdn.net/xieyan0811/article/details/137465752)
- [Longform 在 Obsidian VIP](https://obsidian.vip/zh/plugins/longform)
- [Inkswell Plugin — GitHub](https://github.com/leethobbit/obsidian-inkswell-plugin)
- [Inkswell Obsidian Stats](https://www.obsidianstats.com/plugins/inkswell)
- [Writing Studio — GitHub](https://github.com/writerP-777/obsidian-writing-studio)
