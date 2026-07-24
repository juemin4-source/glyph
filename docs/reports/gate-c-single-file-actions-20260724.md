# Glyph / 织梦机 Gate C 单文件正式行动交付报告

> 候选版本：v0.4.3  
> 交付日期：2026-07-24  
> 状态：候选实现完成，等待 Windows 完整构建、Rust 测试与真实项目验收  
> 基线：v0.4.2 Gate B

---

## 一、Gate C 目的

Gate C 将 Gate B 的“项目搜索、读取与证据回答”推进为一条受控的正式行动主链：

```text
用户表达任务
→ AI 判断回答 / 新建 / 选区改写 / 光标插入 / 整文件替换
→ 搜索并读取项目依据
→ 锁定一个目标文件
→ 模型生成临时结果
→ 工作区复核当前编辑状态
→ Rust 边界复核磁盘版本
→ 必要时创建完整快照
→ 原子提交一个 Markdown 文件
→ 记录本次行动
→ 作者继续创作
```

Gate C 的核心产品承诺：

> AI 可以直接行动，但一次只改变一份明确的 Markdown；生成结果与正式提交分离，创作现场发生变化时不得静默覆盖。

---

## 二、范围与边界

### 2.1 本 Gate 完成

- 保留 Gate B 的项目索引、全文搜索、文件读取、当前文件、当前选区和 `@文件`；
- AI 可规划五种结果：
  - `answer`：只读回答；
  - `create_file`：创建一个新 Markdown；
  - `replace_selection`：替换当前明确选区；
  - `insert_at_cursor`：在当前光标插入；
  - `replace_file`：用户明确要求时替换当前完整文件；
- 一次任务只有一个 `targetPath`；
- 生成与正式提交分离；
- 创建文件时禁止覆盖已有文件；
- 修改已有文件时必须验证磁盘版本；
- 修改前在 `.glyph/snapshots/` 保存完整旧版本；
- 每次正式行动在 `.glyph/actions/` 建立结构化记录；
- 生成期间编辑器、项目或磁盘发生变化时阻止提交，并保留未提交草稿；
- 正式提交成功后刷新文件树并接管目标文件。

### 2.2 本 Gate 明确不做

- 删除、重命名、移动文件；
- 一次修改多个正式文件；
- 批量重构项目；
- 写入 `.glyph` 或项目外目录；
- 非 Markdown 文件写入；
- 自动覆盖同名文件；
- 精细来源显示；
- 面向用户的完整版本历史与撤销界面；
- 多文件事务与合并。

Gate C 已建立快照和行动记录底座，完整撤销、来源显示与长期治理仍属于 Gate D。

---

## 三、产品行动模型

## 3.1 只读回答

AI 使用 Gate B 的项目证据回答，不改变文件。

无有效项目依据时，系统明确说明材料不足，不使用模型世界知识伪造项目事实。

## 3.2 新建文件

适用于下一章、施工卡、人物卡、新版本或明确的新草稿。

规则：

- 目标必须是项目内 `.md` / `.markdown`；
- 默认只创建一个文件；
- 已存在时阻止提交；
- 生成中断时不产生正式半成品；
- 成功后刷新文件树并打开新文件。

## 3.3 替换选区

作用范围由任务发起时的选区冻结。

生成完成后，工作区再次检查：

- 当前文件仍是同一个文件；
- 当前内容仍与任务发起时一致；
- 选区原文仍未变化；
- 编辑修订号、文件状态与磁盘版本仍符合预期。

任一条件失效时，结果成为未提交草稿。

## 3.4 光标插入

只在当前明确文件和光标位置插入生成内容。

最终文件内容在前端本地组装，模型只能返回要插入的 Markdown，不能自行扩大目标范围。

## 3.5 整文件替换

只有用户明确使用“整章、全文、整个文件、整篇”等范围词时允许。

模糊的“帮我处理一下这章”不会自动升级为整文件覆盖。

---

## 四、三层安全边界

## 4.1 AI 规划层

`lib/fs-ai-bridge.ts` 将模型结果限制为五种动作，并执行二次校验：

- 非法动作回退；
- 缺少选区时不能替换选区；
- 未打开文件时不能插入或整文件替换；
- 未明确整文件范围时不能 `replace_file`；
- 创建目标自动规范为 Markdown；
- `.glyph`、`..`、盘符和内部路径被拒绝。

## 4.2 工作区复核层

`stores/fsStore.ts` 在生成前和提交前分别校验创作现场。

生成前：

- 当前项目仍存在；
- 当前目标文件与任务快照一致；
- 脏文件先安全保存；
- 冲突、缺失和保存错误阻止行动；
- 捕获基准内容、磁盘版本和编辑修订号。

提交前：

- 当前项目未切换；
- 当前文件、内容、修订号和版本未改变；
- 生成期间的用户编辑不会被覆盖。

## 4.3 Rust 正式提交层

新增统一命令：

```text
commit_ai_file_action
```

Rust 边界负责：

- 路径规范化和项目边界；
- 只允许 `create` / `modify`；
- 单次内容上限 4 MB；
- 只允许 Markdown；
- 拒绝 `.glyph` 与 `.glyph-trash` 目标；
- 操作 ID 唯一性；
- 新建 no-clobber；
- 修改前读取并验证 `expectedVersion`；
- 先创建完整快照，再执行 checked atomic write；
- 建立 `prepared → committing → completed / failed` 行动记录。

---

## 五、生成与正式提交分离

模型从不直接调用通用文件写入接口。

生成阶段只形成 `AiWriteProposal`：

```text
operationId
行动类型
目标文件
用户指令
变化说明
模型生成内容
最终完整文件内容
基准文件内容与版本
编辑器修订号
实际依据路径
```

随后由工作区决定能否提交，再由 Rust 完成正式文件事务。

