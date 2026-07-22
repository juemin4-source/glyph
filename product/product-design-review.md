# Product Design Review — 织梦机 v2

> 状态: 初稿
> 审查人: product-manager (产品定义官)
> 审查日期: 2026-07-09
> 审查范围: v2.0 当前 UI 基线 + v2.0-H Scope Freeze + v2.0.1/v2.0.2/v2.1.0 路线规划
> 审查方法: 代码阅读 + PRD 对照 + 用户体验推演

---

## 0. 审查摘要

| 维度 | 评分 | 关键发现 |
|------|------|---------|
| 信息架构 | ⚠️ 需优化 | 管线/遗留双模式切换不透明；CanvasAiBar 全局渲染导致上下文错位 |
| 交互流程 | ⚠️ 需优化 | 画板确认后缺乏视觉引导；AI 三态标签偏内部术语；建议卡片浮层定位不当 |
| 空状态/错误状态 | ✅ 良好 | ChapterPacketCanvas 的空状态设计优秀可复用；但 AI 配置检测在 3 处重复 |
| v2.0.1 速写入口 | 🔴 未就绪 | 当前架构无"速写模式"插槽，需要 App.tsx 架构决策 |
| v2.1.0 方法论密度 | 🟡 有风险 | 方法论自然语言化已有良好基础，但 4 件套骨架同时落地会增加交互复杂度 |

---

## 1. 发现的问题列表（按严重度）

### 1.1 Critical（关键，必须本轮解决）

#### C-01: 管线/遗留双模式路由不透明

**问题描述：** App.tsx 中 `renderMainContent()` 存在三层路由优先级：`legacyView` → `currentStage` → `activeNavTab`。

- 当用户首次进入项目但 pipeline state 尚未从后端加载时，`currentStage` 为 null → 显示旧版导航标签（文档/画板/设定集/判断记录/AI）。
- 用户可能不知道自己处于"旧版"还是"新版管线"模式。
- Legacy 菜单藏在 PipelineNav 右上角的 `MoreHorizontal` 按钮中，名称为"旧版工具"——对用户而言"旧版"暗示是废弃功能而非正当入口。

**影响：** 新用户进入项目后看到旧版 UI，无法发现管线模式。老用户也无法理解何时应该用管线何时用旧版。

**位置：** `App.tsx` lines 910-1011, `PipelineNav.tsx` lines 29-33

**建议归属版本：** v2.0-H (P0) / v2.0.1 (P1)

---

#### C-02: CanvasAiBar 全局渲染导致上下文错位

**问题描述：** CanvasAiBar 在 App.tsx 第 1046 行无条件渲染，无论用户处于管线模式还是旧版导航模式。

```tsx
<CanvasAiBar stage={currentStage || 'premise'} />
```

- 当 `currentStage` 为 null 时，stage 降级为 'premise'，AI bar 显示"前提 画板"——但用户实际可能在看"设定集"或"文档"。
- 用户在 Bookshelf（书架）界面时 AI bar 不可见（在 `activeBookId === null` 的分支外），这符合预期。但进入项目后 AI bar 始终可见，即使在看"判断记录"这种不需要 AI 的页面。

**影响：** 用户收到错误的上下文信号。"前提画板"的标签在非前提页面显示，降低信任感。

**位置：** `App.tsx` line 1046, `CanvasAiBar.tsx` lines 578-590

**建议归属版本：** v2.0-H (P0)

---

#### C-03: AI 三态标签偏内部术语

**问题描述：** `ai-output.ts` 定义的三态标签：

| 内部术语 | 用户可见标签 | 描述 |
|---------|------------|------|
| discuss | 讨论 | 不影响画板数据 |
| suggest | 建议 | 采纳后才写入 |
| write_preview | 写入预览 | 确认后才生效 |

- "讨论"、"建议"、"写入预览" 对创作场景的用户而言，功能差异不直观。
- 用户难以理解"讨论"和"建议"在实际使用中有什么区别——两者都接受文本输入、都产生 AI 回复。
- 关键在于**输出后的操作不同**（discuss → 只是聊天、suggest → 采纳才写、write_preview → 确认才写），但用户在发送前需要理解这个差异。

**影响：** 用户在三种模式间随意切换，不理解为什么有些回复能直接写入、有些需要采纳。

**位置：** `ai-output.ts` lines 17-34, `CanvasAiBar.tsx` lines 598-606

