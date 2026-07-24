# Handoff：Gate D-002 长期控制前端接线

> **生成时间**: 2026-07-24  
> **基线**: `repair/gate-a-filesystem-first` tag: `v0.4.6-rc1`  
> **创建者**: 梨安 (instance=main)

---

## 一、当前真实目标

完成 Gate D 的**前端产品闭环**：用户能在界面中看见 AI 行动、辨认 AI 写入、执行安全撤销，并在重启、后续编辑和外部变化后保持正文、历史、快照与来源一致。

这不是后端任务。后端基础已经存在（D0），当前需要的是 **D1：主链接线 + UI + 状态刷新**。

---

## 二、已完成且已验收的事项

### D0：后端数据与命令（候选完成）

| 命令 | 文件 | 状态 |
|------|------|------|
| `list_ai_actions` | `fs_commands.rs` | ✅ 编译通过 |
| `get_ai_action` | `fs_commands.rs` | ✅ 编译通过 |
| `revert_ai_action` | `fs_commands.rs` | ✅ 编译通过 |
| `list_file_provenance` | `fs_commands.rs` | ✅ 编译通过 |
| `save_file_provenance` | `fs_commands.rs` | ✅ 编译通过 |
| `startup_recovery_scan` | `fs_commands.rs` | ✅ 编译通过 |
| Rust 类型 | `fs_models.rs` | ✅ 编译通过 |
| TS 类型 | `types/fs-ai.ts` | ✅ 编译通过 |
| tauri-api 导出 | `tauri-api.ts` | ✅ 编译通过 |
| Gate D 验收 10/10 | `tests/acceptance/gate-d-long-term-control.mjs` | ✅ PASS |

### 编译基线
- `npm run build`: ✅
- `cargo check`: ✅ (28 warnings)
- `cargo test --lib`: 40/40 ✅
- Gate A 11/11 ✅ Gate B 14/14 ✅ Gate C 23/23 ✅

### 版本与标签
- `v0.4.6-rc1` — Gate D 后端候选基线
- `repair/gate-a-filesystem-first`

---

## 三、已完成但尚未验收的事项

| 事项 | 说明 |
|------|------|
| Store Gate D 状态字段 | `fsStore.ts` 的 `FsStore` 接口已新增 actionHistory、provenance、sourceMode、recoveryResult 等字段 |
| Store Gate D 初始值 | `emptyWorkspace()` 已包含所有 Gate D 字段的默认值 |
| tauri-api 导出 | `listAiActions`, `getAiAction`, `revertAiAction`, `listFileProvenance`, `saveFileProvenance`, `startupRecoveryScan` 均已导出 |

**但这些状态字段和 API 尚未被 UI 组件调用。** 以下缺失：

- [ ] Store action 实现（`loadActionHistory`, `revertAction`, `loadProvenance`, `setSourceMode`, `runStartupRecovery`）
- [ ] 在 `commitAiWrite` 成功后自动调用 `saveFileProvenance`
- [ ] 在 `openFile` 成功后自动调用 `loadProvenance`
- [ ] 在 `openProject` 成功后自动调用 `runStartupRecovery`

---

## 四、未完成事项

### 4.1 Store 实现（最高优先级，所有 UI 依赖此层）

需要向 `fsStore.ts` 添加以下 action 实现（在 `clearError` 之前）：

#### loadActionHistory
```typescript
loadActionHistory: async () => {
  const project = get().activeProject;
  if (!project) return;
  set({ actionHistoryLoading: true, actionHistoryError: null });
  try {
    const actions = await listAiActions(project.rootPath);
    set({ actionHistory: actions, actionHistoryLoading: false });
  } catch (e) {
    set({ actionHistoryLoading: false, actionHistoryError: String(e) });
  }
},
```

