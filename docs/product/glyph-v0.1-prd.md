# Glyph v0.1 — 产品需求文档

> 状态：**定稿**
> 日期：2026-07-23
> 版本：v0.1-final

---

## 1. 背景（Why）

### 谁受影响

**第一用户：产品经理型创作者。** 会使用 AI 工具但厌恶复杂流程的写作者。他们不想学创作方法论、不想走管线流程、就想打开一个好看的东西直接写。

中文写作者优先。这意味着编辑器必须通过中文 IME（拼音输入法）的严格验证——候选框不遮挡、光标不跳跃、不吞字。

当前市场上：
- **Scrivener / Ulysses** — 功能强大但学习成本高，界面过时
- **Notion** — 通用笔记工具，专门写作体验不足
- **Obsidian** — 本地文件优先，但编辑器需要大量插件才能达到写作工具级别
- **Novelcrafter / Dabble** — AI 写作工具有管线但无方法论
- **纯 Markdown 编辑器** — Typora / iA Writer，体验好但无结构管理

Glyph 的生态位：**兼具 Notion 的编辑手感和结构化作品管理，底层为 AI 可介入预留接口。**

### 当前行为

原型阶段的 Glyph（前身织梦机）:
- 打开后看到的是管线导航（前提→结构→设定→细纲→正文），不是编辑器
- 编辑器默认 Markdown 源码模式
- 想写正文得先走完 4 个画板
- 界面中有大量不工作的按钮
- 保存状态不可靠，大纲重复

### 目标行为

打开 Glyph → 干净的书架 → 点项目进编辑器 → 直接写 → 自动保存 → 关掉 → 再打开 → 内容还在。

管线、AI、方法论完全不出现。每个 visible 按钮都工作。

### 为什么现在做

现有代码处于"管线优先"架构，体验基线太差无法判断产品方向。继续修补会导致"修 bug 产生更多 bug"的循环。需要一个干净的 v0.1 来建立真实反馈循环。

### 验收条件

