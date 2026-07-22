# 织梦机 v2 全量代码审查报告

**审查官**: craft-reviewer (代码手艺审查官)
**审查日期**: 2026-07-09
**审查范围**: Round B / C / D / v2.0-H 全量实现代码
**关注优先级**: 正确性 > 安全性 > 结构 > 表达 > 演化

---

## 总体评估

| 维度 | 评级 | 概要 |
|------|------|------|
| 正确性 (craft-correctness) | B- | 两处 P0 阻断级缺陷，类型与运行时均存在缺口 |
| 安全性 (craft-safety) | B | 数据持久化设计良好，AI key 加密到位，但存在 panic 路径 |
| 结构 (craft-structure) | B | 协议分明，但文件过大、跨层耦合、两套 API 并存 |
| 表达 (craft-expression) | B+ | 命名清晰、注释充分，但存在 pinyin 错误提示和批量内联样式 |
| 演化 (craft-evolution) | B- | 泛化做得不错，但 Schema 迁移能力为零，硬编码假设较多 |

**拦截判断**: P0 问题有 2 个，建议在 v2.0-H 修复后再继续后续迭代。

---

## P0 — 阻断级 (必须立即修复)

### P0-1: Tauri `call_llm` 命令永远返回空结果

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/byok_commands.rs`
**行号**: 48-80

```rust
#[tauri::command]
pub async fn call_llm(...) -> Result<(), String> {
    // ...
    tokio::spawn(async move {
        llm_client::call_chat_completion_stream(app_handle, ...).await;
    });
    Ok(())  // <-- 立即返回 Ok(()), 不等待 AI 响应
}
```

**问题**: 返回类型是 `Result<(), String>`，但前端 `llm-client.ts` (第 57-73 行) 期望返回包含 `content`、`tokensIn`、`tokensOut` 的对象。后端立即 `Ok(())` 返回，意味着 Tauri 路径的 AI 聊天/生成功能**完全是坏的**——前端拿不到任何 AI 输出。

**影响**: 所有通过 Tauri invoke 调用 AI 的路径（AI Chat、TextCanvas AI 生成）都会收到空结果，但不会报错（因为返回的是 `Ok(())`，不是 `Err`），只会产生"AI 没有回应"的幻象。

**建议归属**: v2.0-H (立即修复)

**修复方向**: 将 `call_llm` 改为真正的 async 调用，等待 LLM 响应完成，将结果通过 Tauri event 或直接返回给前端。或者将 `call_llm_stream` 改造为前端 SSE 模式，不走 Tauri invoke 返回。

---

### P0-2: Rust StructureNode 缺少 `chapterFunction` 和 `line` 字段

**文件对比**:

**Frontend contract** (`G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/contracts/structure.contract.ts`, 第 31-33 行):
```typescript
export interface StructureNode {
  // ...
  chapterFunction?: ChapterFunction;  // Round C 新增
  line?: string;                       // Round C 新增
}
```

**Rust model** (`G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/models.rs`, 第 342-356 行):
```rust
pub struct StructureNode {
    pub id: String,
    pub project_id: String,
    pub parent_id: Option<String>,
    pub title: String,
    // ... 没有 chapterFunction 和 line 字段
}
```

**Rust Input types 也缺失**: `CreateStructureNodeInput` (第 358-370 行) 和 `UpdateStructureNodeInput` (第 372-384 行) 也没有这两个字段。

**DB Schema 也缺失**: `init_structure_nodes_table` (db.rs 第 1584-1603 行) 没有对应的列。

**影响**: 前端提交包含 `chapterFunction` 或 `line` 的 StructureNode 时，Rust 后端会将多余字段静默丢弃 (serde 默认行为)。数据从后端读回前端后，这两个字段永久丢失。

**建议归属**: v2.0-H (立即修复)

**修复方向**: 同步 Rust `models.rs` 三个 struct + SQL schema + 所有 CRUD 查询中的列列表。

---

## P1 — 高风险 (必须修复)

### P1-1: invoke 参数风格不一致 — 两套 API 协议共存

**文件**:
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/tauri-api.ts` — 使用**扁平参数**:
  ```typescript
  invoke('get_project', { id })  // 扁平，无 { input } 包裹
  ```
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/api/premiseApi.ts` 等 — 使用 **`{ input }` 包裹**:
  ```typescript
  invoke('create_premise_card', { input: stringifyCard(input) })
  ```

- **后端`commands.rs`** — 扁平参数:
  ```rust
  pub fn get_project(db: State<'_, Database>, id: String)  // 扁平
  ```
- **后端`premise_commands.rs`** — `{ input }` 结构:
  ```rust
  pub fn create_premise_card(db: State<'_, Database>, input: CreatePremiseInput)
  ```

**影响**: 违反了 `tauri-ai-programming.md` 的硬规则"所有 Tauri command 参数必须统一包在 `{ input }` 下"。新增开发者不知道该用哪种风格。`tauri-api.ts` 作为遗留层仍被新代码引用 (`projectApi.ts` 从它 re-export)。

**建议归属**: v2.0.1

---

### P1-2: `pipeline-helper.ts` 发送 `createdAt: 0` 给后端

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/stores/pipeline-helper.ts`
**行号**: 14, 33, 52, 74

```typescript
const ps = await savePipelineState({
    projectId,
    currentStage: 'structure',
    canvasStages: updatedStages,
    createdAt: 0,     // <-- 硬编码 0
    updatedAt: Date.now(),
});
```

**影响**: 虽然后端 `save_pipeline_state` (db.rs 第 1534-1561 行) 通过 `if rows == 0` 的 upsert 逻辑处理了这个问题，但 `createdAt` 永远为 0 会导致使用 `state.created_at` 的场景（比如前端显示创建时间）得到错误值。这是"前端靠后端补"的反模式。

**建议归属**: v2.0-H

---

### P1-3: `db.rs` 存在 Mutex 死锁风险

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/db.rs`
**涉及函数**: `list_world_objects` (第 226 行) 和 `get_world_object` (第 269 行)

虽然这两个函数已经通过"先释放锁再调子方法"的模式规避了直接死锁，但代码注释明确写着这是一个已知问题：

```rust
// NOTE: list_world_objects() and get_world_object() have a known
// deadlock: they hold the Mutex lock while calling
// get_judgment_records_for_object(), which also tries to lock.
// std::sync::Mutex is non-reentrant, so this deadlocks.
```

**影响**: `export_project_data()` (第 1185 行) 调用 `list_world_objects()` 时虽然不在显式持有锁，但 `list_world_objects` 自身会锁定/解锁两次。任何在未来不小心在持有锁的上下文中调用这些函数都会导致死锁。

**建议归属**: v2.0.1 (重构为 `tokio::sync::Mutex` 或使用 SQLite 连接池)

---

### P1-4: AI API Key 在前端直连时处于明文内存

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/lib/llm-client.ts`
**行号**: 84-85, 153-154

```typescript
headers: {
    'Authorization': 'Bearer ' + token,  // API key 在 JS 堆内存中
}
```

**影响**: 当 Tauri 后端不可用时（`!hasTauri`），`llm-client.ts` 使用 `fetch` 直接调用 LLM API。此时 API Key 存在于 JavaScript 堆内存中，可能被浏览器扩展、调试工具、内存 dump 泄露。BYOK (AES-256-GCM) 加密存储仅走 Tauri 路径时才生效。

**建议归属**: v2.0.1 (考虑在前端 fallback 路径中也做短暂加密，或提示用户开启 Tauri 后端)

---

### P1-5: 后端无输入验证 — 所有 string 字段无 sanitization

**文件**: 全部 `*_commands.rs` 和 `db.rs` CRUD 方法

**问题**: 后端命令接受任意的 `String` 值。例如：
- `premise_card.story_type` 按 contract 应该是 `'high_concept' | 'deep_drill' | 'character_driven' | 'world_driven' | ''`，但后端接受任意字符串
- `structure_node.node_type` 应为 `'book' | 'phase' | 'position' | 'chapter'`，后端无校验
- 所有文本字段无长度限制

**影响**: 数据库可能被写入无效数据，前端假设枚举值有限时会崩溃。

**建议归属**: v2.0.2

---

## P2 — 中风险 (建议修复)

### P2-1: 两套 API 层并存造成概念混乱

**文件**:
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/tauri-api.ts` (遗留层，扁平参数)
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/api/*Api.ts` (新协议层，{ input } 参数)
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/api/projectApi.ts` (混合层，从 tauri-api.ts re-export)

**问题**: `projectApi.ts` 名义上是新的 API 层，但实际上只是 `tauri-api.ts` 中 pipeline 函数的 re-export。App 中有多个模块直接 import 自 `tauri-api.ts`（如 `AIChat.tsx` 第 8 行 `import * as api from '../../tauri-api'`）。

**影响**: 新开发者不知道应该用哪个层，部分代码直接 import `tauri-api.ts`，部分用 `api/xxxApi.ts`。长期维护会出现"改了一个不改另一个"的问题。

**建议归属**: v2.1.0 (统一迁移到 `api/` 层，废弃 `tauri-api.ts`)

---

### P2-2: `db.rs` 文件过大 (~2800 行)

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/db.rs`

**问题**: 包含所有 10+ 实体类型的全部 CRUD 操作，每个 CRUD 函数 30-50 行，加上 schema 初始化、导出导入、测试用例。

**建议归属**: v2.0.1

**修复方向**: 按领域拆分：
- `db/mod.rs`
- `db/project.rs`
- `db/premise.rs`
- `db/structure.rs`
- `db/setting.rs`
- `db/pipeline.rs`
- `db/chapter_packet.rs`
- `db/decision_log.rs`

---

### P2-3: `models.rs` 文件过大 (~760 行)

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/models.rs`

**问题**: 所有类型定义（API struct、Input struct、Row struct）+ `to_api()` 方法集中在一个文件。

**建议归属**: v2.0.1

**修复方向**: 与 db 拆分同步，每个实体有自己的 `models/xxx.rs`。

---

### P2-4: CRUD 代码大规模重复

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/db.rs`

**问题**: 所有实体的 CRUD 几乎完全相同（SQL 调用模式 × 10+ 实体）。每次新增实体需要复制 ~100 行样板代码。例如 `list_*` 函数之间的差异只有 SQL 查询、表名和 struct 字段映射。

**建议归属**: v2.1.0 (考虑使用 Rust 宏或 trait 减少重复)

---

### P2-5: `AIChat.tsx` 文件过大 (~700 行)

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/components/ai/AIChat.tsx`

**问题**: 同时在单个文件中处理：
1. Markdown 解析渲染（`renderMarkdown`, `renderInline`, `renderFormatted` 等）
2. DocCard 提取（`extractDocCards`）
3. AI 对话状态管理
4. Sidebar/Outline 管理
5. 内联样式定义（全部用 style prop）
6. 模型选择器 Modal
7. 新对话确认 Modal

**建议归属**: v2.0.1

**修复方向**:
- Markdown 渲染器 → `lib/markdown-renderer.tsx`
- DocCard 提取 → `lib/doc-card-extractor.ts`
- Model Picker Modal → 独立组件

---

### P2-6: `AiSettings.tsx` 内联样式爆炸 (~400 行)

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/components/ai/AiSettings.tsx`

**问题**: 第 140-156 行定义了 12 个内联样式对象，然后在后面的 4 个 render 函数中大量引用。这导致：
- 样式不可被 CSS 覆盖
- 组件不可被主题系统管理
- 文件体积膨胀

**建议归属**: v2.0.2

---

### P2-7: `llm-client.ts` 中混杂英文和中文拼音错误消息

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/lib/llm-client.ts`
**行号**: 96-98

```typescript
if (response.status === 401) throw new LlmError('auth_failed', 'API Key ren zheng shi bai');
if (response.status === 429) throw new LlmError('rate_limited', 'Qing qiu pin lu guo gao');
if (response.status >= 500) throw new LlmError('server_error', 'Fu wu duan cuo wu (' + response.status + ')');
throw new LlmError('unknown', 'Qing qiu shi bai (' + response.status + ')');
```

**问题**: 处于"半英半中拼音"状态——英文 API 的 status text 混用 `pinyin` 而非中文汉字。非中文开发者看不懂，中文开发者看着别扭。

同时，同一个文件中第 168-170 行又用了中文汉字：
```typescript
if (response.status === 429) throw new LlmError('rate_limited', '请求频率过高');
```

**建议归属**: v2.0-H (统一为中文或英文)

---

### P2-8: Type 定义碎片化

**文件**:
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/types/` — 15 个类型文件
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/contracts/` — 6 个 contract 文件
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/types/v03/` — 3 个遗留类型
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/types/` — 2 个全局类型定义 (draft.ts, setting-card.ts)

**问题**:
- `projectApi.ts` 在 API 层重新定义了 `ProjectDTO`（`tauri-api.ts` 第 17-25 行），与 `contracts/project.contract.ts` 中的 `PipelineState` 类型风格不一致
- `types/world.ts` 中的 `WorldObject` 与后端 `models.rs` 的 `WorldObject` 字段映射没有集中检查点
- 分层意图不清：`types/` vs `contracts/` 的边界模糊

**建议归属**: v2.1.0

---

## P3 — 低风险 (建议改进)

### P3-1: `generateDraft.ts` 大量使用 `any` 类型

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/lib/generateDraft.ts`
**行号**: 40-43, 70-131 (多处)

```typescript
const l1: any = safeLayer(packet.layer1, {});
const l2: any = safeLayer(packet.layer2, {});
```

**问题**: `safeLayer` 返回 `T`，但调用处全用 `any` 接收，后续直接访问 `.characters`、`.scenes`、`.narrativeDistance` 等属性。这些本应使用 contract 中定义的 `WritingContract`、`ActiveContext`、`NarrativeCompression`、`ExecutionLayer` 接口进行类型化。

**建议归属**: v2.0.2

---

### P3-2: 前端硬编码 LLM 模型列表

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/types/ai.ts`
**行号**: 108-117

**问题**: `DEFAULT_MODELS` 是硬编码的。如果后端支持不同模型，前端需要手动更新列表。没有从后端发现可用模型的机制。

**建议归属**: v2.1.0

---

### P3-3: 数据库 Schema 无版本迁移系统

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/db.rs`

**问题**: 全部使用 `CREATE TABLE IF NOT EXISTS`，没有 `ALTER TABLE` 迁移。Schema 变更（如向 `structure_nodes` 加列）需要手动处理。如果用户升级后打开旧数据库，迁移不会自动发生。

**建议归属**: v2.0.2 (引入 schema_version 表 + 渐进式迁移函数)

---

### P3-4: `unwrap()` 调用可能导致生产 Panic

**文件**:
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/lib.rs` 第 22 行: `app.path().app_data_dir().expect(...)`
- `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src-tauri/src/db.rs` 多处: `.lock().unwrap()`

**问题**: Mutex 被 poison 后 `unwrap()` 会 panic 并杀死整个 Tauri 进程。初始化时的 `expect` 虽然启动时失败可以接受，但运行时 Mutex poison 应该优雅降级。

**建议归属**: v2.0.2

---

### P3-5: 前端 PipelineStore `createdAt` 和 `updatedAt` 被忽略

**文件**: `G:/AI/Chancellor-OS-Lab/projects/zhimengji/src/stores/projectStore.ts`

**问题**: Store 中没有存储 `createdAt` 和 `updatedAt`，虽然 contract 中定义了两者。意味着前端无法判断上次同步时间。

**建议归属**: v2.0.2

---

### P3-6: Underscore import 风格不一致

**文件**: 多处

**问题**: `AIChat.tsx` 同时使用 `import * as api from '../../tauri-api'` 和直接 import `callLlmStream`。同一文件中两种 import 风格混用。

**建议归属**: v2.0.1

---

## 正面发现

1. **Contract-first 设计**: `src/contracts/` 目录的设计模式正确，前后端类型分离清晰
2. **JSON 数组序列化模式**: SQLite 中使用 `TEXT` 列存储 JSON 数组 + API 层自动转换的模式很成熟（premiseApi 的 `parseCard`/`stringifyCard`、settingApi 的 `parseFactionCard`/`stringifyFactionInput`）
3. **BYOK 加密实现**: AES-256-GCM + 内存缓存 + master key 管理的安全设计扎实
4. **Pipeline 状态机**: 五画板流转设计清晰，`pipeline-helper.ts` 的链式推进逻辑易懂
5. **Mutex 死锁注释**: `db.rs` 第 2081-2083 行的注释主动标注了已知的死锁风险，帮助后续维护者理解
6. **gate 设计**: Gate 模式的 Pipeline 流转（premise→structure→setting→packet→text）结构合理
7. **AI 输出三态**: `ai-output.ts` 的 `discuss | suggest | write_preview` 三态设计清晰

---

## 分级汇总

| 严重度 | 数量 | 关键问题 |
|--------|------|----------|
| P0 | 2 | `call_llm` 返回空、StructureNode 缺字段 |
| P1 | 5 | invoke 参数不一致、createdAt=0、Mutex 死锁风险、API key 明文、无输入验证 |
| P2 | 8 | 两套 API 层、db.rs/models.rs 过大、CRUD 重复、AIChat.tsx 过大、内联样式爆炸、拼音消息、类型碎片化 |
| P3 | 6 | any 类型滥用、硬编码模型列表、无 Schema 迁移、unwrap panic、store 缺时间字段、import 风格不一致 |

**建议优先级顺序**: P0 → P1 → (P2 ∩ 影响当前 Round) → P3

---

## 文件级代码质量评分

| 文件 | 行数 | 质量评级 | 关键问题 |
|------|------|---------|---------|
| `contracts/structure.contract.ts` | 69 | A | 设计清晰，但后端实现不完整 |
| `contracts/chapter-packet.contract.ts` | 186 | A | 四层设计出色，文档详尽 |
| `api/premiseApi.ts` | 58 | A | 模式统一，JSON 转换封装到位 |
| `api/settingApi.ts` | 112 | A- | FactionCard JSON 转换稍显冗余 |
| `api/chapterPacketApi.ts` | 38 | A- | 简洁但缺少 ListPacketsInput 使用 |
| `tauri-api.ts` | 153 | C | 遗留层，参数风格不兼容新协议 |
| `stores/projectStore.ts` | 45 | A- | 简单干净，但缺时间字段 |
| `stores/pipeline-helper.ts` | 83 | B | createdAt:0 是脆弱点 |
| `lib/llm-client.ts` | 246 | B- | 拼音错误 + 流式与 invoke 返回不匹配 |
| `lib/generateDraft.ts` | 161 | B | any 滥用，应使用合同类型 |
| `lib/ai-output.ts` | 30 | A | 完美，简洁清晰 |
| `features/PremiseEntryGate.tsx` | 315 | A- | 逻辑完整，状态覆盖到位 |
| `features/SettingCanvasV2.tsx` | 65 | A | 简洁三栏布局，职责清晰 |
| `features/CharacterPanel.tsx` | 180 | A- | CRUD 干净，缺错误反馈 |
| `features/TextCanvas.tsx` | 296 | B+ | 布局合理，但 alert() 使用不合适 |
| `features/PipelineNav.tsx` | 230 | A- | 设计美观，过度内联样式 |
| `components/ai/AIChat.tsx` | 700 | C+ | 过大，职责过多，应拆分 |
| `components/ai/AiSettings.tsx` | 395 | C+ | 内联样式爆炸，维护困难 |
| `src-tauri/src/db.rs` | 2838 | C | 文件过大，CRUD 大量重复 |
| `src-tauri/src/models.rs` | 760 | C+ | 应拆分为多个领域模块 |
| `src-tauri/src/commands.rs` | 253 | B | 遗留层，使用扁平参数 |
| `src-tauri/src/premise_commands.rs` | 47 | A | 简洁标准 |
| `src-tauri/src/setting_commands.rs` | 136 | A | 模式统一 |
| `src-tauri/src/chapter_packet_commands.rs` | 56 | A | 标准模式 |
| `src-tauri/src/decision_log_commands.rs` | 30 | A | 简洁 |
| `src-tauri/src/pipeline_commands.rs` | 22 | A | 极简 |
| `src-tauri/src/byok/key_manager.rs` | 262 | A- | 加密实现在线，但 `strftime` 精度秒级不够 |
| `src-tauri/src/byok_commands.rs` | 94 | C+ | `call_llm` 返回类型错误 |
| `src/components/ui/index.ts` | - | B+ | UI 组件目录是好的模式 |

---

## 重点文件摘要

### 跨层字段一致性检查

| 字段 | Frontend Contract | Rust Model | DB Column | 状态 |
|------|------------------|------------|-----------|------|
| structureNode.chapterFunction | 存在 (可选) | 缺失 | 缺失 | **P0-2** |
| structureNode.line | 存在 (可选) | 缺失 | 缺失 | **P0-2** |
| chapterPacket.line | 存在 (可选) | 存在 | 存在 | 一致 |
| premiseCard.readerQuestions | string[] | String (JSON) | TEXT | 通过 API 转换 |
| factionCard.resources | string[] | String (JSON) | TEXT | 通过 API 转换 |
| decisionLogEntry.entityType | string? | Option<String> | TEXT | 一致 |
| decisionLogEntry.details | string? | Option<String> | TEXT | 一致 |

### invoke 命名风格对照

| 模块 | 参数风格 | 后端匹配 |
|------|---------|---------|
| `tauri-api.ts` (遗留) | 扁平 `{ id }` | `commands.rs` 扁平参数 |
| `api/*Api.ts` (新) | `{ input }` 包裹 | `*_commands.rs` input 结构 |
| **结论**: 不一致，需统一 | | |

---

## 版本建议归属矩阵

| 版本 | 应修复的问题 |
|------|------------|
| **v2.0-H** | P0-1 (call_llm), P0-2 (StructureNode 缺字段), P1-2 (createdAt=0), P2-7 (拼音消息) |
| **v2.0.1** | P1-1 (invoke 参数), P1-3 (Mutex), P1-4 (API key), P2-2 (db.rs拆分), P2-3 (models.rs拆分), P2-5 (AIChat拆分), P3-6 (import风格) |
| **v2.0.2** | P1-5 (输入验证), P2-6 (内联样式), P3-1 (any类型), P3-3 (Schema迁移), P3-4 (unwrap), P3-5 (store时间字段) |
| **v2.1.0** | P2-1 (统一API层), P2-4 (CRUD宏), P2-8 (类型碎片化), P3-2 (模型发现) |
| **Later** | — |

---

*审查结束。以上报告已写入 `docs/reports/code-review-report.md`。*
