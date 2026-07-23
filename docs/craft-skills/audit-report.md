# 审计报告 — 织梦机 v2.0 Craft Skill 体系自审计

> Audit Domain: Skill (SIF) + Agent (5-Layer)
> Date: 2026-07-08
> Auditor: Self-audit via Audit skill

---

## 一、技能审计 (Skill Audit — SIF Domain)

### 1.1 Archetype 分类准确性

| Skill ID | 声明的 Primary | 5问验证 | 结果 | 说明 |
|----------|---------------|---------|------|------|
| CS-01 | Diagnostic | 产生:问题列表 / 改变:seeing / 指标:recall / 失败:miss / 模型:strong | ✅ 正确 | |
| CS-02 | Diagnostic | 同上 | ✅ 正确 | |
| CS-03 | Diagnostic | 同上 | ✅ 正确 | |
| CS-04 | Diagnostic+Director | 产生:问题列表+判断 / 中weight在度判断 | ✅ 可接受 | Medium thickness 正确 |
| CS-05 | Diagnostic | 同CS-01 | ✅ 正确 | |
| CS-06 | Diagnostic | 同CS-01 | ✅ 正确 | |
| CS-07 | Diagnostic+Director | 类型承诺需判断，secondary Director合理 | ✅ 可接受 | |
| CS-08 | Diagnostic | 同CS-01 | ✅ 正确 | |
| CS-09 | Diagnostic+Director | 综合报告含判断，合理 | ✅ 可接受 | |
| CS-10 | **Delivery** | 产生:人物建议 / 改变:making / 指标:stability / 失败:bad output | ✅ 正确 | 唯一Delivery |
| CS-11~15 | Diagnostic | 五维诊断 | ✅ 正确 | |
| CS-16 | Diagnostic | 网络分析 | ✅ 正确 | |
| **CS-17** | **Director** | 产生:决策 / 改变:judging / 指标:correctness | ✅ 正确 | 合并升格是典型Director |
| CS-18 | Diagnostic+Director | 综合报告含判断 | ✅ 可接受 | |
| CS-19~20 | Diagnostic | 时位/节气诊断 | ✅ 正确 | |
| CS-21 | Diagnostic | 入口诊断 | ✅ 正确 | |
| CS-22 | Diagnostic | 周期嵌套分析 | ✅ 正确 | |
| CS-23 | Diagnostic+Director | 截取最优性含判断 | ✅ 可接受 | |
| CS-24 | Diagnostic+Director | 综合报告含判断 | ✅ 可接受 | |
| CS-25~31 | Diagnostic | 现场八维度诊断 | ✅ 正确 | |
| **CS-32** | **Director** | 产生:剪裁决策 / 改变:judging | ✅ 正确 | 熔裁是典型Director |
| CS-33~37 | Diagnostic | 深处五维度诊断 | ✅ 正确 | |
| CS-38~40 | **Director** | 产生:PASS/FAIL决策 | ✅ 正确 | Gate型Director |

**结论：** Archetype 分类基本准确。2个 Director（CS-17, CS-32）和 3个 Gate Director（CS-38~40）均正确归类。

### 1.2 Skill Smells 检查（12项）

