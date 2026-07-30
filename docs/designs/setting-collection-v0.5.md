# 设定集 v0.5 — 设计文档

> 版本：v0.5-draft  
> 基线：织梦机 v0.4.7（Gate D complete）  
> 日期：2026-07-30  
> 设计依据：世界构件表（麻雀世界观表 + 天/地/人三分 + 题材机制表）  

---

## 一、设计目标

为织梦机建立一个**以世界观结构为骨架的设定集系统**，让：

1. 用户打开新项目时有引导（而非空白设定集）
2. AI 扫描正文后提取的设定有地方存放
3. 设定与正文双向关联（来源追踪）
4. 数据模型轻量但可扩展到 Craft Skill

---

## 二、数据模型

### 2.1 全局结构

一个项目在 `.glyph/canon/` 下有三类数据：

```
.glyph/canon/
├── schema.json           # 麻雀世界观（P0 必填项）
├── entities.json         # 实体索引
└── mechanisms/           # 题材机制表（v0.5 暂不实现）
    ├── truth.json
    ├── power.json
    └── ...
```

### 2.2 麻雀世界观 (SparrowSchema)

```typescript
// types/canon.ts — 新增，独立于旧的 types/world.ts

/** P0 骨架：每个新项目的第一批问题 */
interface SparrowSchema {
  version: 1;
  updatedAt: number;

  // P0-13 核心追问
  coreQuestion: string;           // 读者为什么继续看？
  aestheticSignature: string;     // 世界第一眼的气质
  coreMechanism: string;          // 核心异常/机制
  worldLack: string;              // 世界缺什么
  protagonistLack: string;        // 主角缺什么
  rulesAndCost: string;           // 允许什么/禁止什么/代价
  enforcer: string;               // 谁执行规则
  currentSituation: string;       // 为什么故事现在发生
  compressionField: string;       // 哪个点集中体现世界规则

  // P1 可选（但推荐填写）
  effectivePast?: string;         // 哪件旧事仍在影响现在
  supplySystem?: string;          // 世界靠什么维持
  identityQualifications?: string;// 谁有资格做什么
  faithAndTaboo?: string;         // 信仰与禁忌
  dailyInterface?: string;        // 普通人如何接触规则
}
```

**设计说明：**
- 9 个必填字段（P0），5 个可选（P1）
- 每个字段是自由文本（markdown 格式，100-500 字）
- 版本号仅用于未来的 schema 迁移
- 新项目创建时自动生成空白 schema，AI 扫描后建议填充内容

### 2.3 实体索引 (EntityIndex)

```typescript
type EntityType = '人物' | '地点' | '组织' | '物品';

type EntityStatus = '草稿' | '待验证' | '已确认' | '废弃';

type CanonLevel = '未收录' | '草案正典' | '项目正典' | '核心正典';

interface Entity {
  id: string;                  // uuid
  type: EntityType;
  name: string;
  aliases: string[];           // 别名/曾用名（AI 提取时自动建立）
  status: EntityStatus;
  canonLevel: CanonLevel;

  // 核心内容
  summary: string;             // 一句话描述（AI 提取或用户填写）
  detail: string;              // 详细描述（markdown，用户编辑）

  // 世界观关联
  schemaKeys: string[];        // 关联的 SparrowSchema 字段名
                               // 如 ["coreMechanism", "worldLack"]

  // 来源追踪（复用 Gate D provenance）
  sourceRefs: SourceRef[];     // 从哪些章节/段落提取的

  // 元数据
  tags: string[];
  referencesCount: number;     // 正文中出现的次数
  createdAt: number;
  updatedAt: number;
}

interface SourceRef {
  filePath: string;            // 来源文件路径（相对于项目根）
  textSnippet: string;         // 提取依据的原文片段
  offset: number;              // 在文件中的字符偏移
}
```

**与旧 WorldObject 的差异：**

| 维度 | WorldObject（v0.4） | Entity（v0.5） |
|------|-------------------|----------------|
| 类型 | 8 类（含章节/规则/术语） | 精简为 4 类 |
| 内容 | 单一 content 字段 | summary + detail 分层 |
| 关联 | 无结构关联 | schemaKeys 关联到世界观骨架 |
| 来源 | 无 | sourceRefs 追踪原文段落 |
| 优先级 | 无 | 通过 canonLevel 区分 |