#### revertAction
```typescript
revertAction: async (input) => {
  const project = get().activeProject;
  if (!project) return null;
  try {
    const result = await revertAiAction(project.rootPath, input);
    // If restored, refresh file and history
    if (result.restored) {
      if (get().openFilePath === input.targetPath) {
        // Reload the file content
        try {
          const fileResult = await readFileState(project.rootPath, input.targetPath);
          set({
            fileContent: fileResult.content,
            diskModifiedAt: fileResult.modifiedAt,
            diskVersion: fileResult.version,
            fileStatus: 'clean',
            editRevision: 0,
          });
        } catch { /* file may have been deleted during revert */ }
      }
      await get().loadActionHistory();
    }
    return result;
  } catch (e) {
    return { operationId: input.operationId, targetPath: input.targetPath, restored: false, restoredVersion: '', preRevertSnapshot: '', reason: String(e) };
  }
},
```

#### loadProvenance
```typescript
loadProvenance: async (filePath) => {
  const project = get().activeProject;
  if (!project) { set({ provenance: [] }); return; }
  set({ provenanceLoading: true });
  try {
    const records = await listFileProvenance(project.rootPath, filePath);
    set({ provenance: records, provenanceLoading: false });
  } catch {
    set({ provenance: [], provenanceLoading: false });
  }
},
```

#### setSourceMode
```typescript
setSourceMode: (on) => set({ sourceMode: on }),
```

#### runStartupRecovery
```typescript
runStartupRecovery: async () => {
  const project = get().activeProject;
  if (!project) return;
  try {
    const result = await startupRecoveryScan(project.rootPath);
    set({ recoveryResult: result });
    if (result.actionsChecked > 0) {
      await get().loadActionHistory();
    }
  } catch {
    set({ recoveryResult: null });
  }
},
```

### 4.2 主链接线：Provenance 自动创建

在 `commitAiWrite` 的成功出口（`commitAiFileAction` 返回后，约 `fsStore.ts:624-643`）添加：

```typescript
// After commit success, create provenance records
if (result.action_type === 'modify' || result.action_type === 'create') {
  try {
    await saveFileProvenance(project.rootPath, proposal.targetPath, [{
      actionId: proposal.operationId,
      filePath: proposal.targetPath,
      textBlock: proposal.finalContent.slice(0, 200), // First 200 chars as anchor
      startOffset: 0,
      endOffset: proposal.finalContent.length,
    }]);
  } catch (e) {
    console.warn('[gate-d] provenance save failed (non-fatal):', e);
  }
}
await get().loadActionHistory();
```

**注意：** `save_file_provenance` 的 Rust 端接受 `ProvenanceRecordInput`，需要调整。当前 `save_file_provenance` 返回 `Result<(), String>`，但输入参数在 Rust 端是 `Vec<ProvenanceRecordInput>`（有 `project_root`, `action_id`, `file_path`, `text_block`, `start_offset`, `end_offset` 字段）。TypeScript 端需要匹配这个结构。

**修复建议**：修改 `tauri-api.ts` 中的 `saveFileProvenance` 导出，使其接受正确的输入类型：

```typescript
export function saveFileProvenance(
  projectRoot: string,
  filePath: string,
  records: { actionId: string; filePath: string; textBlock: string; startOffset: number; endOffset: number }[],
): Promise<void> {
  return invoke('save_file_provenance', { projectRoot, filePath, records });
}
```

### 4.3 主链接线：打开文件时加载来源

在 `openFile` action 的成功路径（`fsStore.ts` 约 354 行）添加：

```typescript
// After setting file state
get().loadProvenance(normalized).catch(() => {});
```

### 4.4 主链接线：启动恢复

在 `openProject` 的成功路径（`fsStore.ts` 约 268 行附近）添加：

```typescript
// After project is opened
get().runStartupRecovery().catch(() => {});
```

### 4.5 主链接线：用户编辑后更新来源（Main Chain 6）

在 `saveCurrentFile` 成功保存后（`fsStore.ts` 约 370 行附近），添加来源验证：

