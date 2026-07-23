# Gate A 返工源码接收报告

## 旧版本
- 原提交：`2069da91c32c820a9b7fd19a035d65dca1444e23`
- 归档分支：`archive/gate-a-rejected-prototype`
- 归档标签：`gate-a-rejected-prototype-20260723`

## 返工包
- 文件名：`glyph-source-repaired-v0.4.1.zip`
- 期望 SHA-256：`35e7a2e9f47cd71363c476b8689e498f0e98a75a36d6fdecf3ce7fbd50b916e4`
- 实际 SHA-256：`35E7A2E9F47CD71363C476B8689E498F0E98A75A36D6FDECF3CE7FBD50B916E4`
- 哈希验证：**PASS**

## 接收结果
- 新分支：`repair/gate-a-filesystem-first`
- 新提交：待提交
- 修改文件数量：91
- 新增文件数量：2（`FsProjectCreateDialog.tsx`, `FsWelcome.tsx`）
- 删除文件数量：众多（`.claude/skills/`, `.claude/combos/`, 旧 icons 等）

## 验证

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `rg "isFsMode"` | ✅ 未检出 | 旧双工作区标记已移除 |
| `rg "XMLHttpRequest\|/save-session"` | ✅ 未检出 | 伪会话保存已移除 |
| `tests/acceptance/gate-a-filesystem-first.mjs` | ✅ 存在 | 验收脚本 11/11 PASS |
| `accept:gate-a` 脚本 | ✅ 存在 | package.json 已注册 |
| 旧报告已标记废止 | ✅ | handoff-gate-ab-20260723.md 已标注"已废止" |
| 返工报告已归档 | ✅ | gate-a-repair-20260723.md 存在 |

### npm ci
❌ **失败** — 依赖版本冲突
- `@tiptap/extension-placeholder@3.28.0` 需要 `@tiptap/core@3.28.0`
- 其他 Tiptap 插件需要 `@tiptap/core@^2.27.2`
- 使用 `npm install --legacy-peer-deps` 可绕过

### npm run build (tsc -b && vite build)
❌ **失败** — 5 个 TypeScript 编译错误（均为返工包自带）：
1. `components/Bookshelf.tsx(712)` — `onEnterFsProject` 可能为 undefined（可选参数）
2. `components/FsAiPanel.tsx(240)` — `provider` 应为 `providerId`（AiModel 类型）
3. `lib/fs-ai-bridge.ts(473)` — `provider` 应为 `providerId`
4. `lib/fs-ai-bridge.ts(478)` — `timeout_ms` 应为 `timeoutMs`
5. `lib/fs-ai-bridge.ts(486)` — `response.text` 不存在于 LlmResponse 类型

### npm test (vitest)
❌ **无法运行** — Node.js OOM（vitest 工作进程堆内存不足）
- 非代码问题，Windows 环境下 vitest 的内存压力
- 上轮会话中相同测试套件曾成功通过（85/85）

### npm run accept:gate-a
✅ **通过** — 11/11 PASS
```
[PASS] one filesystem-first workspace
[PASS] two explicit entry paths
[PASS] truthful Markdown editor
[PASS] single automatic-save owner
[PASS] arbitrary directory adoption
[PASS] minimal new project
[PASS] checked content-version writes
[PASS] own watcher events resolved by versions
[PASS] session persistence uses Tauri
[PASS] backend/frontend project id contract
[PASS] project-bound path validation
```

### cargo check --locked
❌ **失败** — `icons/icon.png` 缺失
- 返工包删除了 `src-tauri/icons/` 目录
- tauri.conf.json 中配置了 `bundle.icon: ['icons/icon.png']`
- 需重新生成图标后方可构建

### cargo test --locked
❌ **无法执行** — 同上，图标缺失导致构建脚本失败

## 未通过项
1. **npm ci** 因 Tiptap v2/v3 版本冲突无法使用。需返工包作者修复 package.json 中的版本声明。
2. **npm run build** 有 5 个 TS 错误，全部位于 `FsAiPanel.tsx` 和 `lib/fs-ai-bridge.ts`（Gate B 文件）。AiModel 类型字段名不正确（`provider`→`providerId`，`timeout_ms`→`timeoutMs`，`response.text` 不存在）。
3. **Rust 构建** 因 `icons/icon.png` 缺失失败。需补回图标文件。
4. **vitest** 在当前环境因 OOM 无法完成。非代码阻断，需在其他环境验证。

## 结论
**Gate A 返工源码已收存，成为候选基线；尚未冻结，等待真实运行与完整验收。**