**章节/规则/术语/事件的处理：**
- 章节 → 保持文件系统为主，不纳入实体索引
- 规则/机制 → 由 SparrowSchema 的 `coreMechanism`、`rulesAndCost` 覆盖
- 事件 → 第一阶段暂不纳入，后续通过题材机制表扩展
- 术语 → 用 tags 或 detail 字段覆盖即可

### 2.4 持久化文件格式

#### `.glyph/canon/schema.json`

```json
{
  "version": 1,
  "updatedAt": 1722345678000,
  "coreQuestion": "一个觉醒的人造人能否找到自己存在的意义？",
  "aestheticSignature": "冷色调金属与暖色血肉的对比，霓虹与阴影交错",
  "coreMechanism": "乐园机制——人造人的诞生、成长和功能限制由一套源代码控制",
  "worldLack": "这个世界缺乏'自我决定权'——人造人没有，底层人也没有",
  "protagonistLack": "主角缺乏'自己是谁'的答案",
  "rulesAndCost": "人造人不得离开指定区域，违者将被回收",
  "enforcer": "乐园管理委员会",
  "currentSituation": "乐园系统出现未预料的异常，主角在异常中觉醒",
  "compressionField": "灰楼——人造人聚居区，集中体现所有规则",
  "effectivePast": "三年前的一次实验事故，主角是唯一的幸存者",
  "supplySystem": null,
  "identityQualifications": null,
  "faithAndTaboo": null,
  "dailyInterface": null
}
```

#### `.glyph/canon/entities.json`

```json
{
  "version": 1,
  "updatedAt": 1722345678000,
  "entities": [
    {
      "id": "ent-001",
      "type": "人物",
      "name": "陈末",
      "aliases": ["末末"],
      "status": "已确认",
      "canonLevel": "核心正典",
      "summary": "一名觉醒的人造人",
      "detail": "陈末在培养舱异常中获得了自我意识。他不断追问自己的起源和目的……",
      "schemaKeys": ["protagonistLack", "coreMechanism"],
      "sourceRefs": [
        { "filePath": "正文/第1章.md", "textSnippet": "陈末把钥匙插进锁孔，拧了两下，门没开。", "offset": 0 }
      ],
      "tags": ["人造人", "觉醒者", "主角"],
      "referencesCount": 47,
      "createdAt": 1722345000000,
      "updatedAt": 1722345678000
    }
  ]
}
```

---

## 三、后端协议（Tauri IPC）

### 3.1 Rust 新文件

新增 `src-tauri/src/canon_commands.rs`，遵循现有 fs_commands.rs 的模式。

### 3.2 命令列表

| 命令 | 方向 | 功能 |
|------|------|------|
| `get_schema` | ← data | 读取 `.glyph/canon/schema.json` |
| `save_schema` | data → | 写入 `.glyph/canon/schema.json`（全量覆盖） |
| `list_entities` | ← data | 读取所有 entity |
| `get_entity` | ← data | 读取单个 entity |
| `save_entity` | data → | 创建/更新单个 entity |
| `delete_entity` | data → | 删除 entity |
| `scan_entities_from_project` | ← AI | 扫描项目文件，返回候选 entity 列表（AI） |

### 3.3 关键实现细节

**路径安全：** 复用 `resolve_project_path` + `safe_internal_directory` 模式，
所有操作限制在 `.glyph/canon/` 目录内。

**原子写入：** 使用与 fs_commands.rs 相同的 `atomic_create`（write .tmp → fs::rename）。

**scan_entities_from_project 不直接写入：**
- 扫描后返回候选列表（AI 分析结果）
- 用户在前端审核后，逐个调用 `save_entity` 确认写入
- 分离"AI 建议"和"正式写入"

### 3.4 TypeScript 绑定

在 `tauri-api.ts` 新增：

