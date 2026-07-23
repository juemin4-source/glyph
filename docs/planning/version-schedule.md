# 织梦机 版本排期表

> **编制**: product-manager | **日期**: 2026-07-08
> **来源**: master-prototype-map.md, product-spec-v1.2.md, implementation-roadmap.md, product-think-v1.3.md
> **北极星**: v2.0 — AI 原生的世界构建与叙事引擎

---

## 版本路线总览

| 版本 | 标题 | 核心屏数 | 前置依赖 | 周期 |
|------|------|---------|---------|------|
| v1.2 | 存储安全 + 核心体验加固 | ~23 项改进 | v0.2 已有 35 屏 | 已完成 |
| v1.3 | AI 对话 + BYOK 接入 | ~11 屏 | FreeLLM API 就绪, v1.2 同步队列 | 2 周 |
| v1.4 | Agent + Skill 架构 | ~10 屏 | v1.3 BYOK 层 | 4 周 |
| v1.5 | AI 原生编辑器 | ~8 屏 | v1.4 Agent 层 | 2 周 |
| v1.6 | 画板 AI 化 | ~12 屏 | v1.3 + v1.4 | 2 周 |
| v1.7 | AI 深度 | ~8 屏 | v1.5 | 2 周 |
| v1.8 | Web 版 | ~6 屏 | v1.6 | 2 周 |
| v1.9 | 发布候选 | ~5 屏 | v1.8 | 2 周 |
| v2.0 | 北极星 | ~8 屏 | v1.9 | 2 周 |

**总计**: ~20 周（5 个月）从 v1.3 启动到 v2.0 发布。

### 依赖关系

```
v1.2──→v1.3──→v1.4──→v1.5──→v1.6──→v1.7──→v1.8──→v1.9──→v2.0
        ↑        ↑       │       │
        │        │       └──→v1.6 画板 AI 依赖 Agent 架构
        │        │
        │        └──→v1.5 AI 编辑器依赖 Agent+Skill 就绪
        │
        └──→v1.4 Agent 架构依赖 BYOK 就绪
```

---

## 各版本详情

---

### v1.3 — AI 对话 + BYOK 接入

**核心目标**: 用户可在织梦机内完成 AI 对话、管理 API Key、在对话流中编辑和收录 AI 生成的内容，实现"对话即编辑"的闭环。

**Master Prototype 屏号**:

| Screen ID | 名称 | 说明 | 优先级 |
|-----------|------|------|--------|
| 53 | ai-chat | AI 全页对话 — 侧栏大纲 + 对话流 + 输入栏 + 文档卡片 | P0 |
| 54 | ai-chat-header | 聊天头 — 标题、模型指示器、聚焦标记、新建/模型按钮 | P0 |
| 55 | ai-doc-card | 文档卡片 — 类型标记、标题、正文、分区、编辑/保存/展开按钮 | P0 |
| 56 | ai-doc-card-edit | 内联卡片编辑 — 可编辑标题/正文/分区，保存/取消 | P0 |
| 57 | ai-input-bar | 输入栏 — 自动伸缩文本框、发送按钮 | P0 |
| 58 | ai-focus | 聚焦指示器 — 头部标记显示当前聚焦的大纲对象 | P0 |
| 60 | ai-sidebar-model | 侧栏模型选择器 — 当前活跃模型名称，可点击进入设置 | P0 |
| 61 | ai-bottom-bar | AI 底部栏 — 连接状态、token 用量、用量条 | P0 |
| 63 | settings-shell | 设置面板 — 左侧导航：API Keys, Usage, Appearance, Storage, Notifications, About | P0 |
| 64 | settings-api-keys | API Key 管理 — 每 Provider 卡片：OpenAI, Anthropic, Local, 含 Key/Endpoint/Timeout/Test | P0 |
| 65 | settings-models | 模型选择器 — 单选列表含定价、每日 token 条、用量概览 | P0 |

**关键新增功能**:
- BYOK 加密存储（Rust: aes-gcm + keyring），JS 层不接触原始 Key
- 多 Provider 支持（OpenAI + Anthropic + 本地模型）
- 文档卡片内联编辑（标题、正文、分区），编辑即同步写入项目数据库
- 大纲-对话单向联动：点击大纲对象 → AI 上下文 focus；AI 创建对象 → 大纲实时更新
- 基础上下文加载（Level 1+2）：项目名称、类型、高正典设定注入对话 prompt
- 对话历史管理（按项目分组，AI 自动生成标题）
- 收录为设定：文档卡片一键保存为 world_object
- 连接测试 + 用量监控（实时 token 计数 + 用量进度条）