| # | Smell | 严重度 | 涉及 | 详情 |
|---|-------|--------|------|------|
| 1 | Procedure Without Judgment | ✅ 未发现 | — | 所有 Diagnostic skill 均有 lens set + expansion operator |
| 2 | Checklist Without Priority | ✅ 未发现 | — | 输出含评分(0-100)，非简单清单 |
| 3 | Output Format Mistaken For Expertise | ✅ 未发现 | — | 理论引用+功能定义，非空模板 |
| 4 | Overbroad Scope | ✅ 未发现 | — | 每个skill有明确理论出处+功能 |
| 5 | Vague Trigger | ✅ 未发现 | — | input条件明确 |
| 6 | Generic Excellence Language | ⚠️ LOW | mapping.md | 部分描述使用"好/坏/够不够"等相对词，但被理论原文锚定 |
| 7 | Style Words Replacing Criteria | ✅ 未发现 | — | 所有标准均有理论原文引用 |
| 8 | Too Much Philosophy, Not Enough Probes | ✅ 未发现 | — | JSON中有expansion operator + lens set |
| **9** | **No Failure Model / Anti-patterns** | 🔴 **HIGH** | **mapping.md 所有skill** | 映射表中每个skill**缺少"不适用于"边界和反模式**。仅theory-to-skill-mapping.md有理论引用但无skill边界。 |
| **10** | **No Verification Step** | 🔴 **HIGH** | **mapping.md + JSON** | 所有skill**缺少"如何验证本skill运行正确"的步骤**。Gate skills (CS-38~40) 有PASS/FAIL，但那是技能输出而不是技能自身的验证。 |
| 11 | Probe Closure | ✅ 未发现 | — | Stop condition已定义 |
| **12** | **No Boundary Awareness** | 🔴 **HIGH** | **mapping.md + JSON** | 没有显式声明"不适用于什么场景"的边界 |

### 1.3 SIF 六维评分