**建议归属版本：** v2.0-H (P0，在 AI 三态真实路由就绪前修正)

---

### 1.2 Major（重要，建议本轮或下轮解决）

#### M-01: 画板确认后缺乏视觉引导

**问题描述：** 每个画板的确认流程：

1. PremiseEntryGate: 确认后显示"前提已确认，前往结构图"的静态文字 + "点击上方导航栏「大纲」开始构建结构"建议
2. StructureFlowView: 确认后无视觉反馈，用户需手动点击"大纲"→"设定"
3. SettingCanvasV2: 确认后 Toast 提示"设定已确认，细纲画板已解锁"，但无下一步引导
4. ChapterPacketCanvas: 确认后 Toast 提示"细纲包已确认"，但无下一步引导

**影响：** 用户在每一步确认后需要自行发现下一步操作。对首次用户（Lower-Bound User）而言，这增加了学习成本。

**位置：** `PremiseEntryGate.tsx` lines 183-213, `StructureFlowView.tsx` line 302-309, `SettingCanvasV2.tsx` line 36-42

**建议归属版本：** v2.0-H (P1，非阻断但建议)

---

#### M-02: AiSuggestionCard 浮动定位与 AI bar 竞争

**问题描述：** AiSuggestionCard 以 `position: fixed; bottom: 80; left: 50%; transform: translateX(-50%)` 浮动展示（`CanvasAiBar.tsx` lines 666-691）。

- 底部 80px 刚好在 AI bar（高度约 44px）上方，两条建议堆叠时可能被 AI bar 遮挡。
- 固定定位不受画板滚动影响，可能在用户滚动到页面底部时与 footer 重叠。
- 多条建议堆叠时，用户无法同时看到建议卡和画板内容。

**影响：** 建议卡可读性和操作便利性受影响。用户可能需要关闭建议卡才能继续编辑。

**位置：** `CanvasAiBar.tsx` lines 666-691

**建议归属版本：** v2.0-H (P1)

---

#### M-03: AI 配置检测在三个组件中重复实现

**问题描述：** AI 连接状态检测在以下三处独立实现：

1. `CanvasAiBar.tsx` lines 184-224 — 检测 Tauri 环境 + HTTP 连接测试
2. `ChapterPacketCanvas.tsx` lines 376-385 — 检测 Tauri 环境 + HTTP 连接测试
3. `TextCanvas.tsx` lines 84-93 — 检测 Tauri 环境 + HTTP 连接测试

**重复逻辑：** 检测 Tauri 运行时、调用 `testConnection`、设置 `aiConfigured` 状态。

**影响：** 4 处重复（加上未来可能新增的组件）意味着维护成本高、行为可能不一致。如果连接策略变化，需修改所有位置。

**位置：** 三个组件各自实现了 AI 配置检测

**建议归属版本：** v2.0.2（AI Capability Foundation 阶段统一为全局 Context/Provider）

---

#### M-04: TextCanvas 空状态引导不具交互性

**问题描述：** `TextCanvas.tsx` 第 146-147 行显示 "→ 前往画板④"，但这是一个 `<span>` 标签，不是可点击的导航按钮。

```tsx
<div className="text-canvas-empty-action">
  <span className="text-canvas-packet-badge">→ 前往画板④</span>
</div>
```

**影响：** 用户看到引导但无法点击跳转，需要手动点击导航栏中的"细纲"画板。对 Lower-Bound User 而言，这可能造成卡顿。

**位置：** `TextCanvas.tsx` lines 146-147

**建议归属版本：** v2.0-H (P1)

---

#### M-05: LegacyView 是一个增长中的临时方案

**问题描述：** `legacyView` 状态目前支持三种视图：`canvas`、`ai-chat`、`setting-collection`。它在 App.tsx 中作为一个`override`机制存在（line 137），优先级高于管线模式。

- 当前有 3 个 legacy 入口（CanvasView、AI Chat、SettingCollection），但它们是 v1.x 的组件，与 v2 管线无关。
- 每个 legacy 视图都需要在 `renderMainContent()` 中单独渲染（lines 912-937），增加了主渲染函数的复杂度。
- 随着 v2 推进，这些 legacy 视图应当逐步退役，但目前没有退役计划。

**影响：** 随着管线成熟，legacy 视图成为维护负担。"旧版工具"菜单暗示用户存在平行 UI，这不利于产品认知的统一。