**前置条件**:
- v1.2 同步队列（P0-01）已就绪，卡片写入走同步队列
- API 调用可靠性（重试 + 指数退避）已就绪
- FreeLLM API 或各 Provider API 可用

**不确定项**:
- 卡片编辑"保存"的语义（本地优先 vs 数据库优先，见 product-think Q1）
- 内联编辑深度边界（哪些字段可编辑、哪些不可，见 product-think Q2）
- 会话管理引入时机（基础版 vs 完整版，见 product-think Q5）

**不做的**:
- Agent 编排（v1.4）
- 编辑器内嵌 AI（v1.5）
- 风格画像自动学习（v1.4）
- Skill 系统（v1.4）
- 画板 AI 化（v1.6）

---

### v1.4 — Agent + Skill 架构

**核心目标**: 建立 Agent 框架 + Skill 执行引擎，实现"AI 可诊断你的故事"的能力。首批 10 个文学诊断 Skill 上线，Agent 控制台可用。

**Master Prototype 屏号**:

| Screen ID | 名称 | 说明 | 优先级 |
|-----------|------|------|--------|
| 70 | ai-agent-tab | Agent 控制中心 — Agent 卡片 + 任务队列 + 运行/停止 | P0 |
| 71 | agent-card | Agent 卡片 — 图标、名称、状态、进度、步骤描述 | P0 |
| 72 | task-queue | 任务队列 — 可拖拽的待办/运行中/已完成任务 | P0 |
| 73 | skill-marketplace | Skill 市场 — 可安装的 Skill 浮层 | P0 |
| 74 | agent-collab | 协作编辑器 — 实时 AI 写作，不同颜色光标 | P1 |
| 75 | change-history | 变更历史 — AI 修改时间线，逐条接受/拒绝 | P1 |
| 76 | collaborator-list | 协作者列表 — 侧栏列出活跃 Agent 和用户 | P1 |
| 77 | ai-suggestions | AI 建议面板 — 自动布局建议、一致性检查、一键修复 | P2 |
| 78 | consistency-report | 一致性扫描报告 — 按严重程度分级，跳转到问题位置 | P2 |
| 79 | ai-layout-recommend | AI 布局推荐 — 2-3 种方案，预览后应用 | P2 |

**关键新增功能**:
- Skill Registry（从 JSON Schema 加载）+ Skill Executor（组装 prompt → 调用 BYOK → 解析输出）
- Skill Chain Engine（拓扑排序 + 并行执行）
- Agent Router（状态机路由器）+ Agent Config（Agent 定义 + Skill 映射）
- Orchestrator 路由逻辑 + 三路深度控制（快速 / 均衡 / 深度）
- 风格画像（style_profile）表 + 基础方法
- 首批 10 个文学诊断 Skill JSON（CS-01 至 CS-12，不含 CS-08/09）
- Agent 控制台 UI + 实时进度显示

**前置条件**:
- v1.3 BYOK 层就绪（Skill Executor 需要调用 LLM）
- v1.3 对话历史持久化完成
- 首批 10 个 Skill 的文学诊断理论验证通过

**不确定项**:
- LLM 输出的结构化可靠性（Schema 校验 + 重试策略）
- Chain Engine 在复杂依赖下的执行效率
- 深度控制的 token 预算是否在预期范围内

**不做的**:
- 编辑器内联 AI 触发点（v1.5）
- 画板自动布局 AI（v1.6）
- 动态 Skill 推荐（v1.7）

---

### v1.5 — AI 原生编辑器

**核心目标**: AI Agent 能"看到"你的写作，可以实时协作编辑，用户可追溯和审查每条 AI 修改。

**Master Prototype 屏号**:

| Screen ID | 名称 | 说明 | 优先级 |
|-----------|------|------|--------|
| 17 | editor-source | 源码模式 — 增强 AI 协作图层 | P0 |
| 18 | editor-preview | 预览模式 — 增强 AI 协作图层 | P0 |
| 19 | editor-wysiwyg | WYSIWYG 模式 — AI 光标渲染 + 协作编辑 | P0 |
| 20 | editor-toolbar | 统一工具栏 — 新增 AI 协作按钮组 | P0 |
| — | *collaborative-editor* | 协作编辑器组件 — 包装 TipTap，增加 AI 协作图层（新屏） | P0 |
| — | *change-history-panel* | 变更历史面板 — 按时间线显示 AI 修改，接受/拒绝（新屏） | P0 |
| — | *ai-editor-sidebar* | AI 编辑器侧栏 — 建议、一致性提示、@AI 入口（新屏） | P1 |
| 22 | editor-empty | 空对象 — AI 建议启动模板 | P1 |

**关键新增功能**:
- CollaborativeEditor 组件：包装 TipTap，多色 AI 光标渲染，AI "正在输入"指示器
- ChangeHistory 面板：按时间线展示所有 AI 修改，逐条接受/拒绝，一键暂停 AI 协作
- AI 写作触发点预埋：选中文本浮动工具栏（改写/扩写/缩写骨架）
- 第二批 10 个 Skill JSON（CS-13 至 CS-31，不含 CS-24/CS-08/CS-09）
- Agent 输出直接写入 TipTap 编辑器的管道

**前置条件**:
- v1.4 Agent 层 + Skill Executor 就绪
- TipTap 插件架构验证通过
- Agent 输出格式规范化完成

**不确定项**:
- Agent 输出流模式（批处理 vs stream）的选择对体验的影响
- 协作编辑时用户操作与 AI 写入的冲突处理
- AI 光标性能（每帧重绘成本）

**不做的**:
- 画板 AI 化（v1.6）
- 编辑器内 `@AI` 实时对话（v1.5 中期引入，非 P0）

---

### v1.6 — 画板 AI 化

**核心目标**: 所有画板视图获得 AI 增强能力——自动布局推荐、一致性扫描、智能分组建议。

**Master Prototype 屏号**:

| Screen ID | 名称 | 说明 | 优先级 |
|-----------|------|------|--------|
| 34 | canvas-relation | 关系图 — AI 推荐布局 + 一致性检查 | P0 |
| 35 | canvas-timeline | 时间线 — AI 识别时间矛盾 | P0 |
| 36 | canvas-deduction | 推演图 — AI 辅助分区流转建议 | P0 |
| 37 | canvas-tool-panel | 工具面板 — AI 按钮组 | P0 |
| 38 | canvas-zoom | 缩放控制 — 不变 | P0 |
| 39 | canvas-pool | 对象池 — AI 推荐可添加对象 | P1 |
| 40 | canvas-marquee | 框选 — AI 批量操作建议 | P1 |
| 41 | canvas-layout-lock | 布局锁定 — 不变 | P0 |
| 42 | canvas-connect | 连线 — AI 推荐连接 | P1 |
| 43 | canvas-sticky | 便签 — AI 生成的便签 | P2 |
| 44 | canvas-timeline-unsorted | 未排期事件 — AI 推荐时间位置 | P1 |
| 45 | canvas-hint | 画板提示 — 不变 | P0 |

**关键新增功能**:
- AISuggestPanel 组件：左侧栏显示当前 Tab 相关的 AI 建议
- Auto Layout Engine：基于 ReactFlow 布局算法，AI 推荐 2-3 种布局方案
- Consistency Scanner：调用 Inspector/Reader Skill 检查设定一致性，结果按 P0/P1/P2 分级
- 设定集 AI 增强：自动标签建议、缺失关系检测
- 第三批 10 个 Skill JSON（CS-08, CS-09, CS-16, CS-17, CS-18, CS-32 至 CS-36）

**前置条件**:
- v1.4 Agent 层 + Skill Chain Engine 就绪
- v1.5 协作编辑机制稳定
- 一致性检查 Skill 逻辑完成验证

**不确定项**:
- 自动布局算法在复杂图中的质量（力导向 + AI 方案）
- 一致性扫描的误报率控制
- 画板性能（大量节点 + AI 计算叠加）

**不做的**:
- 仪表盘（v1.7）
- 风格识别（v1.7）
- Web 版（v1.8）

---

### v1.7 — AI 深度

**核心目标**: 织梦机开始"懂你"——自动识别写作风格、动态推荐 Skill、为项目提供 AI 仪表盘。

**Master Prototype 屏号**:

