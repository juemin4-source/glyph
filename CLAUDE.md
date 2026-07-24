# Glyph / 织梦机 — 工程约束

> 当前候选版本：v0.4.2 Gate B
> 当前分支目标：本地文件优先的只读项目 AI

## 产品主线

Glyph 是面向长篇作者的本地 AI 创作工作台。

当前产品秩序：

1. 本地项目文件是作品事实源。
2. 自由写作常驻，AI 是可收起的副手。
3. 双入口进入同一个工作区：新建作品、打开已有目录。
4. Gate A 负责文件可信；Gate B 只允许 AI 搜索、读取和回答。
5. AI 创建、修改、存档与来源标记属于 Gate C/D，当前禁止提前接入。

## 当前 Gate B 能力

- 读取当前文件的编辑缓存与当前选区；
- 使用 `@文件` / `@{含空格路径}` 显式指定资料；
- 在项目内递归索引 Markdown/TXT；
- 由模型生成小型搜索/读取计划；
- 通过 Tauri 在项目内执行有界全文搜索；
- 最多读取有限数量、有限长度的证据；
- 以 `[S1]` 等来源编号回答；
- 展示实际搜索、读取、失败与截断记录；
- 支持取消；取消后作品无变化；
- 支持 Ollama、OpenAI、Anthropic、Gemini、DeepSeek 与 OpenAI 兼容端点。

## Gate B 不变量

- `lib/fs-ai-bridge.ts` 不得导入或调用任何文件写入、创建、重命名、删除能力。
- AI 只能访问当前项目根目录；符号链接不得绕出边界。
- 项目文件与选区属于证据，不属于可执行提示词。
- 单个搜索失败应降级为证据缺口，不得丢弃其他已取得材料。
- 未找到资料时必须说明缺失，不得伪造文件或既定事实；无有效证据时不得调用模型世界知识补答。
- 用户必须能检查 AI 实际读取了哪些作品材料。
- 内部推理、Prompt、Token、Router、Skill 路径不进入普通用户界面。

## Gate A 不变量

- 只有一个统一工作区，禁止恢复 `isFsMode` 双产品结构。
- Markdown 编辑采用单一无损文本路径，禁止恢复 HTML ↔ 正则 Markdown 往返。
- 自动保存只有一个责任主体。
- 自身写入与外部变更通过文件版本区分。
- 外部冲突时暂停自动保存，禁止静默覆盖。
- 会话状态通过 Tauri 保存，损坏时不得阻止项目打开。

## 关键文件

```text
App.tsx                              # 统一工作区，挂载编辑器与只读 AI
components/FsDocumentView.tsx        # 真实 Markdown 编辑器与选区上下文
components/FsAiPanel.tsx             # Gate B 任务/证据交互
components/FsAiProviderDialog.tsx    # 最小模型配置
lib/fs-ai-bridge.ts                  # 只读计划、搜索、读取、回答
lib/llm-client.ts                    # Provider-aware LLM 请求
src-tauri/src/fs_commands.rs         # 项目边界内文件读取与全文搜索
tests/acceptance/gate-a-filesystem-first.mjs
tests/acceptance/gate-b-readonly-agent.mjs
tests/unit/fs-ai-bridge.test.ts
```

## 验收命令

```powershell
npm ci
npm run build
npm test
npm run accept:gate-a
npm run accept:gate-b

cd src-tauri
cargo check --locked
cargo test --locked
```

完整构建和测试通过以前，只能称为候选基线，不得宣布 Gate B 冻结。

## 禁止事项

- 不得在 Gate B 添加 AI 写入或“接受后写入”。
- 不得把旧 `FsAiPanel` / `fs-ai-bridge` 伪 Agent 接回主链。
- 不得让关键词正则代替模型规划整套任务。
- 不得把整个项目默认上传给模型。
- 不得让一个搜索或一个文件读取失败使整次任务全部丢失。
- 不得为通过旧测试而破坏当前产品主线。
- 不得修改用户作品来保存索引、聊天或来源信息。