**位置：** `App.tsx` lines 137, 490-493, 912-937

**建议归属版本：** v2.0-H (P2，制定退役计划但不强制本轮执行) → v2.1.0 逐步退役

---

### 1.3 Minor（次要，可推迟）

#### m-01: PipelineNav 项目标题显示宽度有限

**问题描述：** `PipelineNav.tsx` 第 27 行设置 `max-width: 160px`，长作品名会被截断。

**影响：** 用户可能看不到完整项目名，对长标题不友好。

---

#### m-02: CanvasAiBar 在管线模式下显示当前 stage 但无全局 AI 模式

**问题描述：** CanvasAiBar 只显示当前画板名称（如"前提 画板"），不显示当前在哪个画板或项目的全局上下文。用户在同一项目的不同画板间切换时，AI bar 的上下文会变化，但用户可能不知道 AI 当前是否"知道"当前画板的上下文。

---

#### m-03: AI 生成预览弹窗无编辑能力

**问题描述：** `AiWritePreviewPanel.tsx` 和 `TextCanvas.tsx` 的预览弹窗都使用 `readOnly` textarea。用户无法在确认前修改 AI 生成的内容——只能全盘接受或全盘放弃。

**影响：** 用户可能希望微调 AI 输出后再确认。全部放弃再重新生成成本高。

---

## 2. 优化建议（按优先级）

### P0: 必须在本轮（v2.0-H）解决

#### P0-1: 修复 CanvasAiBar 上下文错位

**方案：** CanvasAiBar 仅当 `currentStage` 存在时才渲染。移除 `|| 'premise'` 降级。

```tsx
{currentStage && <CanvasAiBar stage={currentStage} />}
```

**如果需要 legacy view 下也有 AI 功能**：保留 legacy AIChat 入口（已有）作为兜底，让 CanvasAiBar 仅在管线模式下可用。

**状态绑定：** `CanvasAiBar.tsx` 中 `stage` 的显示应基于真实传递值，不再硬编码降级。

**归属版本：** v2.0-H

---

#### P0-2: 改进 AI 三态选择器 UX

**方案：** 让三态选择器更可视化、更容易理解。建议改为：

1. **场景引导替代术语：** 不使用"讨论/建议/写入预览"，改为三段式模式切换：
   - "聊一聊"（= discuss）—— 图标：💬，说明：和 AI 聊聊想法，不影响画板
   - "给建议"（= suggest）—— 图标：💡，说明：让 AI 提供创作建议，采纳才写入
   - "帮我写"（= write_preview）—— 图标：✍️，说明：让 AI 直接填写内容，确认才生效

2. **发送按钮显示当前模式：** 发送按钮颜色/文字随 mode 变化，如 discuss 模式按钮显示"发送讨论"、suggest 显示"生成建议"、write_preview 显示"生成预览"。提供更强的反馈。

3. **快捷键不冲突：** outputType 切换不受 Enter 发送干扰。

**以上需要原型验证。** 三态交互是织梦机 AI 交互的核心入口，建议做 **Mode A 逻辑原型**（终端交互验证状态流 + 用户决策路径），确认后再做 UI 细化。

**归属版本：** v2.0-H

---

#### P0-3: TextCanvas 空状态添加可点击导航

**方案：** 将 `TextCanvas.tsx` 中的 `<span>→ 前往画板④</span>` 替换为可点击的 `<Button>`，点击时触发画板切换：

```tsx
<Button variant="secondary" onClick={() => onNavigateStage('packet')}>
  → 前往画板④ 排期细纲
</Button>
```

**需要新增 prop：** `onNavigateStage: (stage: string) => void`，或复用现有的 `handleStageChange`。

**归属版本：** v2.0-H

---

### P1: 建议在 v2.0.1 或 v2.0.2 解决

#### P1-1: 统一 AI 配置状态管理

**方案：** 在 v2.0.2 中将 AI 配置检测抽象为全局 Context/Provider。

```tsx
// ai-context-provider.tsx
<AiContextProvider>
  {/* AI 状态全局可用，无需各组件重复检测 */}
</AiContextProvider>
```

各组件通过 hook 获取 AI 状态：

```tsx
const { aiStatus, aiConfigured, activeModel } = useAiContext();
```

**归属版本：** v2.0.2（AI Capability Foundation）

---

#### P1-2: 画板确认后添加下一步引导

**方案：** 在每个画板确认成功后，显示明确的"下一步"引导，而非仅 Toast 提示：