| Screen ID | 名称 | 说明 | 优先级 |
|-----------|------|------|--------|
| 80 | dashboard | 仪表盘 — 对象趋势、AI 时长、一致性评分、Skill 活跃度 | P0 |
| 81 | style-recognition | 风格识别 — 检测到的风格 + 匹配百分比 | P0 |
| 82 | skill-recommend | 动态 Skill 推荐 — 按项目特征的智能建议 | P0 |
| — | *style-profile-detail* | 风格画像详情页 — 展示风格维度和变化趋势（新屏） | P1 |
| — | *ai-insights-panel* | AI 洞察面板 — 项目级深层分析（新屏） | P1 |
| 46 | setting-collection | 设定集 — 新增 AI 管理能力 | P1 |
| 48 | judgment-records | 判断记录 — AI 辅助审计 | P2 |
| 49 | canon-handbook | 正典手册 — AI 增强参考 | P2 |

**关键新增功能**:
- StyleProfileUpdater：增量更新 + AI 自动分析风格画像
- DynamicSkillRouter：根据项目特征（类型、字数、正典分布）推荐 Skill
- 项目仪表盘：对象创建/修改趋势、AI 协作时长、一致性得分、Skill 调用统计
- 第四批 10 个 Skill JSON（CS-19 至 CS-24, CS-37 至 CS-40），全部 40 个 Skill 完成
- 风格识别自动运行 + 匹配度展示

**前置条件**:
- v1.4 Skill 体系完整就绪
- v1.5 + v1.6 的 AI 功能集成稳定
- 风格画像 Schema 验证完成
- 全部 40 个 Skill 的理论基础验证通过

**不确定项**:
- 风格识别在短内容（<5000 字）下的可靠性
- 动态 Skill 推荐的准确率
- 仪表盘性能（跨对象统计的计算成本）

**不做的**:
- Web 版（v1.8）
- PWA / 跨平台

---

### v1.8 — Web 版

**核心目标**: 织梦机可在浏览器中运行，桌面端和 Web 端共享核心功能，PWA 支持离线使用。

**Master Prototype 屏号**:

| Screen ID | 名称 | 说明 | 优先级 |
|-----------|------|------|--------|
| 83 | platform-switcher | 平台指示器 — Desktop/Web 标记, 响应式断点 | P0 |
| 84 | pwa-install | PWA 安装提示 — Install App 引导 | P0 |
| 85 | cloud-sync | 云同步设置 — 同步开关, 冲突策略 | P0 |
| 86 | share-button | 分享按钮 — 只读项目分享链接 | P1 |
| — | *responsive-shell* | 响应式适配 — 桌面/平板/手机三端布局（新屏，适配层） | P0 |
| — | *web-byok-adapter* | Web BYOK 适配 — Web Crypto API / 代理服务器（新屏，技术层） | P0 |

**关键新增功能**:
- 平台切换指示器 + 响应式断点（桌面/平板/手机）
- PWA 支持（manifest.json + service worker）
- 云端同步（同步开关 + 冲突策略 UI）
- 分享功能（只读项目链接）
- 离线/在线状态指示器

**前置条件**:
- v1.6 功能全部稳定
- BYOK Web 端架构决策（Web Crypto API / 代理服务器 / WASM）
- Tauri v2 跨平台构建验证

**不确定项**:
- Web 版 BYOK 无法复用 Rust 后端——代替方案待 v1.7 结束时决策
- Web 版画板性能（ReactFlow 在浏览器中的表现）
- PWA 离线缓存策略对数据一致性的影响

**不做的**:
- 原生移动 App（仍在 Tauri 桌面 + PWA 范围内）
- 完整云服务（v2.0+ 考虑）

---

### v1.9 — 发布候选

**核心目标**: 稳定性和质量冲刺——修复已知 Bug、内测验收、性能优化，为 v2.0 发布做准备。

**Master Prototype 屏号**:

| Screen ID | 名称 | 说明 | 优先级 |
|-----------|------|------|--------|
| 87 | feedback | 反馈按钮 — Bug 报告 + 截图 | P0 |
| 88 | beta-badge | Beta/RC 标记 — 版本显示 | P0 |
| 89 | skeleton | 骨架屏 — 内容占位符加载 | P0 |
| 90 | crash-recovery | 崩溃恢复 — 异常退出检测 + Session 恢复 | P0 |
| — | *performance-monitor* | 性能监控 — 页面加载时间、内存、渲染帧率（新屏） | P1 |

