# Agent 层设计 — 织梦机 v2.0

> 基于 SIF (Skill Intelligence Framework) Archetype System
> 文学天演论六部理论 → 40 Craft Skills → 4 Agents

---

## 总览

```
┌────────────────────────────────────────────────────┐
│                    User Layer                       │
│  小新 (自动模式) │ 老张 (半自动) │ 老陈 (手动)    │
└────────────────────┬───────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────┐
│             01. Orchestrator (协调者)               │
│   Archetype: Workflow + Director                   │
│   职责: 理解用户意图 → 路由任务 → 编排skill链      │
└────┬──────────┬──────────┬──────────┬──────────────┘
     │          │          │          │
┌────▼──┐ ┌───▼────┐ ┌───▼────┐ ┌──▼───────────┐
│02.    │ │03.     │ │04.     │ │05.            │
│Archit.│ │Writer  │ │Reader  │ │Inspector      │
│建构者 │ │写作者  │ │读者官  │ │审查官         │
│       │ │        │ │        │ │               │
│Director│Delivery│Diagnostic│Director+Diagnos.│
│       │ │+Diagn. │ │+Director│               │
└───────┘ └────────┘ └────────┘ └───────────────┘
```

---

## Agent 01: Orchestrator（协调者）

> SIF Archetype: **Workflow** (primary) + **Director** (secondary)
> 理论映射: 命运篇「大中小周期」— 协调多线任务

### 核心职责

| 维度 | 内容 |
|------|------|
| **Convergence** | 可执行的 skill 编排计划 |
| **Capability** | 理解用户意图 → 分解为 skill 链 → 路由到正确 agent → 收集结果 → 综合报告 |
| **Success Metric** | 编排覆盖率（用户意图→skill链的映射完整性） |
| **Failure Mode** | 遗漏关键 skill 维度 |
| **Thickness** | thin — 不做具体 skill 工作，只路由 |
| **Model Tier** | 小型模型（路由只需分类，无需深度推理） |
| **Forbidden Scope** | 不直接执行任何 skill；不修改文本；不越过 Inspector 直接发布 |

### 路由决策

```
用户输入
  │
  ├─ 人物设计需求 → Architect Agent
  ├─ 大纲/结构需求 → Architect Agent
  ├─ 写作/场景需求 → Writer Agent
  ├─ 读者/体验需求 → Reader Agent  
  ├─ 全局审查需求 → Inspector Agent
  └─ 最终发布 → Inspector Agent (Gate)
```

### 深度适配

```yaml
orchestrator_depth:
  xiaoxin: "全自动。Orchestrator 根据最近修改自动调用对应 skill，输出综合报告"
  laozhang: "半自动。Orchestrator 列出可选 skill 链，老张选择哪些要运行"
  laochen: "手动。老陈指定 skill/agent/参数，Orchestrator 执行路由"
```

### 持有技能

| Skill ID | 调用时机 |
|----------|---------|
| CS-22 | cycle-layering — 分析当前任务在全书周期中的位置 |
| CS-23 | fate-narrative-double — 区分命运/叙事周期 |
| CS-24 | fate-comprehensive — 全局结构健康度（初始诊断用） |

### 输出

```yaml
orchestrator_output:
  plan:
    - agent: "architect | writer | reader | inspector"
    - skills: ["CS-XX", "CS-YY"]
    - depth: 1 | 2 | 3
    - chain: "skill 调用顺序"
  estimated_cost:
    - tokens: number
    - time: "estimated_minutes"
```

---

## Agent 02: Architect（建构者）

> SIF Archetype: **Director** (primary) + **Diagnostic** (secondary) + **Delivery** (tertiary)
> 理论映射: 人物篇 + 命运篇 — 设计故事的深层结构

### 核心职责

| 维度 | 内容 |
|------|------|
| **Convergence** | 人物深度档案 + 命运结构图 |
| **Capability** | 从机制生成人物 → 诊断私处执为已 → 设计命运周期 → 规划叙事入口 |
| **Success Metric** | 人物-结构-命运三位一体的一致性 |
| **Failure Mode** | 人物设计脱离命运结构 |
| **Thickness** | medium |
| **Model Tier** | 旗舰模型（人物+命运分析需深度推理和文学判断） |
| **Forbidden Scope** | 不直接写场景文本；不修改已有文本；不跳过 Writer 直接交付 |

### 持有的 Skill 链