若提交被阻止，产品返回：

> 内容已经生成，但创作现场发生变化，没有写入正式作品。

生成内容保留为 `draft`，不会伪装成已完成修改。

---

## 六、行动记录与快照

### 6.1 行动记录

路径：

```text
.glyph/actions/<operationId>.json
```

记录包括：

- Glyph 版本；
- 操作 ID；
- `create` / `modify`；
- 目标文件；
- 状态；
- 用户指令；
- 变化说明；
- 实际依据文件；
- 快照路径；
- 修改前后版本；
- 失败原因；
- 更新时间。

### 6.2 修改快照

路径：

```text
.glyph/snapshots/<operationId>.md
```

阶段一采用完整文件快照。快照成功以前，已有文件不得正式修改。

新建文件不产生旧版快照，但仍产生行动记录。

### 6.3 记录收尾原则

如果正式文件已经提交成功，而行动记录最终状态写入失败：

- 不把文件提交谎报成失败；
- 后端输出诊断日志；
- 后续 Gate 需要增加记录修复与一致性检查。

---

## 七、界面变化

`components/FsAiPanel.tsx` 从“只读 AI”升级为“AI 副手”。

任务卡展示：

- 用户要求；
- AI 计划的行动类型；
- 目标文件；
- 搜索与读取依据；
- 当前阶段；
- 正式提交结果；
- 快照是否存在；
- 因冲突未提交时的草稿预览；
- 取消入口。

产品语言区分：

- 生成中；
- 正在安全提交；
- 已创建 / 已修改；
- 已生成但未提交。

不再把模型输出完成等同于正式文件完成。

---

## 八、主要变更文件

相对 Gate B：新增 1 个文件，修改 21 个文件。

### 新增

- `tests/acceptance/gate-c-single-file-actions.mjs`

### 核心修改

- `App.tsx`
- `components/FsAiPanel.tsx`
- `components/FsAiProviderDialog.tsx`
- `lib/fs-ai-bridge.ts`
- `stores/fsStore.ts`
- `tauri-api.ts`
- `types/fs-ai.ts`
- `types/fs.ts`
- `src-tauri/src/fs_commands.rs`
- `src-tauri/src/fs_models.rs`
- `src-tauri/src/lib.rs`
- `styles/fs.css`
- `tests/unit/fs-ai-bridge.test.ts`
- `tests/acceptance/gate-b-readonly-agent.mjs`
- `README.md`
- `CLAUDE.md`
- `package.json`
- `package-lock.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`

---

## 九、测试与验收

## 9.1 已执行

```text
Gate A 源码契约回归             11/11 PASS
Gate B 能力契约回归             14/14 PASS
Gate C 单文件行动源码契约       23/23 PASS
主要 TypeScript 文件语法转译      8/8 PASS
```

Gate C 契约覆盖：

- AI 面板连接 prepare / commit 边界；
- 五种有界行动；
- 单目标路径；
- 生成与提交分离；
- 选区替换本地组装；
- 整文件明确授权；
- 内部路径和非 Markdown 拒绝；
- Rust 只允许 create / modify；
- 新建不覆盖；
- 修改必须 expected version；
- 快照先于写入；
- 行动记录；
- 前端二次复核；
- 脏文件先保存；
- 编辑与外部变化阻止提交；
- 创建成功后刷新并打开；
- 取消发生在正式提交前；
- Tauri / Rust 命令一致；
- 跨边界 camelCase 契约；
- 无删除和多文件动作。

## 9.2 当前环境未完成

### 完整前端构建

当前容器中的 `node_modules` 不完整，执行 `npm run build` 时缺少多项类型定义。该结果不能判断为源码业务错误，也不能计为通过。

### Vitest

`npm run test:gate-c` 返回：

```text
vitest: not found
```

需要在干净环境完成 `npm ci` 后执行。

### Rust

当前环境没有 `cargo` / `rustc`，未执行：

```text
cargo check --locked
cargo test --locked
```

因此本交付不能标记 Gate C 已冻结。

---

## 十、Windows 接收验证

在候选源码根目录执行：

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

随后使用真实小说项目验收：

```text
打开真实项目
→ 打开并编辑一个 Markdown
→ AI 读取施工卡、前章和人物资料
→ AI 新建下一章
→ 验证已有同名文件不会被覆盖
→ 选中一段让 AI 改写
→ 在生成期间修改选区，验证正式提交被阻止并保留草稿
→ 再次执行改写，验证快照先于正式写入
→ 使用外部编辑器改变目标文件，验证版本冲突阻止提交
→ 明确要求整章重写，验证告知范围后只改当前文件
→ 检查 `.glyph/actions` 与 `.glyph/snapshots`
→ 关闭重启，确认正文和项目仍正确
```

---

## 十一、发布阻断条件

出现以下任一情况，Gate C 不得冻结：

- AI 一次改变多个正式文件；
- 新建覆盖已有文件；
- 修改前没有有效快照；
- 磁盘版本不一致仍然覆盖；
- 用户生成期间的编辑被删除；
- 取消后正式文件出现半成品；
- 模型输出完成被错误报告为正式提交完成；
- AI 能写入 `.glyph`、项目外路径或非 Markdown；
- 目标文件提交失败但 UI 报告成功；
- Gate A 的自动保存、外部冲突或真实 Markdown 主链发生回归。

---

## 十二、结论

Gate C 已建立“项目证据 → 有界规划 → 临时生成 → 双重复核 → 单文件正式事务”的完整候选主链，并为 Gate D 留下快照和行动记录底座。

当前准确状态：

> **Gate C 单文件正式行动候选实现完成；Gate A/B/C 源码契约通过，完整 Windows 构建、Rust 测试和真实项目验收尚未完成，因此不得宣布冻结。**