```typescript
// tauri-api.ts — 新增

export function getSchema(projectRoot: string): Promise<SparrowSchema> {
  return invoke('get_schema', { projectRoot });
}

export function saveSchema(projectRoot: string, schema: SparrowSchema): Promise<void> {
  return invoke('save_schema', { projectRoot, schema });
}

export function listEntities(projectRoot: string): Promise<Entity[]> {
  return invoke('list_entities', { projectRoot });
}

export function getEntity(projectRoot: string, entityId: string): Promise<Entity> {
  return invoke('get_entity', { projectRoot, entityId });
}

export function saveEntity(projectRoot: string, entity: Entity): Promise<Entity> {
  return invoke('save_entity', { projectRoot, entity });
}

export function deleteEntity(projectRoot: string, entityId: string): Promise<void> {
  return invoke('delete_entity', { projectRoot, entityId });
}

// AI 扫描，不直接写入
export function scanEntitiesFromProject(
  projectRoot: string,
  providerId: string,
): Promise<ScanCandidate[]> {
  return invoke('scan_entities_from_project', { projectRoot, providerId });
}
```

---

## 四、前端设计

### 4.1 设计语言对齐

设定集 UI 不创造新的设计语言，直接复用现有 token 系统（`styles/variables.css`）：

**直接复用的设计 token：**

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-canvas` / `--bg-surface` / `--bg-raised` | `#0a0a0a` / `#141414` / `#1e1e1e` | 背景层级 |
| `--accent` / `--accent-soft` / `--accent-hover` | `#B7FF00` / `rgba(183,255,0,0.1)` / `#c8ff33` | 主色调、选中态 |
| `--text-primary` / `--text-secondary` / `--text-muted` | `#e8e8e8` / `#a0a0a0` / `#6b6b6b` | 文字层级 |
| `--border-default` / `--border-hover` | `#2a2a2a` / `#444444` | 边框 |
| `--radius-sm` / `--radius-md` / `--radius-lg` | `4px` / `6px` / `8px` | 圆角 |
| `--space-1~10` | `4px` / `8px` / `12px` / `16px` / `24px` / `32px` / `40px` | 间距 |
| `--font-body` / `--font-mono` | system font stack / JetBrains Mono | 字体 |
| `--transition-fast` / `--transition-normal` | `0.15s ease` / `0.25s ease` | 动画 |

**复用已有的 UI 模式（不重新发明）：**

| 场景 | 复用的类 | 来源 |
|------|----------|------|
| 标签切换 | `.fs-ai-tab` / `.fs-ai-tab-active` | fs.css |
| 对话框/浮层 | `.fs-ai-provider-backdrop` / `.fs-ai-provider-dialog` | fs.css |
| 按钮 | `.fs-ai-revert-btn` 的 border+transparent+bg 模式 | fs.css |
| 列表项选中态 | `.setting-item.selected` → `background: #1a1a2e` | global.css |
| 空状态 | `.setting-preview .empty` → centered gray text | global.css |
| 进度/状态点 | `.fs-ai-phase-dot` → 6px circle | fs.css |

### 4.2 组件样式规格（新增）

新样式写入 `styles/fs.css`（不单独创建 canon.css），与现有 AI 面板样式同文件。

```
App.tsx
└── glyph-ai-sidebar
    ├── fs-ai-tabs
    │   ├── 当前任务 (FsAiPanel)
    │   ├── 历史 (AiHistoryPanel)
    │   └── 设定 ← 新增标签
    └── [设定内容]
        ├── SettingCanvas.tsx ← 新组件，世界观+实体的统一视图
        │   ├── SchemaSection.tsx    ← P0 问题表单
        │   └── EntityPanel.tsx      ← 实体列表+详情（基于现有 SettingCollection 改造）
        └── SettingScanDialog.tsx    ← AI 扫描候选确认弹窗
```

与 App.tsx 已有模式的差异：

```
当前任务 / 历史 → 纯标签切换，每个标签对应一个固定组件
设定 → 同样作为标签，右侧 AI 侧栏的第三个标签
```

### 4.3 状态管理

新增 `stores/canonStore.ts`（独立 store，不混入 fsStore）：