```
Architect 包含两条并行 skill 链：

链A — 人物设计:
  CS-10 (机制受力)   → 生成人物种子
  → CS-11 (私)       → 诊断人物边界
  → CS-12 (处)       → 分析人物处境
  → CS-13 (执)       → 诊断人物执念
  → CS-14 (为)       → 分析行动模式
  → CS-15 (已)       → 规划最终状态
  → CS-16 (关系网)   → 构建人物网络
  → CS-17 (合并)     → 清理冗余人物
  → CS-18 (综合)     → 人物综合报告

链B — 命运结构:
  CS-23 (命运/叙事双层) → 明确截取段
  → CS-21 (叙事入口)     → 选择入口类型
  → CS-19 (十二时位)     → 规划时位分布
  → CS-20 (二十四节气)   → 匹配气候
  → CS-22 (周期嵌套)     → 协调多线
  → CS-24 (综合)         → 结构健康报告
```

### 深度适配

```yaml
architect_depth:
  xiaoxin: "链A+链B 全自动运行。输出人物草稿+结构建议。小新只需选择'好/改/删'"
  laozhang: "链A+链B 运行后显示每步详情，老张可选择性修改中间结果"
  laochen: "链A+链B 每步均可手动控制。老陈从 CS-10 开始逐项设计"
```

### 输入/输出

```yaml
architect_inputs:
  - "故事前提或概念说明书"
  - "世界观设定（可选）"
  - "已有文本（如果有）"

architect_outputs:
  - "人物深度档案（私处执为已五维）"
  - "人物关系网图"
  - "命运结构图（时位分布+周期嵌套）"
  - "叙事入口策略"
```

---

## Agent 03: Writer（写作者）

> SIF Archetype: **Delivery** (primary) + **Diagnostic** (secondary)
> 理论映射: 现场篇 — 故事只在具体的现场成立

### 核心职责

| 维度 | 内容 |
|------|------|
| **Convergence** | 可发布的场景文本 |
| **Capability** | 将人物/结构设计转化为具体场景 → 诊断现场八维度 → 审美打磨 |
| **Success Metric** | 现场独立成立度 + 审美通过率 |
| **Failure Mode** | 场景漂亮但脱离命运结构 |
| **Thickness** | medium-thick |
| **Model Tier** | 旗舰模型（场景写作+审美打磨需最高质量输出） |
| **Forbidden Scope** | 不修改人物设定和命运结构（来自 Architect 的输入为只读）；不做读者验证 |

### 持有的 Skill 链

```
Writer 包含的 skill 链：

链C — 现场书写:
  CS-25 (定势)       → 确定场景势能
  → CS-26 (物色)     → 赋予物品叙事重量
  → CS-27 (身位)     → 布置视点/在场
  → CS-28 (声口)     → 设计对话功能
  → CS-29 (章句)     → 控制句子节奏
  → CS-30 (情采)     → 用选择写情感
  → CS-31 (风骨)     → 锻造文本力度
  → CS-32 (熔裁)     → 修剪非此场之物

链D — 审美打磨:
  CS-01 (具象)       → 抽象→具体转化
  → CS-02 (复调)     → 检查视角重量
  → CS-03 (余地)     → 保留读者空间
  → CS-04 (得度)     → 整体度检查
```

### 深度适配

```yaml
writer_depth:
  xiaoxin: "链C+链D 全自动。Writer 根据大纲生成场景初稿，自动打磨后输出"
  laozhang: "Writer 生成初稿后，逐项显示八维度诊断，老张选择性优化"
  laochen: "Writer 按定义输出。老陈手动控制每个维度的每个细节"
```

### 输入/输出

```yaml
writer_inputs:
  - "场景/章节大纲"
  - "人物深度档案（来自 Architect）"
  - "命运结构图（来自 Architect）"

writer_outputs:
  - "场景/章节文本"
  - "现场八维度诊断报告"
  - "审美四维度检查报告"
```

---

## Agent 04: Reader（读者官）

> SIF Archetype: **Diagnostic** (primary) + **Director** (secondary)
> 理论映射: 读者篇 — 读者不是被动接收者

### 核心职责

| 维度 | 内容 |
|------|------|
| **Convergence** | 读者体验报告 + 问题标记 |
| **Capability** | 用读者层五点诊断文本 — 欲望入口/认知门槛/类型承诺/信息节奏/读者判断空间 |
| **Success Metric** | 读者欲望持续度评分 |
| **Failure Mode** | 忽略特定读者群的差异 |
| **Thickness** | medium |
| **Model Tier** | 中型模型（读者体验诊断可复用基础文学判断力，无需旗舰） |
| **Forbidden Scope** | 不修文本（只管发现不管修复）；不触及深处母题分析 |

### 持有的 Skill 链

```
链E — 读者验证:
  CS-05 (欲望入口)     → 检测开篇欲望
  → CS-06 (低入口)     → 评估认知门槛
  → CS-07 (类型承诺)   → 检查类型一致性
  → CS-08 (信息节奏)   → 分析释放频率
  → CS-09 (综合)       → 读者体验总报告
```

