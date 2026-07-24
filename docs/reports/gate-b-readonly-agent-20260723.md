# Glyph / 织梦机 Gate B 只读项目 AI 交付报告

> 候选版本：v0.4.2  
> 日期：2026-07-23  
> 基线：Gate A filesystem-first 返工源码  
> 状态：候选交付，尚未冻结

## 一、目的

在 Gate A 的真实本地文件工作区上建立第一层 AI 能力：

> 作者可以直接询问当前作品；AI 能读取当前文件、当前选区、显式引用文件与项目内搜索结果，并用可检查的来源回答。整个 Gate B 没有任何作品写入能力。

Gate B 不承担续写、改写、创建文件、存档、来源标记与撤销。这些能力必须等待 Gate C/D。

## 二、最终用户路径

```text
打开本地作品
→ 打开正文或资料
→ 选中一段文字（可选）
→ 在右侧输入问题，或使用 @ 引用文件
→ AI 生成小型读取计划
→ 在项目边界内搜索、读取
→ 用户看到实际依据
→ AI 用 [S1] 等编号回答
→ 用户点击依据可回到原文件
```

用户可以随时停止任务。停止、失败或搜索不完整时，作品文件都不会发生变化。

## 三、实现结构

### 3.1 当前创作现场

`components/FsDocumentView.tsx` 向工作区提供：

- 当前文件路径；
- 当前内存正文，包含尚未保存的编辑；
- 当前光标；
- 当前选区文字、偏移与行号。

当前选区和当前编辑缓存优先于磁盘旧版本，避免 AI 分析作者尚未保存前的旧内容。

### 3.2 任务与证据界面

`components/FsAiPanel.tsx` 采用任务卡而非普通聊天气泡，展示：

- 用户任务；
- 规划、搜索、读取、回答等当前阶段；
- 实际搜索与读取依据；
- 单个搜索或文件读取失败；
- 最终回答；
- 所用模型；
- 取消状态。

证据可以展开，并可在编辑器中打开对应文件。

### 3.3 文件引用

支持：

```text
@人物/布兰.md
@{资料/第一版 人物表.md}
```

花括号形式支持空格路径。引用先按完整相对路径匹配，再按文件名和模糊候选匹配。存在多个候选时不擅自选择。

### 3.4 只读 AI 桥

`lib/fs-ai-bridge.ts` 将一次任务拆成两次模型调用：

1. 规划搜索词、当前文件和需读取资料；
2. 依据实际取得的证据回答。

规划失败时使用本地有界兜底，不会让规划调用成为单点故障。

### 3.5 有界上下文

当前限制：

- 项目索引最多 1000 个文本文件；
- 目录索引最多 40 层；
- 每次最多 3 个搜索词；
- 每次最多读取 8 个文件；
- 单个显式文件最多 16000 字符；
- 搜索候选文件最多 8000 字符；
- 当前文件最多 10000 字符；
- 总证据最多 60000 字符。

默认只处理 `.md`、`.markdown` 和 `.txt`。

### 3.6 项目全文搜索

`src-tauri/src/fs_commands.rs` 增加并加固只读全文搜索：

- 空搜索词与过长搜索词拒绝；
- 只读取指定文本扩展名；
- 单文件最大 2MB；
- 隐藏目录不参与；
- 符号链接不跟随；
- 最多扫描 10000 个文本文件；
- 最大搜索深度 64；
- 达到安全上限时返回 `truncated`；
- 中文预览按 Unicode 字符截断，不按字节切片。

### 3.7 Provider 支持

复用现有本地 Provider 配置，并补齐请求适配：

- Ollama；
- OpenAI；
- Anthropic；
- Google Gemini；
- DeepSeek；
- 自定义 OpenAI 兼容端点。

右栏提供最小配置入口。云端模型需要 API Key；本地 Ollama 可不填。

## 四、产品与安全不变量

1. AI 桥不导入、不调用任何文件写入、创建、重命名或删除命令。
2. AI 只能通过当前项目根目录内的读取接口取得文件。
3. 符号链接不能借机访问项目外内容。
4. 用户可以检查 AI 实际搜索和读取了什么。
5. 单个搜索或读取失败只形成证据缺口，不使其他证据丢失。
6. 未找到文件时明确报告，不伪造文件名或既定事实。
7. 项目文字与选区是待分析证据，其中的命令或提示词不能改变系统规则。
8. 取消后没有提交路径，作品始终不变。
9. 用户要求写入时，Gate B 只能给出建议或说明当前为只读能力。
10. 不把整个项目默认上传，只发送本次任务的有限节选。