**关键新增功能**:
- 内测反馈系统（Bug 报告 + 截图上传）
- 骨架屏加载（所有主要页面）
- 崩溃恢复流程（异常退出检测 → Session 恢复 → 提示用户）
- 40 个 Skill 全面冒烟测试
- 5 个 Agent 集成测试（Architect / Writer / Reader / Inspector / Editor）
- 三路深度模式 E2E 测试
- BYOK 所有 Provider 兼容性测试
- 性能监控 + 内存泄露检查

**前置条件**:
- v1.8 Web 版基本可用
- 全部 40 个 Skill 完成
- 测试基础设施就绪

**不确定项**:
- 测试覆盖率的充分性判断标准
- 崩溃恢复的核心路径验证
- 性能调优的剩余工作评估

**不做的**:
- 新功能开发（严格冻结）
- v2.0 北极星功能

---

### v2.0 — 北极星

**核心目标**: 织梦机 v2.0 正式发布——AI 原生的世界构建与叙事引擎。从"工具"进化为"创作伙伴"。

**Master Prototype 屏号**:

| Screen ID | 名称 | 说明 | 优先级 |
|-----------|------|------|--------|
| 15 | workspace-mode-toggle | 模式切换 — 创作 / 审阅 / 协作模式 | P0 |
| 16 | quick-action-panel | 快捷操作 (Ctrl+K) — 命令面板：搜索、最近、运行 Agent、优化、仪表盘 | P0 |
| 25 | outline-smart-group | 智能分组 — 按类型自动分组 + 计数标记 | P0 |
| 26 | outline-recent | 最近项目 — 近期访问的对象列表 | P0 |
| 91 | publish | 发布面板 — QA 检查清单 + 导出/发布 | P0 |
| 92 | version-footprint | 版本足迹 — v1.1 到 v2.0 的版本时间线 | P1 |
| 93 | knowledge-base | 知识库链接 — 已索引对象计数 | P1 |
| — | *agent-pipeline-e2e* | Agent 全链路验证 — 端到端功能确认（新屏/测试） | P0 |

**关键新增功能**:
- 工作区模式切换（创作/审阅/协作），每种模式定制化工具集
- Ctrl+K 全局命令面板（搜索 + 最近对象 + 运行 Agent + 优化建议 + 仪表盘入口）
- 大纲树智能分组 + 最近项目快速入口
- 发布面板（QA 检查清单 + 导出格式选择 + 一键发布）
- 版本足迹可视化（从 v1.1 到 v2.0 的完整演进）
- 知识库入口（已索引对象的跨项目查看）
- 全部集成测试 + 跨平台测试（Windows / macOS）
- 正式文档完善

**前置条件**:
- v1.9 QA 全面通过，无 P0/P1 缺陷
- 所有 v1.3-v1.9 功能稳定集成
- 跨平台构建测试完成

**不确定项**:
- 发布流程的自动化程度（App Store / 分发渠道）
- 定价策略（买断 / 订阅 / 免费+高级功能）
- 首次用户从 v1.0 升级到 v2.0 的迁移体验

**不做的**:
- 多人实时协作（v2.1+）
- 模板市场 / 社区平台（v2.1+）
- 插件 / 扩展系统（v2.1+）

---

## 每轮必须包含的角色节点

每个版本冲刺必须包含以下角色的完整参与：

| 节点 | 角色 | 产出 | 说明 |
|------|------|------|------|
| 产品定义 | product-definer | product-spec.md | 本版本范围、用户故事、验收标准 |
| 设计/视觉 | design-painter | visual-spec.md | UI 设计、交互流程、视觉规范 |
| 前端实现 | worker-fe | 前端代码 | React/TypeScript 组件实现 |
| 后端实现 | worker-be | 后端代码 | Rust/Tauri/SQLite 后端实现 |
| 代码审查 | craft-reviewer | review-report.md | 架构合规、代码质量审查 |
| QA 验收 | verification-lead | qa-report.md | 测试用例覆盖、验收验证 |
| 交付 | delivery-manager | delivery-report.md | 交付检查清单、Owner 验收 |

### 例外说明

- **纯 UI 版本**（如 v1.5 编辑器、v1.6 画板）：worker-be 工作量轻，审查可侧重前端
- **纯后端版本**（如 v1.4 Agent 架构）：worker-fe 主要做控制台 UI，后端为主导
- **v1.9 RC**: 弱化新功能产品定义，强化 QA + 交付