见下方 [第 7 章](#7-验收条件)。

---

## 2. 范围（Scope）

### 2.1 v0.1 包含

| 模块 | 子功能 | 优先级 |
|------|--------|--------|
| **书架** | 作品卡片网格展示 | P0 |
| | 创建新作品（名称 + 体裁选择） | P0 |
| | 编辑作品名 | P0 |
| | 更改体裁 | P0 |
| | 更改封面渐变色 | P0 |
| | 删除作品（带确认） | P0 |
| | 空状态引导 | P0 |
| | 统计栏（作品数、总字数） | P1 |
| **编辑器** | 默认 WYSIWYG（Tiptap 富文本） | P0 |
| | 浮动工具栏（选中文字 → B/I/S/H2/H3/引用/列表） | P0 |
| | 斜杠菜单（`/` → 标题1-3/列表/引用/代码块/分割线） | P0 |
| | 键盘快捷键（Ctrl+B/I 等标准操作） | P0 |
| | WikiLink（`[[名称]]` 双链，点击跳转/新建） | P0 |
| | Markdown 源码模式（可选） | P1 |
| | 预览模式（只读渲染） | P1 |
| **大纲侧栏** | 文件级树：按章/节/场景层级展示 | P0 |
| | Markdown 标题级：当前文档内 H1/H2/H3 结构 | P0 |
| | 点击切换编辑器内容 | P0 |
| | 按类型分组展示 | P1 |
| **顶栏** | 返回书架按钮 | P0 |
| | 项目名称展示 | P0 |
| | 大纲切换按钮 | P0 |
| | 设置入口（预留） | P1 |
| **状态栏** | 保存状态指示（已保存/未保存/保存中/失败） | P0 |
| | 字数统计 | P0 |
| | 保存失败时显示可点击的重试按钮 | P0 |
| **自动保存** | 实时保存到 SQLite | P0 |
| **AI 预留** | 所有用户操作暴露为 Tauri 命令 | P0 |
| | 命令有完整输入输出类型 | P0 |
| | 架构允许 AI Agent 通过相同接口操作 | P0 |

### 2.2 v0.1 明确不包含

- AI 对话、AI 生成、AI 设置
- 五画板管线
- 设定集面板
- 判断记录
- Canvas 画板视图
- 快速速写（QuickDraft）
- 反馈系统
- 创作方法论
- BYOK / 自定义模型接入
- 全文搜索
- 导出
- 文件系统存储（保留 SQLite）
- 多窗口 / Tabs
- 协作功能
- 离线队列 / 重联恢复（v0.1 无服务器，不需要）

### 2.3 涉及的系统与模块

**后端（Rust）：**
- `commands.rs` — 项目 CRUD + 对象 CRUD
- `lib.rs` — Tauri 命令注册
- `db.rs` — SQLite 数据库层
- `models.rs` — 数据类型

**前端（TypeScript/React）：**
- `App.tsx` — 主应用（布局、路由、状态管理）
- `components/Bookshelf.tsx` — 书架
- `components/DocumentView.tsx` — 编辑器
- `components/DocOutline.tsx` — 大纲侧栏
- `components/StatusBar.tsx` — 状态栏
- `tauri-api.ts` — Tauri 命令封装

### 2.4 UI 组件枚举（验收用）

v0.1 的全部 visible 交互元素：

| 页面 | 元素 | 行为 |
|------|------|------|
| **书架** | 项目卡片（每张） | 点击进入项目 |
| | 封面画笔按钮 | 切换渐变色 |
| | 卡片 ⋯ 菜单 | 展开操作菜单 |
| | 编辑作品名按钮 | 弹 prompt → update_project |
| | 更改体裁按钮 | 弹 prompt → update_project |
| | 删除作品按钮 | confirm → delete_project |
| | "+ 新建作品"按钮 | 打开 CreationWizard |
| | 排序下拉 | 切换排序（暂不接后端） |
| | 搜索输入框 | 占位（暂不工作） |
| **作品内** | 顶栏返回书架 | handleBackToBookshelf |
| | 顶栏大纲切换 | toggle showOutline |
| | 顶栏设置 | 占位 |
| | 大纲侧栏对象 | 点击 → 编辑器加载 |
| | 编辑器正文 | 打字/格式化 |
| | 浮动工具栏按钮 ×7 | B/I/S/H2/H3/引用/列表 |
| | 斜杠菜单项 ×8 | 标题1-3/列表/引用/代码块/分割线 |
| | 工具栏模式切换 ×3 | 编辑/富文本/预览 |
| | 工具栏格式化按钮 ×7 | H2/H3/B/I/S/引用/列表 |
| | 状态栏重试按钮 | 保存失败时显示 |

---

## 3. 技术方案

### 3.1 架构总览

```
┌─────────────────────────────────────────────┐
│  React UI（App.tsx + 子组件）                │
│  Bookshelf | TopBar | Outline | Editor | SB  │
├─────────────────────────────────────────────┤
│  Tauri invoke() 命令层                       │
│  tauri-api.ts → invoke('command', args)      │
├─────────────────────────────────────────────┤
│  Rust Backend ✦                             │
│  commands.rs — 命令处理                      │
│  db.rs — SQLite (rusqlite + bundled)         │
│  models.rs — 类型定义                        │
└─────────────────────────────────────────────┘
      ✦ = AI Agent 可通过同一 invoke 接口操作
```

### 3.2 First-class 平台

**Windows（开发者的主力平台）。** macOS/Linux 不阻塞发布，但不作为 v0.1 的验收目标。

编辑器必须通过以下中文 IME 测试：
- 拼音输入法候选框弹出位置正确（不超出视口、不遮挡编辑行）
- compositionstart → compositionend 事件不丢失字符
- 候选框选中后光标位置不跳跃
- Edge/Chrome/WebView2 三种内核各测一遍

### 3.3 架构参考（AppFlowy × Logseq）

| 模式 | 来源 | v0.1 落地 | 说明 |
|------|------|-----------|------|
| **Manager 模块化** | AppFlowy | ✅ 部分 | 命令按领域分组，通过 `tauri::State` 持有 DB |
| **事件调度器** | AppFlowy | ✅ 已有 | Tauri invoke 天然是调度器 |
| **延迟编辑器** | Logseq | ✅ v0.1 | 非编辑态不挂载完整 Tiptap |
| **小数索引** | Logseq | 🔲 v0.2 | 当前用 SQLite updated_at |
| **Markdown Mirror** | Logseq | 🔲 v0.2 | v0.1 只存 SQLite |
| **CRDT 预备** | AppFlowy | 🔲 v0.2 | |

### 3.4 数据模型

**Project（projects 表）：**
```
id: TEXT PK
name: TEXT
genre: TEXT (科幻/奇幻/武侠/悬疑/历史/都市/其他)
status: TEXT (conceiving/drafting/editing/done)
word_count: INTEGER
gradient: TEXT (JSON array)
created_at: INTEGER (unix ms)
updated_at: INTEGER (unix ms)
```

**WorldObject（world_objects 表）：**
```
id: TEXT PK
project_id: TEXT FK → projects.id
name: TEXT
object_type: TEXT (人物/地点/组织/规则/事件/物品/术语/章节)
status: TEXT (占位/草稿/待定/待验证/锁定/废弃)
canon_level: TEXT (未收录/草案正典/项目正典/核心正典)
content: TEXT (Markdown)
```

**体裁变更说明：** 修改体裁只改 `projects.genre` 字段，不影响已有的 WorldObject 内容。"章节"对象的 name 不会自动重命名（例如科幻→剧本后"第一章"不会变成"第一幕"）。这是有意的设计选择——体裁是元数据，不影响已有内容。

### 3.5 编辑器架构

```
DocumentView
├── Toolbar（顶部：H2/H3/B/I/S/引用/列表 + 模式切换）
├── BubbleMenu（选中文字弹出：B/I/S/H2/H3/引用/列表）
├── SlashMenu（输入 "/" 弹出：块类型选择）
├── EditorContent（Tiptap 核心）
│   ├── StarterKit
│   └── WikiLink（[[名称]] 双链）
└── Properties（类型/状态/正典下拉）
```

**性能基线：** 编辑器在 5 万字文档内，每按键事件到 DOM 渲染完成延迟 < 50ms（使用 Chrome DevTools Performance panel 测量）。

### 3.6 自动保存（v0.1 简化版）

v0.1 不需要离线队列。自动保存简化为：

```
每次内容变更（onUpdate）
  → 调用 update_world_object（Tauri 命令写入 SQLite）
  → 状态栏：unsaved → saving → saved
```

去掉：
- IndexedDB 后备队列（v0.1 无服务器，不需要）
- 3 秒心跳检测（无服务器，不需要）
- 指数退避重试（直接调用，失败直接透传）
- 重联恢复（无服务器，不需要）

`SyncManager` 保留 `onSaveStatusChange` 回调接口。

### 3.7 AI 接口预留

```
invoke('create_project', { name, genre, ... })
invoke('update_project', { id, name, ... })
invoke('delete_project', { id })
invoke('create_world_object', { projectId, name, ... })
invoke('update_world_object', { id, content, ... })
invoke('delete_world_object', { id })
```

约束：
- 不将 UI 状态作为命令参数
- 每个命令返回完整操作结果
- 所有错误通过 `Result<T, String>` 返回

---

## 4. 测试计划

| 层级 | 范围 | 工具 |
|------|------|------|
| 单元测试 | Project CRUD（5 项） | Vitest |
| | WorldObject CRUD（10 项） | Vitest |
| | Bookshelf 渲染（7 项） | Vitest + Testing Library |
| 集成测试 | 前端 invoke ↔ 后端命令 | Vitest（mock invoke） |
| E2E | 创建 → 写作 → 保存 → 重开 | Playwright + Tauri |
| **IME 验证** | 拼音输入法候选框/光标/吞字 | 手动（Edge/Chrome/WebView2） |

### 回归风险

1. `npm run build` 通过（TypeScript + Vite）
2. `cargo check` 通过
3. `npm run check:api` 前端后端一致
4. 构建产物不包含 AI/管线 chunk

---

## 5. 风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 中文 IME 兼容性问题 | 中 | 高 | 手动验证三种内核 |
| 编辑器 5 万字后卡顿 | 低 | 中 | 性能基线约束 |
| 保存失败导致丢数据 | 低 | 极高 | 每步写入 SQLite，WAL 模式 |
| 重写破坏基线 | 中 | 中 | Git 分步提交 |
| 体裁变更与内容解耦造成困惑 | 低 | 低 | PRD 明确说明 |

**回滚方案：** Git 基线 `b1722d2` 已知前后端都编译通过。

---

## 6. 工作量估算

| 模块 | 预估 |
|------|------|
| 编辑器体验修复（IME + 性能基线） | 2 次迭代 |
| 大纲 Markdown 标题级 | 1 次迭代 |
| 保存简化 + 错误恢复 | 1 次迭代 |
| 书架空状态优化 | 1 次迭代 |
| 验收 + 修复 | 1 次迭代 |

---

## 7. 验收条件

每条验收条件设计为**可通过/不可通过**的二元判定，不依赖主观判断。

| # | 条件 | 检验方法 | 通过标准 |
|---|------|---------|---------|
| 1 | 全新启动 → 看到书架，无示例项目，有"创建第一个作品"按钮 | 截图 + 点击 | 按钮存在且可点击 |
| 2 | 创建项目 → 卡片出现在书架，点击进入 Workspace | 操作 | 卡片显示，点击后进入编辑器 |
| 3 | 编辑器默认 WYSIWYG，不显示 Markdown 源码 | 截图 | 编辑器区域渲染为富文本，无 `##` `**` 等符号 |
| 4 | 键盘输入中文：拼音候选框不遮挡编辑行，不吞字 | Edge/Chrome/WebView2 各输入 50 字 | compositionend 后文字完整无缺失 |
| 5 | 键盘输入 1 万字后，打字延迟 < 50ms | DevTools Performance 录 3 秒 | 输入事件 → 渲染帧耗时均值 < 50ms |
| 6 | 选中文字 → 浮动工具栏出现 | 选中 5 字 | 气泡菜单渲染在选区上方 |
| 7 | 点击浮动工具栏 B/I/S/H2/H3/引用/列表 → 格式正确应用 | 各点一次 | 文字样式/块类型正确切换 |
| 8 | 在新行按 `/` → 斜杠菜单弹出，选一个 → 块转换，`/` 消失 | 操作 | 菜单出现，选择后 `/` 被删除，块转换 |
| 9 | 侧栏大纲展示对象分组列表 | 截图 | 显示对象分组标题和列表 |
| 10 | 侧栏 Markdown 标题区展示当前文档 H1-H3 结构 | 截图 | 当前文档标题按层级展示 |
| 11 | 点击大纲对象 → 编辑器加载该对象内容 | 操作 | 编辑器内容切换为目标对象 |
| 12 | 打字后状态栏显示"未保存"→ 自动变为"已保存"<br/>（不经过"saving"，直接写 SQLite） | 操作 + 观察 | 状态指示正确流转 |
| 13 | 显式触发保存失败（拔网线不适用，模拟 invoke 返回 err）→ 状态栏显示失败 + 可点的重试按钮 | 注入 mock 错误 | 失败指示 + 按钮可点 |
| 14 | 关 app 重开 → 内容完整 | 重启 Tauri | 之前写入的内容完整可读 |
| 15 | 书架：创建、改名字、改体裁、改封面、删除 → 全部正常 | 逐项操作 | 每项操作后刷新确认持久化 |
| 16 | 逐一测试 [2.4 组件枚举](#24-ui-组件枚举验收用) 中全部 visible 元素 | 逐元素点击 | 每个元素有可观察的反馈 |
| 17 | Console 无报错（Tauri invoke 预期的错误不算） | 开 DevTools | 无红色 error 日志 |
| 18 | `npm run check:api` → 前端调用数 = 后端使用数 | 跑脚本 | 输出显示 0 个前端-only 命令 |
| 19 | `npm run build` + `cargo check` → 均通过 | 跑命令 | exit code 0 |