1. PremiseEntryGate: 确认后显示一个大按钮 "前往大纲画板"，而非静态文字
2. StructureFlowView: 确认后 Toast + 闪烁"设定"画板导航按钮 2 秒
3. SettingCanvasV2: 确认后弹窗/引导 "前往细纲画板生成章节包"
4. ChapterPacketCanvas: 确认后显示 "前往正文画板开始写作" 按钮

**设计原则：** 每个确认动作后，只有 1 个明确的下一步按钮，不提供多余选项。

**归属版本：** v2.0.1

---

#### P1-3: 改进 AiSuggestionCard 定位

**方案：** 建议卡不应使用固定定位在 AI bar 上方。改为：

1. **侧边栏模式：** 建议卡收集在右侧滑出的面板中（类似 ChatDrawer），用户集中处理所有建议
2. **或内联模式：** 建议卡嵌入到当前画板的上下文区域（如前提卡的 premise text 下方显示 AI 建议），与画板内容绑定

**归属版本：** v2.0.1（与 UX 验证同步）

---

#### P1-4: 速写入口架构设计（v2.0.1 前置条件）

**问题：** 当前 App.tsx 架构（管线模式 vs legacy 模式）没有"速写模式"的插槽。

**方案：** 设计"速写模式"作为管线模式的一个特殊入口：

```
入口：（书架 / 新项目创建后）
  │
  ├──→ 速写模式（QuickDraft）—— 跳过管线，直接生成正文
  │        │
  │        └──→ "转入正式管线" → 填充 PremiseCard + Structure + Setting + Packet
  │
  └──→ 标准管线模式（Premise → Structure → Setting → Packet → Text）
```

**架构变化：** `currentStage` 需要支持一个特殊值（如 `'quickdraft'`），触发速写 UI。速写 UI 不是某个画板的变体，而是独立的全屏写作模式。

**需要原型验证。** 速写入口到正式管线的转换是复杂的状态迁移，建议做 **Mode A 逻辑原型** 验证数据流完整性。

**归属版本：** v2.0.1

---

### P2: 建议在 v2.1.0 考虑

#### P2-1: 方法论隐性展开策略

**原则：** v2.1.0 新增 4 件套方法论骨架时，必须确保用户不感知方法论术语。

**具体建议：**

| 方法论元素 | 用户看到的问题/标签 | 不得出现的术语 |
|-----------|-------------------|--------------|
| 画板① 五步 | "你的故事是关于什么的？"、"发生了什么变化？"、"读者会在意吗？" | 愿望清单、定内外、前提句变体 |
| 画板② L1-L4 | 作品 → 阶段 → 章节位置 → 具体章节 | 八字六变、十二时位 |
| 画板③ 麻雀模式 | "这个世界有什么特殊规则？"、"谁在推动故事？"、"最大的威胁是什么？" | 天/地/人、麻雀模式 |
| 画板④ 三档细度 | "快速梳理 / 标准推进 / 精细打磨" | 速写模式/标准模式/精编模式（作为 UI 名称可以，但不在帮助文案中说明方法论） |

**实现建议：** 每个方法论步骤在代码中有对应的 `methodologyKey`，但 UI 层只展示 `displayLabel`，两者通过注册表映射：

```tsx
// skill-registry.ts (v2.0.2)
{
  key: 'premise.wishlist',
  displayLabel: '你的故事在讲什么？',
  methodologyTerm: '愿望清单', // 仅用于内部调试/日志
  promptTemplate: '...',
}
```

**归属版本：** v2.1.0

---

#### P2-2: 旧版 Legacy 组件退役计划

**方案：** 制定分阶段退役计划：

| 版本 | 退役内容 | 替代方案 |
|------|---------|---------|
| v2.1.0 | setting-collection legacy | SettingCanvasV2 已成熟，旧版 SettingCollection 可以退役 |
| v2.1.1 AI 三态成熟后 | ai-chat legacy | CanvasAiBar + ChatDrawer 已覆盖 AI 聊天能力 |
| v2.2+ | canvas legacy | 管线模式已覆盖全部画板能力 |

**归属版本：** v2.1.0 (启动) / v2.2 (完成)

---

## 3. 需要原型验证的交互

### 3.1 AI 三态选择器（P0-2）

**问题：** 当前的三态小按钮模式可能不是最优的 AI 交互入口。