| 维度 | 分数 | 说明 |
|------|------|------|
| **Discovery** | 35/50 | Expansion operator + lens set 定义完整，但缺少 per-skill 的 probe quality 显式说明 |
| **Delivery** | 30/50 | Output 结构清晰，但缺少 priority ordering（多个发现如何排序） |
| **Integration** | 38/50 | Trigger + scope + context 完整，chain定义存在但语义反转(见#1.4) |
| **Generation** | 25/50 | 仅 CS-10 有 generation 需求。其他为诊断型，不适用 |
| **Director** | 30/50 | CS-17/32/38~40 有明确 thesis，但缺少 tradeoff 框架 |
| **Wisdom Density** | 7/10 | 理论原文引用增加了密度，但部分 skill 边界描述不够精确 |

### 1.4 发现问题汇总

#### 🔴 CRITICAL: callChain 语义反转

**位置：** `craft-skill-architecture.json` 中所有 skill 的 `callChain` 字段

**描述：** `after` 和 `before` 字段的语义定义与使用相反。

- CS-11 应为 `before: [CS-12]`，但写的是 `after: [CS-12]`
- CS-04 应为 `after: [CS-01, CS-02, CS-03]` 且 `before: [CS-32]`，但实际与之相反

**影响：** 所有 40 个 skill 的调用链顺序无法被自动化工具正确解析。

**修复方案：** 统一语义规范（推荐使用 `dependsOn` / `triggers` 或 `precedes` / `follows`），然后反转所有 40 条记录。

---

#### 🔴 HIGH: 缺少 per-skill 边界声明 ("不适用于")

**位置：** `theory-to-skill-mapping.md` 和 `craft-skill-architecture.json`

**描述：** SIF 标准要求每个 skill 有明确的 scope boundary，包括：
1. 什么情况下**不**应该调用此 skill
2. 什么输入类型此 skill **不**支持
3. 此 skill 的诊断**不**覆盖什么范围

当前 40 个 skill 中 0 个有边界声明。

**示例：** CS-05 (欲望入口诊断) 应声明不适用于「非开篇章节」「非叙事性文本」「诗歌」等。

---

#### 🔴 HIGH: 缺少 verification step

**位置：** 所有 40 个 skill 定义

**描述：** SIF 标准要求每个 skill 有验证步骤，即如何确认 skill 运行正确。

每个 Diagnostic skill 至少应声明：
1. 如何验证发现的问题是真的（误报率控制）
2. 如何验证没有漏掉问题（漏报率控制）

---

#### 🟡 MEDIUM: 技能边界重叠（3 处）

| 重叠对 | 重叠点 | 建议 |
|--------|--------|------|
| CS-01 (具象) ↔ CS-30 (情采) | 都检查"抽象→具体"转换 | CS-01 聚焦情感/状态抽象，CS-30 聚焦形容词堆砌。需加区分说明 |
| CS-03 (余地) ↔ CS-35 (有无) | 都涉及"未说/未写"的东西 | CS-03 聚焦解释过度，CS-35 聚焦结构空缺。需加区分说明 |
| CS-22 (周期嵌套) ↔ CS-23 (命运/叙事双层) | 都涉及周期分析 | CS-22 侧重多线对齐，CS-23 侧重截取段。需加区分说明 |

---

#### 🟡 MEDIUM: thickness 评估偏厚

**位置：** `craft-skill-architecture.json` — 26 个 medium、14 个 thin

**描述：** 根据 SIF v3.1，Diagnostic skill 在 base model 强的领域应为 thin。Claude 对文学判断有足够能力，26 个 medium 中至少 10 个可降为 thin（CS-04/05/06/08/16/21/22/25/26/27）。

**影响：** 过厚的 thickness 意味着将来实现时 context 占用偏高，结构过重。

---

#### 🟢 LOW: 映射表调用链与 JSON 调用链不一致

**位置：** `theory-to-skill-mapping.md` 中各 skill 的调用链 vs `craft-skill-architecture.json` 中的 callChain

**示例：**
- mapping.md: CS-01 → CS-04 → CS-13（但 CS-13 是 character-zhi，与 aesthetics 无关）
- JSON: CS-01 → CS-04（正确）

说明 mapping.md 中部分调用链引用了错误 skill ID（将 scene-eight-dimensions 误标为 CS-13）。

---

#### 🟢 LOW: "三重检验"重复定义

**位置：** `theory-to-skill-mapping.md` 第74-82行独立定义了三重检验，同时 CS-38 也定义了三重检验 Gate。

**建议：** 删除映射表中的独立定义，统一到 CS-38。

---

## 二、Agent 审计 (Agent Audit — 5-Layer)

### 2.1 Layer 1: Architecture & Design

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Pattern 选择 | ✅ Orchestrator-Workers | 适合复合写作任务，动态路由到不同 agent |
| Simple-first | ✅ | 从固定 skill chain 开始，非自主 agent |
| Workflow for fixed steps | ✅ | Skill chain 是预定义路径 |
| Multi-agent 合理性 | ⚠️ 适中 | 5个agent（Orchestrator/Architect/Writer/Reader/Inspector）有明确分工 |
| Sectioning 独立子任务 | ✅ | Architect→Writer→Reader→Inspector 是串行依赖，非并行 |

**问题：** Reader 和 Inspector 的角色高度重叠。
- Reader (CS-05~09) 做读者体验诊断
- Inspector (CS-33~40) 做深处诊断 + Gate
两者都是 Diagnostic 主导。**建议：** 可合并为 ReaderInspector，节省一次 agent 调用。

### 2.2 Layer 2: Structure & Organization

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Command Center | ✅ | Orchestrator 作为单一路由入口 |
| Local Centers 暂态性 | ✅ | Agent 按 session 创建，无持久组织 |
| Queue-driven execution | ❌ **缺失** | 没有显式 work queue 机制 |
| Skill-agent 分离 | ✅ | Skills 作为独立包，agent 是执行器 |
| Script-model 边界 | ✅ | Skills 是模型级能力，无脚本越界 |
| Gate 独立性 | ✅ | Inspector 独立于 Writer/Architect |

**问题：** 没有 work queue。所有任务都是 Orchestrator 即时路由，无法缓存或排队。对实时写作工具这不是大问题，但缺少异步能力。

### 2.3 Layer 3: Agent Definition (Instruction + Context + Tools + Model)

| 元素 | 结果 | 说明 |
|------|------|------|
| **Instruction** | ✅ 显式 | 每个 agent 有 role + archetype + 职责表 |
| **Context** | ⚠️ 部分缺失 | 有 inputs 定义，但**没有 forbidden scope** |
| **Tools (Skills)** | ✅ 显式 | 每个 agent 持有明确的 skill 列表 |
| **Model** | ❌ **缺失** | 没有为任何 agent 指定 model tier |

**问题：**
1. **Missing forbidden scope** — 没有声明每个 agent 不做什么。例如 Architect 不应直接写场景文本。
2. **Missing model tier** — 没有声明每个 agent 应该用哪个模型。Orchestrator（路由）可用小型模型，Writer（生成）需旗舰模型。

### 2.4 Layer 4: Cost & Efficiency

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Multi-agent 合理性 | ⚠️ 5个较多 | 建议合并 Reader+Inspector → 4个 |
| Model tier | ❌ | 未指定 |
| Context budget | ❌ | 未指定 |
| User attention budget | ✅ | 三路深度(1/2/3)间接管理了用户注意力 |
| Agent count 最小化 | ⚠️ 可精简 | 5→4为更优 |

**问题：** 无 token budget 或 context budget 定义。长期运行会导致 context 膨胀。

### 2.5 Layer 5: Security & Compliance (OWASP ASI)

| 控制 | 结果 | 说明 |
|------|------|------|
| ASI-01 Input Protection | N/A | 单用户写作工具，无外部输入风险 |
| ASI-02 Tool Governance | ⚠️ | Skills 是工具，有 allowlist 但无 deny list |
| ASI-03 Agency Boundaries | ⚠️ | 无 forbidden scope |
| ASI-04 Escalation Control | ✅ N/A | 无自我授权 |
| ASI-05 Trust Boundary | ✅ N/A | 单用户 |
| ASI-06 Observability | ❌ | 无日志/审计追踪定义 |
| ASI-07 Identity | ✅ N/A | 单用户 |
| ASI-08 Policy Integrity | ✅ N/A | 无策略引擎 |
| ASI-09 Supply Chain | ✅ N/A | 无外部插件 |
| ASI-10 Behavioral Monitoring | ❌ | 无 kill switch 或 circuit breaker |

---

## 三、审计结论

### Score Summary

| 维度 | 分数 | 级别 |
|------|------|------|
| Skill Archetype 准确性 | 4.5/5 | ⭐ 优秀 |
| Skill Smell 健康度 | 6/12 smells clean | 🟡 中等 |
| Skill 六维评分(均值) | 33/50 | 🟡 中等偏上 |
| Agent Architecture (L1) | 4/5 | 🟢 良好 |
| Agent Organization (L2) | 3/5 | 🟡 需改进 |
| Agent Definition (L3) | 2.5/5 | 🟠 不足 |
| Agent Cost (L4) | 2/5 | 🔴 需补充 |
| Agent Security (L5) | 3/10 controls | 🟢 N/A(单用户) |

### 必须修复 (P0) — ✅ 已全部修复

1. ~~**callChain 语义反转** — JSON 中 40 个 skill 的 `after`/`before` 全部写反~~ ✅ 已改为 `precedes`/`follows` 语义，40条全部更正
2. ~~**缺少 per-skill 边界声明** — 40 个 skill 均无 "不适用于" 声明~~ ✅ JSON `notApplicable` + mapping.md `不适用于` 已全部补全（40/40）

### 建议修复 (P1) — ✅ 已全部修复

3. ~~**缺少 verification step** — 违反 SIF smell #11~~ ✅ JSON `verification` + mapping.md `验证方法` 已全部补全（40/40）
4. ~~**Agent 缺少 model tier**~~ ✅ 5个 agent 全部指定：Orchestrator(小型) / Reader(中型) / Architect、Writer、Inspector(旗舰)
5. ~~**Agent 缺少 forbidden scope**~~ ✅ 5个 agent 全部添加禁入范围

### 优化建议 (P2)

6. **Reader + Inspector 合并** → 节省一次 agent 调用（当前各5个agent，可优化为4个）
7. **26 thin / 14 medium** ✅ 厚度已按 SIF v3.1 调整（从14 thin→26 thin）
8. **mapping.md 中的 stale 调用链引用** ✅ CS-01 调用链已修正（CS-13→CS-32）
9. **"三重检验"去重** ✅ 已合并到 CS-38
10. **技能边界重叠说明** — CS-01/30、CS-03/35、CS-22/23 仍需增加区分文档
11. **完成报告更新** — `done/zhimengji-v2-craft-skill-mapping.json` 需补充修复摘要