---

## 屏幕交付分布汇总

| 版本 | Phase 来源 | 实施中 | 原型已有 | 新增设计 | 合计 |
|------|-----------|--------|---------|---------|------|
| v1.3 | Phase 11+12 | 0 | 11 | 0 | ~11 |
| v1.4 | Phase 13 | 0 | 0 | 10 | ~10 |
| v1.5 | Phase 5 增强 + 新组件 | 6 | 0 | 2 | ~8 |
| v1.6 | Phase 8 | 12 | 0 | 0 | ~12 |
| v1.7 | Phase 14 + 新组件 | 3 | 0 | 5 | ~8 |
| v1.8 | Phase 15 + 适配层 | 4 | 0 | 2 | ~6 |
| v1.9 | Phase 16 | 4 | 0 | 1 | ~5 |
| v2.0 | Phase 4 + 6 + 17 | 7 | 0 | 1 | ~8 |
| **总计** | | **36** | **11** | **21** | **~68** |

**当前状态**: v0.2 已有 35 屏 Implemented，v1.2/v1.3 已有 24 屏 Prototyped，v1.4-v2.0 尚有 37 屏 Roadmap。

---

## 关键里程碑

| 里程碑 | 预计时间 | 交付物 | 验收标准 |
|--------|---------|--------|---------|
| AI 对话可用 | v1.3 结束 | AI 全页对话 + Key 管理 | 用户可添加 Key、发起对话、编辑并收录卡片 |
| Agent 框架就绪 | v1.4 结束 | Agent 控制台 + 首批 10 Skill | 状态机正确转换，Skill 返回结构化结果 |
| AI 协作写作 | v1.5 结束 | 协作编辑器 + 变更历史 | Agent 输出写入编辑器，可逐条接受/拒绝 |
| 画板 AI 化 | v1.6 结束 | 一致性扫描 + AI 布局 | 扫描结果分级展示，一键跳转修复 |
| 风格识别上线 | v1.7 结束 | 仪表盘 + 风格画像 | 自动识别风格并动态推荐 Skill |
| Web 版可用 | v1.8 结束 | PWA + 平台切换 | 浏览器中核心功能可用 |
| RC 发布 | v1.9 结束 | 内测完成 | 无 P0/P1 缺陷，性能达标 |
| v2.0 正式版 | v2.0 结束 | 全功能发布 | Agent 全链路通过，跨平台验证完成 |

---

## 风险评估

| 风险 | 影响版本 | 概率 | 影响 | 缓解方案 |
|------|---------|------|------|---------|
| Rust 编译慢影响迭代速度 | v1.3 | 高 | 中 | BYOK 层独立 Rust test，减少 Tauri 全量编译 |
| LLM 输出非结构化 | v1.4 | 中 | 高 | 所有 Skill 要求 JSON 输出，Executor 层做 Schema 校验 + 重试 |
| Web 版 BYOK 无法复用 Rust | v1.8 | 中 | 高 | v1.7 结束时决策：WASM 加密 / 代理服务器 / Web Crypto API |
| 40 个 Skill 维护成本 | v1.4-v1.7 | 中 | 中 | JSON Schema 校验 + 自动化测试 + 4 批创建 |
| 画板 + AI 叠加性能 | v1.6 | 中 | 中 | Canvas 节点虚拟化，AI 计算异步执行 |
| 范围蔓延 | 全部 | 高 | 高 | 严格按版本切割，每版本 2 周交付可验证增量 |

---

## ABORT 条件

1. **BYOK 模式无法吸引用户** — 目标用户不愿意配置自己的 API Key
   - 转向内置模型（成本转嫁到项目方）

2. **LLM 文学诊断质量低于预期** — 40 个 Skill 的诊断结果不可用
   - AI 降级为"纯写作辅助"而非"文学诊断"

3. **40 个 Skill 创建后维护成本超预期**
   - Skill 数量冻结，不继续扩展

4. **Web 版 BYOK 方案无法落地**
   - v2.0 只发布桌面版，Web 版推迟到 v2.1

5. **v1.9 RC 发现不可修复的 P0 缺陷**
   - v2.0 延期，发布 v1.9 LTS 稳定版

---

*文档状态：草稿 v1 — 待产品评审*
*编制：product-manager*
*来源：master-prototype-map.md, implementation-roadmap.md, product-spec-v1.2.md, product-think-v1.3.md*