```typescript
interface CanonStore {
  // 数据
  schema: SparrowSchema | null;
  entities: Entity[];
  loading: boolean;
  error: string | null;

  // 操作
  loadSchema: () => Promise<void>;
  saveSchema: (schema: SparrowSchema) => Promise<void>;
  loadEntities: () => Promise<void>;
  saveEntity: (entity: Entity) => Promise<void>;
  deleteEntity: (entityId: string) => Promise<void>;

  // AI 扫描
  scanCandidates: ScanCandidate[];
  scanning: boolean;
  scanEntities: () => Promise<void>;
  acceptCandidate: (candidate: ScanCandidate) => Promise<void>;
  rejectCandidate: (candidateId: string) => void;
  confirmSelected: () => Promise<void>;
}
```

**设计说明：**
- 独立 store 而非塞进 fsStore，因为 canon 数据有独立的生命周期
- 不再使用 fsStore 那种 `emptyWorkspace()` + spread 的模式
- AI 扫描的结果（scanCandidates）存在内存中，确认后才写入磁盘

### 4.4 世界观标签页（SchemaSection）

用户路径：

```
第一次打开项目 →
  schema.json 为空 →
  SchemaSection 显示 P0 13 问 →
  用户可：
    a) 手动填写
    b) 点击"AI 自动分析"（基于已有正文分析）→ AI 填充草稿 → 用户确认修改
    c) 跳过（留空，不影响其他功能）

填写/修改后 → 自动保存到 .glyph/canon/schema.json
```

UI 布局：

```
╔══════════════════════════════════════════════════╗
║  世界观 · P0 骨架                                ║
║  [✕ 关闭]                                       ║
║                                                  ║
║  核心追问 ☰                                      ║
║  ┌──────────────────────────────────────────────┐║
║  │ 一个觉醒的人造人能否找到自己存在的意义？      │║
║  └──────────────────────────────────────────────┘║
║  [AI 分析]                                       ║
║                                                  ║
║  美学辨识度 ☰                                    ║
║  ┌──────────────────────────────────────────────┐║
║  │ 冷色调金属与暖色血肉的对比                  │║
║  └──────────────────────────────────────────────┘║
║  ...                                             ║
║                                                  ║
║  13/13 已填写  [另存为 Markdown]                  ║
╚══════════════════════════════════════════════════╝
```

每个字段：
- 左侧 P0/P1 标签 + 字段名
- 右侧多行文本框（自动增长高度）
- 字段下方小字提示"填写问题"（来自构件表）
- 右下角"AI 分析"按钮智能出现（仅对空白或含草稿标记的字段）

### 4.5 实体标签页（EntityPanel）

基于现有 `SettingCollection.tsx` 改造：

```
╔══════════════════════════════════════════════════╗
║  实体 · 世界观中出现的人物、地点、组织、物品      ║
║                                                  ║
║  [扫描项目 ▾] [全部 ▼] [全部 ▼]  搜索... 4个    ║
║                                                  ║
║  ┌──────────────────────────────────────────────┐║
║  │ 陈末 · 人物 · 已确认 · 核心正典 #主角        │║
║  │ 灰楼 · 地点 · 草稿   · 草案正典 #核心场景   │║
║  │ 乐园机制 · 组织 · 待验证· 项目正典           │║
║  │ 林琅 · 人物 · 草稿   · 草案正典 #配角       │║
║  └──────────────────────────────────────────────┘║
║                                                  ║
║  选中后在右侧展开详情（复用现有布局）             ║
╚══════════════════════════════════════════════════╝
```

差异点：
- "扫描项目"按钮替代旧版"套用模板"——触发 AI 扫描
- 过滤选项保持但调整：类型固定为 4 类 + 状态 + 正典等级
- 选中后的详情面板增加：关联的世界观字段、来源引用列表

### 4.6 AI 扫描对话框（SettingScanDialog）