```typescript
// After save, verify provenance
const currentProvenance = get().provenance;
if (currentProvenance.length > 0) {
  const fileContent = get().fileContent;
  const updated = currentProvenance.map((p) => {
    const blockStillPresent = fileContent && fileContent.includes(p.textBlock);
    if (!blockStillPresent && p.currentState === 'ai_original') {
      return { ...p, currentState: 'ai_edited_by_user' as const };
    }
    return p;
  });
  const changed = updated.some((u, i) => u.currentState !== currentProvenance[i]?.currentState);
  if (changed) {
    set({ provenance: updated });
    // Persist the update
    const project = get().activeProject;
    if (project && get().openFilePath) {
      saveFileProvenance(project.rootPath, get().openFilePath, updated.map(u => ({
        actionId: u.actionId,
        filePath: u.filePath,
        textBlock: u.textBlock,
        startOffset: u.startOffset,
        endOffset: u.endOffset,
      }))).catch(() => {});
    }
  }
}
```

**注意：** 这里需要把 `ProvenanceRecord` 映射回 `ProvenanceRecordInput` 格式。也可以新建一个 `update_file_provenance` Rust 命令来直接更新状态。

### 4.6 UI：历史面板组件

创建 `components/AiHistoryPanel.tsx`：

- 调用 `useFsStore().loadActionHistory()`
- 显示按时间倒序的行动列表
- 每个条目：时间、指令摘要、操作类型、目标文件、状态（用户语言）
- 展开显示详情（证据、快照、版本）
- 可撤销行动的撤销按钮
- 已撤销行动的灰色显示
- 加载和错误状态

状态翻译表（Task 卡 5.3）：
```
planned → 等待执行
generating → 正在生成
ready_to_commit → 准备写入
committing → 正在写入
completed → 已完成
failed → 已失败
cancelled → 已取消
blocked → 已阻止
reverted → 已撤销
```

### 4.7 UI：撤销入口

在 `FsAiPanel.tsx` 的任务卡片中，为已完成行动添加：
- "[查看修改]" 按钮 → 打开目标文件
- "[撤销本次修改]" 按钮 → 调用 `revertAction`
- 撤销后的反馈（成功/失败）
- 冲突时的恢复面板入口

### 4.8 UI：来源模式

在 `FsDocumentView.tsx` 中添加：

- 工具栏切换按钮（纯净/来源）
- `sourceMode` 状态通过 `useFsStore()`
- 来源模式启用时，根据 `provenance` 数据在文本区域左侧显示细线或底纹
- 悬停显示详情：AI 写入 / AI 初稿用户已编辑 / 来源可能失准
- 点击来源块跳转到历史详情

视觉实现方法：
- 在 textarea 上层叠加一个绝对定位的 div
- 或者使用 textarea 外围的 wrapper 渲染标记
- 不建议修改 textarea 本身的内容

### 4.9 UI：冲突恢复面板

创建 `components/AiRevertConflictDialog.tsx`：

- 展示冲突原因
- 当前文件内容（只读）
- AI 修改前版本（从快照读取）
- 选项：查看旧版 / 另存旧版 / 保留当前 / 覆盖（弱化+二次确认）

### 4.10 App.tsx 集成

- 导入 AiHistoryPanel
- 在右侧 AI 工作区添加"历史"标签切换（与"当前任务"并列）
- 在 FsDocumentView 中传递 sourceMode 和 provenance

### 4.11 测试

需要更新 `tests/unit/fsStore.test.ts` 以覆盖：
- actionHistory 加载
- provenance 加载
- revertAction

需要创建 `tests/acceptance/gate-d-end-to-end.mjs` 验证端到端场景。

### 4.12 版本与标签

完成所有 UI 和接线后：
- 更新 `package.json`、`Cargo.toml`、`tauri.conf.json` 版本为 `0.4.7`
- 创建标签 `v0.4.7-rc1`
- 最终验收通过后改为正式 `v0.4.7`

---

## 五、关键文件索引