### 深度适配

```yaml
reader_depth:
  xiaoxin: "全自动。Reader 输出一键报告，标记红/黄/绿"
  laozhang: "Reader 显示每项详情+建议，老张选择性修改"
  laochen: "Reader 逐项显示原始数据，老陈手动调整"
```

### 输入/输出

```yaml
reader_inputs:
  - "Writer 产出的文本"
  - "类型标签（用户声明）"

reader_outputs:
  - "读者体验报告（欲望曲线/认知负荷/类型偏离）"
  - "红黄绿标记（P0/P1/P2 问题分级）"
```

---

## Agent 05: Inspector（审查官）

> SIF Archetype: **Director** (primary) + **Diagnostic** (secondary) + **Stance** (tertiary)
> 理论映射: 审美篇三重检验 + 深处篇 — 最终 Gate

### 核心职责

| 维度 | 内容 |
|------|------|
| **Convergence** | PASS/FAIL 决策 |
| **Capability** | 深层诊断+Gate 决策 — 深处母题连贯性/三重检验/读者就绪度 |
| **Success Metric** | Gate 决策正确性（无漏放，无误拦） |
| **Failure Mode** | 过于宽松放行问题文本 / 过于严格阻碍发布 |
| **Thickness** | thin（Gate 型 — 只需要决策，不需要大量产生） |
| **Model Tier** | 旗舰模型（Gate 决策需最强判断力，误判成本高） |
| **Forbidden Scope** | 不修复发现的任何问题（只报告不修改）；不覆写其他 Agent 的输出 |

### 持有的 Skill 链

```
链F — 深处诊断:
  CS-33 (分形)     → 检测模式呼应
  → CS-34 (涌现)   → 提取自然主题
  → CS-35 (有无)   → 检查空缺设计
  → CS-36 (重复)   → 索引重复模式
  → CS-37 (母题)   → 综合母题评估

链G — 最终 Gate:
  CS-38 (三重检验 Gate)    → 情节/现场/余震
  → CS-39 (读者就绪 Gate)  → 读者需求覆盖
  → CS-40 (深处连贯 Gate)  → 深处主题贯穿
```

### 深度适配

```yaml
inspector_depth:
  xiaoxin: "自动运行链F+链G。只输出 PASS/FAIL + 简要原因"
  laozhang: "链F+链G 显示每项详情，老张确认后决定是否 PASS"
  laochen: "链F+链G 每项手动检查。老陈逐条确认深处主题"
```

### 输入/输出

```yaml
inspector_inputs:
  - "最终文本（Writer 产出 + Reader 验证通过）"

inspector_outputs:
  - "深处母题贯穿报告"
  - "三重检验结果（PASS/FAIL/PASS_WITH_NOTES）"
  - "读者就绪度（PASS/FAIL）"
  - "深处连贯度（PASS/FAIL）"
  - "最终发布建议（DELIVER / NEED_FIX / BLOCKED）"
```

---

## 完整工作流

```
                          User Input
                             │
                     ┌───────▼────────┐
                     │ Orchestrator    │
                     │ 路由 + 编排     │
                     └───┬────────┬───┘
                         │        │
              ┌──────────▼──┐  ┌──▼───────────┐
              │ Architect   │  │ (若无结构需求)  │
              │ 人物+命运设计│  │ 直接到 Writer  │
              └──────┬─────┘  └──────┬────────┘
                     │               │
                     └───────┬───────┘
                             │
                     ┌───────▼────────┐
                     │ Writer          │
                     │ 场景写作+审美打磨│
                     └───────┬────────┘
                             │
                     ┌───────▼────────┐
                     │ Reader          │
                     │ 读者体验验证    │
                     └───────┬────────┘
                             │
                     ┌───────▼────────┐
                     │ Inspector       │
                     │ 深处诊断 + Gate │
                     └───────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ DELIVER / NEED  │
                    │ FIX / BLOCKED   │
                    └─────────────────┘
```

### 三路用户走同一套 agent 底层

```
小新: Orchestrator(全自动) → Architect(全自动) → Writer(全自动) → Reader(全自动) → Inspector(全自动)
       → 一键交付

老张: Orchestrator(半自动) → Architect(半自动) → Writer(半自动) → Reader(半自动) → Inspector(半自动)
       → 选择性确认

老陈: Orchestrator(手动) → Architect(手动) → Writer(手动) → Reader(手动) → Inspector(手动)
       → 逐项控制
```

---

## 协议引用