**原型方案：** Mode A 逻辑原型，验证三态状态流的清晰度：

- 用户能否在发送前正确理解三种模式的差异？
- 发送后 UI 反馈是否让用户确认当前模式？
- 在 discuss 模式下聊天后切换到 suggest 模式，用户的认知是否连续？

**推荐工具：** Mode A 终端交互原型，模拟三态的状态机 + 用户决策路径。

**符合什么：** PASS = 用户在 3 次尝试内能正确区分三种模式并选择适合当前场景的模式。

---

### 3.2 速写入口数据流（P1-4）

**问题：** 速写入口 → QuickDraft → 正式管线的转换涉及复杂的状态迁移。

**原型方案：** Mode A 逻辑原型，验证：

- QuickDraft 数据模型与正式管线数据模型的映射完整性
- "一键转入正式管线"后，用户已修改的内容不丢失
- 转入后各画板的预填充状态（全部 auto_inferred 标记）

**推荐工具：** Mode A 终端交互原型，模拟 QuickDraft 创建 → 修改 → 转入正式管线的完整数据流。

**符合什么：** PASS = 速写生成的段落数据可以无损转换为正式管线的 PremiseCard + Structure + ChapterPacket + Text。

---

### 3.3 方法论文本的自然语言化（P2-1）

**问题：** v2.1.0 增加的 4 件套方法论骨架需要验证自然语言交互是否真的比字段表单更友好。

**原型方案：** Mode A 逻辑原型 + 问答题交互原型：

- PremiseCard v2 五步：每一步显示为自然语言问题而非填空字段
- 用户回答问题的流畅度 vs 填写表单的流畅度对比
- AI 预填答案后再让用户确认 vs 让用户先输入再 AI 优化的对比

**推荐工具：** Mode A 终端原型，模拟问答式交互流。

**符合什么：** PASS = 用户在不接触方法论术语的情况下，5 分钟内完成 PremiseCard v2 所有步骤且有"我在创作"而非"我在填表"的反馈。

---

## 4. 分类汇总表

| # | 问题 | 严重度 | 优先级 | 归属版本 | 需要原型 |
|---|------|--------|--------|---------|---------|
| C-01 | 管线/遗留双模式不透明 | Critical | P0 | v2.0-H | - |
| C-02 | CanvasAiBar 上下文错位 | Critical | P0 | v2.0-H | - |
| C-03 | AI 三态标签偏内部术语 | Critical | P0 | v2.0-H | ✅ |
| M-01 | 画板确认后缺乏引导 | Major | P1 | v2.0.1 | - |
| M-02 | AiSuggestionCard 定位冲突 | Major | P1 | v2.0.1 | - |
| M-03 | AI 配置检测重复 | Major | P1 | v2.0.2 | - |
| M-04 | TextCanvas 空状态不可点击 | Major | P0 | v2.0-H | - |
| M-05 | Legacy 组件增长问题 | Major | P2 | v2.1.0 | - |
| m-01 | PipelineNav 标题截断 | Minor | P3 | later | - |
| m-02 | AI bar 无全局上下文 | Minor | P2 | v2.0.1 | - |
| m-03 | 预览弹窗不可编辑 | Minor | P2 | v2.0.1 | - |
| - | 速写入口架构 | - | P1 | v2.0.1 | ✅ |
| - | 方法论隐性展开 | - | P2 | v2.1.0 | ✅ |

---

## 5. 审查视角：五维度总结

### 5.1 信息架构

**当前状态：**
- PipelineNav 视觉清晰，五画板的状态（locked/ready/active/done）通过颜色和徽章表达，易于理解
- 但双模式（管线 vs 旧版导航）的存在削弱了架构的清晰度——用户不知该用哪个

**核心问题：** 没有明确的"模式声明"。用户打开项目时看到 PipelineNav 但大部分按钮 locked，旧版导航标签在左侧可见——这是 v2 过渡期的阵痛，但需要在 v2.0-H 解决入口引导。

### 5.2 交互流程

**当前状态：**
- 画板间依赖关系清晰（前提→结构→设定→细纲→正文），强制顺序合理
- 确认→下一步的引导偏弱，依赖用户主动导航
- AI 三态路由的数据流设计（D 轮验收 8 项）坚固且清晰

**核心问题：** 确认后引导不足 + AI 三态模式选择不直观。

### 5.3 空状态 / 错误状态 / 边界状态