| 文件 | 角色 | 状态 |
|------|------|------|
| `src-tauri/src/fs_commands.rs` | Rust 后端：Gate D 命令 | ✅ |
| `src-tauri/src/fs_models.rs` | Rust 类型：Gate D 结构体 | ✅ |
| `src-tauri/src/lib.rs` | Tauri 命令注册 | ✅ |
| `tauri-api.ts` | 前端 API 导出 | ✅ (但 saveFileProvenance 类型可能需要修正) |
| `types/fs-ai.ts` | TS 类型 | ✅ 包含 AiActionSummary 等 |
| `stores/fsStore.ts` | Store：接口已扩展、空工作区已包含字段、action 实现未添加 | 🟡 部分 |
| `components/FsAiPanel.tsx` | AI 面板：需要添加撤销入口 | ❌ |
| `components/AiHistoryPanel.tsx` | 历史面板：需要创建 | ❌ |
| `components/FsDocumentView.tsx` | 编辑器：需要添加来源模式 | ❌ |
| `components/AiRevertConflictDialog.tsx` | 冲突恢复：需要创建 | ❌ |
| `App.tsx` | 应用入口：需要添加历史标签、集成来源模式 | ❌ |
| `tests/acceptance/gate-d-long-term-control.mjs` | D0 验收 | ✅ 10/10 |
| `tests/acceptance/gate-d-end-to-end.mjs` | 端到端验收 | ❌ 需要创建 |
| `styles/fs.css` | 样式：需要添加历史面板和来源模式样式 | ❌ |

---

## 六、已知风险与开放 Gap

1. **事务断裂**：`save_file_provenance` 未被 Gate C 提交流程自动调用。正文写入与来源创建之间无原子性。
2. **类型不匹配**：`saveFileProvenance` 的 TS 端输入格式与 Rust 端 `ProvenanceRecordInput` 结构体不完全匹配。需要在 `tauri-api.ts` 调整导出类型，或在 Rust 端新增一个简化的保存接口。
3. **Provenance 更新路径**：从 `ProvenanceRecord` 映射回 `ProvenanceRecordInput` 再调用 `save_file_provenance` 造成冗余转换。建议：
   - 方案 A：新增 `update_file_provenance` Rust 命令，接受完整的 `Vec<ProvenanceRecord>` 直接写入
   - 方案 B：修改 `save_file_provenance` 使其接受两种格式之一
4. **撤销后的来源恢复**：撤销恢复旧文件内容后，需要同时从快照重建来源记录。当前 `revert_ai_action` 只恢复文件内容，不处理来源。
5. **来源范围漂移**：用户在前文插入内容后，纯偏移的来源记录会漂移。当前使用 `textBlock` 作为锚点，但没有实现重新定位逻辑。
6. **上下文长度**：当前会话已处理大量代码，可能会出现注意力下降或状态混淆。建议在继续 Gate D-002 时开启新会话并从本 handoff 恢复。

---

## 七、恢复后的第一步

1. **切换到工作分支**：
```bash
cd G:/AI/Claude-Workspace/Projects/glyph
git checkout repair/gate-a-filesystem-first
```

2. **阅读 handoff**：
```bash
cat docs/reports/handoff-gate-d-002-20260724.md
```

3. **实现 Store action（优先级最高）**：
   - 打开 `stores/fsStore.ts`
   - 添加 `loadActionHistory`、`revertAction`、`loadProvenance`、`setSourceMode`、`runStartupRecovery`
   - 在 `commitAiWrite` 成功后钩入 provenance 创建
   - 在 `openFile` 成功后钩入 provenance 加载
   - 在 `openProject` 成功后钩入 startup recovery

4. **验证编译**：
```bash
npx tsc -b --force && npm run build
cargo check
```

5. **创建 UI 组件**并按依赖顺序集成

6. **运行验收**：
```bash
node tests/acceptance/gate-d-long-term-control.mjs
```

---

## 八、否决方向

- ❌ 不得重做 Gate A 编辑器
- ❌ 不得新增 AI 模型能力
- ❌ 不得另起一套历史/来源/撤销系统
- ❌ 不得把来源写入 Markdown
- ❌ 不得用前端内存替代持久数据
- ❌ 不得使用聊天记录冒充操作历史
- ❌ 不得为赶进度跳过冲突保护