```
╔══════════════════════════════════════════════════╗
║  AI 设定扫描                                      ║
║                                                  ║
║  扫描中... 正在分析第 3/12 章                     ║
║  ━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░ 45%           ║
║                                                  ║
║  ── 扫描完成后 ──                                ║
║                                                  ║
║  发现 6 个候选设定                                ║
║                                                  ║
║  ☐ 陈末 · 人物 · 第1、2、4章                    ║
║    "陈末把钥匙插进锁孔..."
║  ☐ 灰楼 · 地点 · 第1、2章                        ║
║    "灰楼的走廊永远亮着昏暗的灯..."
║  ☑ 乐园机制 · 组织 · 第1、2、3章                ║
║    "乐园机制维持着这一切..."
║  ⚠ 陈末的旧伤 · 第3章                           ║
║    "他的旧伤又发作了"——建议合并到"陈末"详情的"背景"部分
║  ...                                             ║
║                                                  ║
║  [全选] [确认 4 项]                              ║
╚══════════════════════════════════════════════════╝
```

### 4.7 来源追踪 UI

在实体详情中，底部新增"来源"区域：

```
来源引用（Gate D provenance 集成）
─────────────────────────────────────
📄 第1章.md · 第12-15行
> "陈末把钥匙插进锁孔，拧了两下，门没开。"

📄 第2章.md · 第89-91行
> "陈末的办公室在灰楼三层，窗外是永远的阴天。"

📄 第4章.md · 第201-203行
> "陈末站在走廊尽头，钥匙在手里转了两圈。"
  ─ 行为模式：压力下重复同一动作 ✓
```

- 每次 AI 扫描新增 sourceRef
- 用户手动编辑时也可手动添加来源
- 点击来源可直接跳转到对应文件（`onOpenFile`）

---

## 五、用户路径（User Flows）

### Flow 1：新项目 → 首次进入设定

```
用户创建新项目
  → 首次点击"设定"标签
  → 世界观区域为空，显示引导文案：
    "设定集帮助你构建和管理世界观骨架。先回答几个核心问题？"
  → [手动填写] / [AI 分析] / [稍后]
  → 填写 P0 后，实体区域同步更新建议的实体类型
```

### Flow 2：已有项目的初次扫描

```
用户打开已有项目（有正文但无 canon 数据）
  → 点击"设定"标签
  → 世界观为空，实体为空
  → 用户点击"扫描项目"
  → AI 扫描所有 .md 文件
  → 同时尝试从正文推断 P0 填充草稿
  → 弹出候选确认对话框
  → 用户确认/修改/拒绝
  → 正式写入 entities.json + schema.json
```

### Flow 3：持续写作中的增量更新

```
用户写了第 5 章
  → 设定标签右上角显示小红点：「2」
  → 用户点进去
  → 增量扫描提示：
    ✅ 陈末 · 出现 47 次（+12）
    ⚠ 小七 · 新人物 · 第5章首次出现
    ⚠ 灰楼 · 描述与第2章不一致（"灰楼的走廊"→"灰楼的大厅"）
  → 用户确认/忽略
```

### Flow 4：从实体跳转到正文

```
用户在实体列表中找到"陈末"
  → 点开详情，看到来源引用列表
  → 点击某条来源
  → 调用 onOpenFile -> 切换到编辑器 + 定位到该章节
  → 实体面板保持打开（或收起，取决于用户习惯）
```

### Flow 5：世界观 → 实体联动

```
用户补充了 coreMechanism
  → 实体区域提示：
    "你补充了'乐园机制'的核心机制。是否创建一个'乐园管理委员会'组织实体？"
  → [创建] / [忽略]
  → 创建后该实体自动关联 schemaKeys: ["coreMechanism"]
```

---

## 六、与现有系统的集成

### 6.1 与 Gate D provenance

- 每个 entity 的 `sourceRefs` 复用 provenance 的路径跟踪机制
- AI 提取时调用的 `listFileProvenance` 可以辅助判断哪些段落是 AI 写的
- 但 entity 本身不保存在 `.glyph/actions/` 下，而是独立的 `.glyph/canon/`
- entity 的修改记录不进入 action history（不是 AI 对正文的操作）

### 6.2 与 FsAiPanel

- "设定"作为 AI 侧栏的第三个标签页
- FsAiPanel 当前使用 `FsAiProviderDialog` 做模型配置——设定扫描也复用同一个 provider
- 扫描候选的 AI 调用复用 `runProjectAiTask` 的 provider 选择逻辑（不要重新实现模型选择）

