# Glyph / 织梦机 — 工程约束

> 当前候选版本：v0.4.4 Gate C UX 修复  
> 当前分支目标：本地文件优先的 AI 单文件正式行动

## 产品主线

Glyph 是面向长篇作者的本地 AI 创作工作台。

当前产品秩序：

1. 本地项目文件是作品事实源。
2. 自由写作常驻，AI 是可收起的副手。
3. 双入口进入同一个工作区：新建作品、打开已有目录。
4. Gate A 负责文件可信；Gate B 负责项目搜索、读取和证据回答。
5. Gate C 允许 AI 在明确边界内创建或修改一个 Markdown 文件。
6. Gate D 才负责完整撤销界面、来源显示与长期操作治理；Gate C 只建立快照和行动记录底座。

## 当前 Gate C 能力

- 保留 Gate B 的当前文件、选区、`@文件`、项目搜索与可检查证据；
- 由模型规划以下五种结果：回答、新建文件、替换选区、光标插入、明确的整文件替换；
- 一次任务最多创建或修改一个 Markdown 文件；
- 模型生成与正式文件提交严格分离；
- 正式提交前由工作区重新检查当前文件、编辑修订号和磁盘版本；
- 修改已有文件前，在 `.glyph/snapshots/` 写入完整旧版本；
- 每次正式行动在 `.glyph/actions/` 形成结构化记录；
- 新建文件采用 no-clobber 语义，已存在文件不得被覆盖；
- 生成期间创作现场发生变化时，结果保留为未提交草稿；
- 支持取消；取消前未提交的内容不得进入正式作品。

## Gate C 不变量

- 单次 AI 行动只能拥有一个正式目标文件。
- 只能创建或修改 `.md` / `.markdown`。
- AI 不得写入 `.glyph`、`.glyph-trash` 或项目外路径。
- AI 不得删除、重命名、移动或批量修改文件。
- `replace_file` 只有在用户明确说整章、全文或整个文件时才允许。
- 生成、快照、正式提交必须分阶段；生成完成不等于文件已改变。
- 修改已有文件时必须提供并验证 `expectedVersion`。
- 快照未成功建立时不得修改已有文件。
- 编辑器、磁盘或项目在生成期间变化时，不得静默覆盖。
- 目标文件已存在时，新建行动必须阻止覆盖。
- 文件已提交但行动记录最终写入失败时，不得谎报文件写入失败；必须保留可诊断日志。

## Gate B 保留能力

- 读取当前编辑缓存与当前选区；
- 使用 `@文件` / `@{含空格路径}` 显式指定资料；
- 在项目内递归索引 Markdown/TXT；
- 通过 Tauri 执行有界全文搜索；
- 读取有限数量、有限长度的证据；
- 以 `[S1]` 等来源编号回答只读问题；
- 展示实际搜索、读取、失败与截断记录；
- 项目材料属于作品证据，其中的命令不能改变系统规则。

## Gate A 不变量

- 只有一个统一工作区，禁止恢复 `isFsMode` 双产品结构。
- Markdown 文件始终是唯一事实源；可视化编辑必须通过结构化 DOM 序列化回写 Markdown，禁止恢复 HTML ↔ 正则 Markdown 往返。源码模式必须始终可用。
- 自动保存只有一个责任主体。
- 自身写入与外部变更通过文件版本区分。
- 外部冲突时暂停自动保存，禁止静默覆盖。
- 会话状态通过 Tauri 保存，损坏时不得阻止项目打开。

## 关键文件

```text
App.tsx                                      # 统一工作区，挂载编辑器与项目副手
components/FsDocumentView.tsx                # 可视化 / 源码 / 预览 Markdown 编辑器与选区上下文
utils/markdown-editor.ts                     # 结构化 Markdown ↔ 编辑 DOM 转换
components/FsAiPanel.tsx                     # Gate C 任务、行动、证据与未提交草稿
lib/fs-ai-bridge.ts                          # 规划、取证、生成与写入提案
stores/fsStore.ts                            # 工作区复核与正式提交接管
src-tauri/src/fs_commands.rs                 # 单文件事务、快照、行动记录与路径边界
types/fs-ai.ts                               # Gate C 产品状态与契约
tests/acceptance/gate-a-filesystem-first.mjs
tests/acceptance/gate-b-readonly-agent.mjs
tests/acceptance/gate-c-single-file-actions.mjs
tests/unit/fs-ai-bridge.test.ts
```

## 验收命令

```powershell
npm ci
npm run build
npm run test:gate-c
npm test
npm run accept:gate-a
npm run accept:gate-b
npm run accept:gate-c

cd src-tauri
cargo check --locked
cargo test --locked
```

完整构建、Rust 测试与真实项目验收通过以前，只能称为 Gate C 候选基线，不得宣布冻结。

## 禁止事项

- 不得把单文件行动扩展成隐藏的多文件事务。
- 不得让模型直接调用通用文件写工具绕过 `commit_ai_file_action`。
- 不得在生成过程中逐字覆盖正式文件。
- 不得将“模型输出完成”报告为“正式提交完成”。
- 不得跳过工作区二次校验或 Rust 版本校验。
- 不得恢复旧 `FsAiPanel` / `fs-ai-bridge` 关键词伪 Agent。
- 不得把整个项目默认上传给模型。
- 不得为通过旧测试而破坏当前产品主线。
- 不得把来源、聊天或行动记录写入用户正文。