**当前状态：** 整体良好。
- ChapterPacketCanvas 的空状态设计（显示上游数据摘要 + 缺失字段引导）是亮点，建议作为模式推广到其他画板
- AI 未配置时的降级提示和禁用状态处理得当
- TextCanvas 空状态有引导但不可点击（M-04）

**改进方向：** 统一空状态展示风格 + 让引导可交互。

### 5.4 v2.0.1 一键速写入口

**当前状态：** 尚未实现。当前所有入口都走标准管线。

**架构评估：** 当前 App.tsx 的管线状态管理（`currentStage` 枚举 `premise/structure/setting/packet/text`）没有为速写模式留出插槽。

**架构建议：**
- 新增 `currentStage === 'quickdraft'` 状态，触发独立于五画板的速写 UI
- 速写模式完成后，用户可选择"转入正式管线"，触发 QuickDraft → 正式数据结构转换
- 转换过程应实现为全自动（用户只点一个按钮），后端完成映射

### 5.5 v2.1.0 方法论密度

**当前状态：** 方法论的自然语言化已在不经意间做了铺垫（PremiseEntryGate 的"好前提的公式"、StructureFlowView 的"作品/阶段/章节卡/章节"标签、ChapterPacketCanvas 的"写作契约/活跃设定/剧情压缩/执行层"）。

**风险评估：** 4 件套方法论骨架（PremsieCard v2 + Structure L1-L4 + Sparrow 9+3 + Three Detail Modes）同时落地，可能让单画板的编辑字段数量翻倍。

**缓解策略：**
- 默认折叠/审核模式：新字段默认收起，用户按需展开（ChapterPacketCanvas 的审核模式是优秀先例）
- AI 预填：方法论步骤默认由 AI 根据上游数据填充，用户只需确认而非填写
- 渐进展开：每个方法论步骤标记 `auto_filled`，用户可在步骤级别确认/修改/跳过

---

## 6. Open Questions for Chancellor

| # | 问题 | 背景 |
|---|------|------|
| 1 | Legacy 组件的退役时间线是否由产品团队定义？ | M-05 指出的 legacy 组件增长问题需要明确的退役计划。如果没有退役计划，legacy 入口会持续增长。 |
| 2 | v2.0.1 速写入口是否应该作为独立模式（脱离管线状态管理）还是一个"预填充管线"的快捷方式？ | 这决定架构设计：如果速写是独立模式，需要新增 `currentStage` 枚举值；如果是预填充管线，则重用现有状态机但支持"跳过"。 |
| 3 | 三态 AI 输出标签是否需要经过 Usability Probe 验证？ | 如果 v2.0-H 上线时三态标签已经重构，建议在 v2.0.1 的 Usability Probe 中专门测试用户对三种模式的理解度。 |

---

## 7. Handoff Notes

### 给 scope-guardian

- 本审查的 P0 项（C-01, C-02, C-03, M-04）应当进入 v2.0-H 范围。这些是可在 Scope Freeze 范围内修复的 UI 问题，不影响合同核心字段或 DB 结构。
- 需要验证：CanvasAiBar 仅渲染于 `currentStage` 存在的条件是否不破坏任何已定义功能。

### 给 verification-lead

- C-03（AI 三态标签）修改后，验收表中的"手动验收路径"步骤 3-9 的 UI 断言需要更新，匹配新的标签文案。
- M-04（TextCanvas 空状态按钮）需要新增验收项：点击"前往细纲画板"按钮后，导航正确跳转到画板④。

### 给 architect

- P1-1（统一 AI 状态管理）需要在 v2.0.2 的 AI Context Builder 中预留架构插槽。
- P1-4（速写入口架构）需要架构评估：QuickDraft 数据结构是否需要在 SQLite 中新增表，还是使用标记字段（`type='quickdraft'`）复用现有表。

### 给 design-lead

- P0-2（AI 三态选择器）需要原型验证后，再进行视觉设计。
- P2-1（方法论自然语言化）需要在视觉设计阶段验证：自然语言问题在 UI 中的空间占比是否合理。
- 建议在视觉阶段统一所有画板的空状态风格（参考 ChapterPacketCanvas）。

### 给 budget-governor

- 本审查建议的 P0 项均为 UI/UX 调整，无架构重构，预算影响小。
- v2.0.1 的速写入口架构方案评估需要确认：QuickDraft 数据映射为正式数据的工作量（预计 1-2 个战役）。