### 6.3 与文件系统

- canon 数据目录 `.glyph/canon/` 应被 `.gitignore` 自动忽略（或由用户决定是否版本控制）
- 文件监控（watcher）需要排除 `.glyph/canon/` 的变更
- entity 的 `sourceRefs` 中的 `filePath` 使用与 `fsStore` 相同的标准化相对路径

### 6.4 与现有 SettingCollection 组件

- 保留 `SettingCollection.tsx` 但不直接使用
- 新建 `EntityPanel.tsx` 基于其 UI 模式但连接真实 store
- 后续可完全替换旧的 SettingCollection

---

## 七、实现顺序（施工计划）

### Phase 1：底座（下一步可开工）

| 项 | 依赖 | 估时 |
|----|------|------|
| Rust `canon_commands.rs`（schema + entity CRUD） | 无 | 半天 |
| `tauri-api.ts` 绑定 | Rust 完成 | 0.5h |
| `stores/canonStore.ts` | API 绑定 | 半天 |
| `SchemaSection.tsx`（世界观表单） | store | 半天 |
| `EntityPanel.tsx`（实体列表+详情） | store + 现有 SettingCollection | 半天 |
| App.tsx 第三标签接入 | 组件完成 | 0.5h |
| CSS 样式（追加到 `styles/fs.css`） | 组件 | 半天 |

**合计：约 3 天**（不含测试，测试另加约 1 天）

### 测试计划

| 文件 | 类型 | 预计测试数 | 路径 |
|------|------|-----------|------|
| Rust CRUD 文件格式检查 | Acceptance | 12 | `tests/acceptance/gate-e-canon-baseline.mjs` |
| canonStore action 测试 | Unit | 15 | `tests/unit/canonStore.test.ts` |
| SchemaSection + EntityPanel 渲染 | Unit (vitest+jsdom) | 8 | `tests/unit/SettingPanel.test.tsx` |

### Phase 2：AI 提取

| 项 | 依赖 | 估时 |
|----|------|------|
| Rust `scan_entities_from_project` | Phase 1 | 半天 |
| `SettingScanDialog.tsx` | Phase 1 | 半天 |
| 增量检测逻辑 | Phase 1 + 扫描 | 半天 |

**合计：约 2 天**

### Phase 3：深度集成

| 项 | 依赖 | 估时 |
|----|------|------|
| 世界观→实体联动提示 | Phase 1+2 | 半天 |
| Craft Skill 接入（CS-11 私诊断等） | Phase 1+2 | 待定 |

---

## 七.5 设计更新（来自 Engineering Review 2026-07-30）

以下修改已确认并入设计：

| 变更 | 来源 | 说明 |
|------|------|------|
| `scan_entities_from_project` 从 Rust 移除 | Architecture Issue 1 | 前端 store action 直接调 `runProjectAiTask` |
| `SchemaKey` 恢复为 `string[]` | Outside Voice | 字段名变更时同步成本高于编译检查收益 |
| `entities.json` 加版本号检测 | Outside Voice | `save_entity` 采用读-改-写+版本号模式避免数据竞争 |
| `get_schema` / `list_entities` 文件不存在时返回默认值 | Outside Voice | Rust 返回空白 schema 或空列表，不报错 |
| canonStore 加 `loadAll()` | Code Quality Issue | 一次性加载 schema + entities |
| P0 提示文字硬编码在 SchemaSection | Outside Voice | 字段提示来自构件表，不另做配置 |
| entities.json Phase 2 拆独立文件 | Architecture Issue 3 | 设计文档已注明，Phase 1 保持单文件 |

## 八、否决方向

- ❌ 不做"导入已有设定文档"的独立按钮——设定文档作为扫描分析对象之一
- ❌ 不把章节、事件、术语作为独立 entity 类型——由其他机制覆盖
- ❌ 不把 canon 数据混入 gate-d action history（它们是不同的东西）
- ❌ 不做画板/关系图——那个是单独的 Canvas 功能
- ❌ 在 Phase 1 不做设定间的关联（Connection）——需要时再扩展
- ❌ 不直接修改现有的 WorldObject 类型（等待完全替换再清理）