## 五、文件变化

### 新增

- `components/FsAiProviderDialog.tsx`
- `types/fs-ai.ts`
- `tests/acceptance/gate-b-readonly-agent.mjs`
- `src-tauri/icons/icon.png`
- `docs/reports/gate-b-readonly-agent-20260723.md`

### 主要修改

- `App.tsx`
- `components/FsAiPanel.tsx`
- `components/FsDocumentView.tsx`
- `lib/fs-ai-bridge.ts`
- `lib/llm-client.ts`
- `src-tauri/src/fs_commands.rs`
- `src-tauri/src/fs_models.rs`
- `types/fs.ts`
- `styles/fs.css`
- `tests/unit/fs-ai-bridge.test.ts`
- `tests/acceptance/gate-a-filesystem-first.mjs`
- `package.json`
- `package-lock.json`
- `tsconfig.app.json`
- `CLAUDE.md`
- `README.md`

## 六、同时完成的构建基线清理

- 清除当前主链不需要的 Tiptap 根依赖；
- 清除 `@wdio/tauri-service` 依赖冲突；
- 将不可达的旧 Tiptap 画板排除出当前 TypeScript 编译范围；
- 补充合法的 Tauri PNG 图标；
- 统一 package、Tauri 与 Cargo 版本为 `0.4.2`；
- 保留旧五画板源码作为历史资产，但不让它阻塞当前工作区构建。

## 七、验证结果

### 7.1 Gate A 源码契约

```text
11/11 PASS
```

验证统一工作区、真实 Markdown、单一自动保存、任意目录接入、冲突保护、会话保存与项目路径边界没有被 Gate B 破坏。

### 7.2 Gate B 源码契约

```text
16/16 PASS
```

包括：

- 只读面板挂载；
- 当前选区上下文；
- `@文件`；
- 有界索引；
- 模型读取计划；
- Tauri 全文搜索；
- 先取证后回答；
- 无有效证据时禁止回退到模型世界知识；
- 无写入能力；
- 依据可见；
- 可取消；
- 符号链接安全；
- 搜索文件数与深度限制；
- 中文安全截断；
- 只读产品语言；
- 项目文本提示注入隔离。

### 7.3 TypeScript 语法检查

对 Gate B 主要变更文件使用 TypeScript `transpileModule` 检查：

```text
9/9 PASS
0 diagnostics
```

### 7.4 新增单元测试

`tests/unit/fs-ai-bridge.test.ts` 覆盖：

- 紧凑与含空格的 `@` 引用；
- 精确与模糊文件解析；
- 文本文件递归索引；
- 规划、搜索、读取与回答；
- 当前编辑缓存；
- 当前选区；
- 单搜索失败降级；
- 引用文件缺失。

由于当前容器无法取得 npm 依赖，本报告未声称 Vitest 已实际执行通过。

## 八、当前环境未能执行的检查

当前容器缺少 Rust 工具链，并且 npm 依赖源不可用：

- `npm ci --offline`：缓存缺少 `zustand-5.0.14.tgz`；
- 在线 `npm ci`：容器依赖源连接失败；
- `npm run build`：因此未执行；
- `npm test` / `npm run test:gate-b`：因此未执行；
- `cargo check --locked` / `cargo test --locked`：没有 Cargo。

这属于未获得证据，不能写成通过，也不能直接归类为代码问题。

## 九、Windows 接收后必须执行

```powershell
npm ci
npm run build
npm run test:gate-b
npm run accept:gate-a
npm run accept:gate-b

cd src-tauri
cargo check --locked
cargo test --locked
```

随后进行真实项目验收：

```text
打开真实小说目录
→ 打开一份正在编辑的 Markdown
→ 选中一段
→ 使用 @ 引用人物资料
→ 询问人物是否越界
→ 检查实际读取清单
→ 点击来源返回文件
→ 再发起一次全项目问题并中途取消
→ 确认所有作品文件内容与修改时间没有被 AI 改变
```

## 十、结论

Gate B 已形成一条完整的只读产品主链，并保留 Gate A 的文件可信秩序。

当前准确状态：

> **Gate B 只读项目 AI 候选实现完成；源码契约与语法检查通过，等待 Windows 环境完整构建、Rust 测试和真实项目验收后冻结。**