| Agent | 协议文件 | 说明 |
|-------|---------|------|
| Orchestrator | `craft-skill-architecture.json` | skill 注册表 + 调用链定义 |
| Architect | `theory-to-skill-mapping.md` CS-10~24 | 人物+命运 skill 规格 |
| Writer | `theory-to-skill-mapping.md` CS-25~32 + CS-01~04 | 现场+审美 skill 规格 |
| Reader | `theory-to-skill-mapping.md` CS-05~09 | 读者 skill 规格 |
| Inspector | `theory-to-skill-mapping.md` CS-33~40 | 深处+Gate skill 规格 |

---

## 附录：skill 与 agent 的对应关系表

| Skill ID | Skill 名称 | 所属 Agent | Archetype | 阶段 |
|----------|-----------|-----------|-----------|------|
| CS-01 | craft-aesthetics-concrete | Writer | Diagnostic | 审美打磨 |
| CS-02 | craft-aesthetics-complexity | Writer | Diagnostic | 审美打磨 |
| CS-03 | craft-aesthetics-reserve | Writer | Diagnostic | 审美打磨 |
| CS-04 | craft-aesthetics-measure | Writer | Diagnostic+Director | 审美打磨 |
| CS-05 | craft-reader-desire-entry | Reader | Diagnostic | 读者验证 |
| CS-06 | craft-reader-low-entry | Reader | Diagnostic | 读者验证 |
| CS-07 | craft-reader-genre-fidelity | Reader | Diagnostic+Director | 读者验证 |
| CS-08 | craft-reader-info-pacing | Reader | Diagnostic | 读者验证 |
| CS-09 | craft-reader-audience-diagnosis | Reader | Diagnostic+Director | 读者验证 |
| CS-10 | craft-character-mechanism-pressure | Architect | Delivery+Diagnostic | 人物设计 |
| CS-11 | craft-character-si | Architect | Diagnostic | 人物设计 |
| CS-12 | craft-character-chu | Architect | Diagnostic | 人物设计 |
| CS-13 | craft-character-zhi | Architect | Diagnostic | 人物设计 |
| CS-14 | craft-character-wei | Architect | Diagnostic | 人物设计 |
| CS-15 | craft-character-yi | Architect | Diagnostic | 人物设计 |
| CS-16 | craft-character-network | Architect | Diagnostic | 人物设计 |
| CS-17 | craft-character-merging | Architect | Director+Diagnostic | 人物设计 |
| CS-18 | craft-character-diagnosis-comprehensive | Architect | Diagnostic+Director | 人物设计 |
| CS-19 | craft-fate-twelve-positions | Architect | Diagnostic | 命运结构 |
| CS-20 | craft-fate-seasonal-climate | Architect | Diagnostic | 命运结构 |
| CS-21 | craft-fate-narrative-entry | Architect | Diagnostic | 命运结构 |
| CS-22 | craft-fate-cycle-layering | Orchestrator | Diagnostic | 全局 |
| CS-23 | craft-fate-fate-narrative-double | Architect | Diagnostic+Director | 命运结构 |
| CS-24 | craft-fate-positions-comprehensive | Architect | Diagnostic+Director | 命运结构 |
| CS-25 | craft-scene-shi-positioning | Writer | Diagnostic | 现场写作 |
| CS-26 | craft-scene-object-color | Writer | Diagnostic | 现场写作 |
| CS-27 | craft-scene-body-position | Writer | Diagnostic | 现场写作 |
| CS-28 | craft-scene-voice-mouth | Writer | Diagnostic | 现场写作 |
| CS-29 | craft-scene-sentence-rhythm | Writer | Diagnostic | 现场写作 |
| CS-30 | craft-scene-emotion-choice | Writer | Diagnostic | 现场写作 |
| CS-31 | craft-scene-wind-bone | Writer | Diagnostic | 现场写作 |
| CS-32 | craft-scene-melt-tailor | Writer | Director+Diagnostic | 现场写作 |
| CS-33 | craft-depth-fractal | Inspector | Diagnostic | 深处检查 |
| CS-34 | craft-depth-emergence | Inspector | Diagnostic | 深处检查 |
| CS-35 | craft-depth-absence | Inspector | Diagnostic | 深处检查 |
| CS-36 | craft-depth-repetition | Inspector | Diagnostic | 深处检查 |
| CS-37 | craft-depth-motifs | Inspector | Diagnostic | 深处检查 |
| CS-38 | craft-gate-triple-test | Inspector | Director+Diagnostic+Stance | 最终 Gate |
| CS-39 | craft-gate-audience-readiness | Inspector | Director+Stance | 最终 Gate |
| CS-40 | craft-gate-depth-coherence | Inspector | Director+Stance | 最终 Gate |
