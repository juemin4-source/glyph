# 织梦机 v1.2 团队技术约定

状态：立即生效
优先级：P0
适用范围：v1.2 所有实现工作

---

## 1. 命名约定

### 1.1 文件命名

| 层 | 规则 | 示例 |
|----|------|------|
| React 组件 | PascalCase, `.tsx` | `Bookshelf.tsx`, `DocumentView.tsx` |
| 非组件模块 | kebab-case, `.ts` | `tauri-api.ts`, `canvas-utils.ts` |
| 类型定义 | kebab-case, `.ts` | `world.ts`, `project.ts` |
| Rust 源码 | snake_case, `.rs` | `commands.rs`, `models.rs` |
| 样式 | kebab-case, `.css` | `variables.css`, `global.css` |
| 测试 | `*.test.tsx` 或 `*.test.ts` | `App.test.tsx`, `api.test.ts` |

### 1.2 组件命名

- 使用 PascalCase，与文件名一致
- 主组件使用 default export：`export default function Bookshelf`
- 辅助/内部组件使用 named export：`function BookCard`
- 通用/可复用组件使用 named export

### 1.3 函数命名

- React 回调：`handleXxx`（原生事件）或 `onXxx`（业务逻辑）
- API 函数：动词开头，camelCase：`listProjects`, `createWorldObject`
- IPC 命令：snake_case（Rust 端），camelCase 通过 serde 自动转换
- 状态更新回调：`onUpdateObject`, `onCreateObject`, `onDeleteObject`

### 1.4 IPC 命令命名

Rust 端（Tauri command 名）：

```
list_projects, get_project, create_project, update_project, delete_project
list_world_objects, create_world_object, get_world_object, update_world_object, delete_world_object
list_connections, create_connection, delete_connection
list_canvas_tab_states, save_canvas_tab_state, delete_canvas_tab_state
list_judgment_records, append_judgment_record
```

v1.2 新增命令：

```
ping                                   # P0-02 健康检查
export_project                         # P0-05 导出
import_project                         # P0-05 导入
```

### 1.5 类型命名

- UI 类型：PascalCase，`world.ts` 中定义：`WorldObject`, `Connection`, `CanvasTabState`
- DTO 类型：`XxxDTO`：`ProjectDTO`
- Props 接口：`XxxProps`：`BookshelfProps`, `DocumentViewProps`
- Row 类型（Rust 内部）：`XxxRow`：`WorldObjectRow`, `CanvasTabStateRow`

### 1.6 数据库字段命名

SQLite 列名：snake_case，通过 Rust serde `#[serde(rename_all = "camelCase")]` 映射到前端 camelCase。

| DB 列名 | Rust 字段 | 前端字段 |
|---------|-----------|---------|
| `project_id` | `project_id` | `projectId` |
| `canon_level` | `canon_level` | `canonLevel` |
| `references_count` | `references_count` | `referencesCount` |
| `selected_boards` | `selected_boards` | `selectedBoards` |
| `created_at` | `created_at` | `createdAt` |
| `updated_at` | `updated_at` | `updatedAt` |

---

## 2. 文件边界

### 2.1 前端文件职责

```
src/
├── types/world.ts          # 所有 UI 类型、常量、状态枚举
├── tauri-api.ts            # IPC 封装层，所有 Tauri invoke 调用集中于此
├── App.tsx                 # 根组件：状态持有、SyncManager、路由、布局
├── components/
│   ├── Bookshelf.tsx       # 书架视图（P2-01, P2-02, P2-03）
│   ├── DocumentView.tsx    # 文档编辑器（P1-03, P1-04, P1-05）
│   ├── CanvasView.tsx      # 画板视图（P1-06, P2-06, P2-07, P2-08, P2-09）
│   ├── Inspector.tsx       # 右侧对象详情面板
│   ├── DocOutline.tsx      # 左侧大纲面板
│   ├── SettingCollection.tsx  # 设定集视图
│   ├── JudgmentRecords.tsx # 判断记录视图
│   └── Toast.tsx           # Toast 通知
├── extensions/
│   └── WikiLink.ts         # TipTap WikiLink 扩展
├── utils/
│   ├── markdown.ts         # Markdown↔HTML 转换工具
│   └── canvas-utils.ts     # 画布工具函数
├── styles/
│   ├── global.css          # 全局样式
│   └── variables.css       # CSS 变量与主题定义
├── data/
│   └── seed.ts             # 模板预设数据
└── __tests__/              # 测试文件
```

### 2.2 v1.2 新增/修改文件

| 文件 | 角色 | 说明 |
|------|------|------|
| `src/lib/SyncManager.ts` | **NEW** | 同步管理器：队列、重试、在线检测 (P0-01, P0-02) |
| `src/lib/Changelog.ts` | **NEW** | 版本历史/撤销栈 (P0-03) |
| `src/hooks/useSaveStatus.ts` | **NEW** | 保存状态 hook (P1-05) |
| `src/hooks/useGlobalSearch.ts` | **NEW** | 全局搜索 hook (P1-08) |
| `src/components/CreationWizard.tsx` | **NEW** | 创作向导弹窗 (P1-01) |
| `src/components/FirstLaunchGuide.tsx` | **NEW** | 首次启动引导层 (P1-02) |
| `src/components/CanonGuideCard.tsx` | **NEW** | 正典引导卡片 (P1-07) |
| `src/components/StatusBar.tsx` | **NEW** | 底部状态栏 (P2-04) |
| `src/components/GlobalSearch.tsx` | **NEW** | 全局搜索组件 (P1-08) |
| `src/components/ZoomControls.tsx` | **NEW** | 画板缩放控件 (P1-06) |
| `src/components/ProjectSettingsDialog.tsx` | **NEW** | 作品编辑/删除对话框 (P2-02) |
| `src-tauri/src/commands.rs` | **MODIFY** | 新增 `ping`, `export_project`, `import_project` |
| `src-tauri/src/db.rs` | **MODIFY** | 新增导入/导出函数 |
| `src-tauri/src/lib.rs` | **MODIFY** | 注册新命令 |
| `src-tauri/src/models.rs` | **MODIFY** | 可能新增版本戳字段 |
| `src/App.tsx` | **MODIFY** | 集成 SyncManager、Changelog、saveStatus |
| `src/tauri-api.ts` | **MODIFY** | 新增 ping、export/import 函数 |
| `src/types/world.ts` | **MODIFY** | 新增 saveStatus 类型、ChangelogEntry 类型、CanonHandbook tab |
| `src/components/Bookshelf.tsx` | **MODIFY** | 搜索/筛选/排序/编辑/删除 (P2-01, P2-02) |
| `src/components/DocumentView.tsx` | **MODIFY** | Markdown-first, 合并工具栏, 自动保存 (P1-03, P1-04, P1-05) |
| `src/components/CanvasView.tsx` | **MODIFY** | 缩放, 框选, 拖拽重排, 布局锁定 (P1-06, P2-06, P2-07) |
| `src/components/Inspector.tsx` | **MODIFY** | selectedObject/currentObject 同步修复 |

### 2.3 后端文件职责

```
src-tauri/
├── lib.rs              # Tauri setup, command registration
├── main.rs             # Entry point
├── commands.rs         # All Tauri command handlers
├── db.rs               # SQLite CRUD operations
└── models.rs           # Data types (API + DB Row)
```

### 2.4 前端无操作区域

以下文件 v1.2 **不修改**（除非 file-locks 明确授权）：

- `src/components/SettingCollection.tsx`
- `src/components/JudgmentRecords.tsx`
- `src/components/Toast.tsx`
- `src/extensions/WikiLink.ts`（仅当 P2-05 WikiLink 创建后导航需要）
- `src/data/seed.ts`（仅模板数据扩展）

---

## 3. 状态管理原则

### 3.1 全局原则

```
App.tsx 持有所有业务状态
  ├── SyncManager 持有同步队列/在线状态
  ├── Changelog 持有撤销历史
  ├── saveStatus 保存状态（跨组件可见）
  └── 组件接收 props 并回调更新
```

**v1.2 强化：**

1. **SyncManager 是唯一的数据写入口** — 所有 `api.*` 调用必须通过 SyncManager 路由，禁止组件直接调用 `api.updateWorldObject`。
2. **selectedObject === currentObject** — 消除 Inspector 显示 selectedObject 而编辑器显示 currentObject 的 bug。统一为单一数据源。
3. **saveStatus 是全局状态** — 通过 React Context 或提升到 App.tsx 供 StatusBar 和编辑器同时使用。
4. **乐观更新规则** — 本地状态立即变更，后台同步失败时回滚并标记错误。不回滚 UI 状态，而是显示错误指示器让用户决策。

### 3.2 状态提升决策树

```
是否需要跨组件共享？
  ├── 是 → App.tsx 持有，通过 props 下发
  │   ├── 是否多个组件读取且写入？
  │   │   ├── 是 → App.tsx 回调
  │   │   └── 否 → useMemo/useRef 辅助
  │   └── 是否需要持久化？
  │       ├── 是 → 通过 SyncManager → Tauri API → SQLite
  │       └── 否 → 仅内存状态
  └── 否 → 组件内部 useState
```

### 3.3 SyncManager 契约

```typescript
interface SyncManager {
  enqueue<T>(operation: SyncOperation<T>): Promise<void>;
  getQueueLength(): number;
  isOnline(): boolean;
  onOnlineStatusChange(cb: (online: boolean) => void): void;
  getFailedCount(): number;
  retryFailed(): void;
  getSaveStatus(): SaveStatus;
  onSaveStatusChange(cb: (status: SaveStatus) => void): void;
}
```

### 3.4 Changelog 契约（P0-03）

```typescript
interface Changelog {
  push(entry: ChangelogEntry): void;
  undo(): ChangelogEntry | null;
  redo(): ChangelogEntry | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}

interface ChangelogEntry {
  timestamp: number;
  action: 'create_object' | 'delete_object' | 'update_object'
        | 'move_canvas_node' | 'create_connection' | 'delete_connection'
        | 'update_canvas_state';
  objectId: string;
  snapshot: Record<string, any>;
}
```

---

## 4. API/IPC 风格与错误处理

### 4.1 IPC 调用规范

- 所有 Tauri invoke 的前端封装在 `src/tauri-api.ts`
- 参数传递使用 named params 对象：`invoke('command_name', { param1, param2 })`
- Rust 端 Tauri command 统一返回 `Result<T, String>`
- 前端 Promise 通过 `.then()/.catch()` 处理

### 4.2 错误处理层级

```
操作层级：
  用户操作 → 乐观更新（前端立即生效）
           → SyncManager.enqueue()
           → 调用 tauri-api
           → 成功：从队列移除，更新 saveStatus
           → 失败：重试（3次指数退避）
                  → 最终失败：标记为失败
                            ，更新 saveStatus='error'
                            ，保留在队列中供手动重试
```

### 4.3 v1.2 新增 IPC 签名

```typescript
// P0-02: Health check
function ping(): Promise<string>;  // returns "pong"

// P0-05: Export
function exportProject(projectId: string, outputPath: string): Promise<ExportResult>;
interface ExportResult {
  success: boolean;
  path: string;
  objectCount: number;
  connectionCount: number;
}

// P0-05: Import
function importProject(inputPath: string): Promise<ImportResult>;
interface ImportResult {
  success: boolean;
  projectId: string;
  projectName: string;
  objectCount: number;
  connectionCount: number;
}

// P0-04: Save with version stamp
function saveCanvasTabState(
  state: CanvasTabState & { version: number }
): Promise<CanvasTabStateResponse>;
interface CanvasTabStateResponse {
  state: CanvasTabState;
  accepted: boolean;
  currentVersion: number;
  error?: 'VERSION_CONFLICT';
}
```

### 4.4 错误码前缀

Rust 端错误统一通过 `String` 传递，特定错误使用前缀标记：

```
"VERSION_CONFLICT: ..."  → 版本冲突
"NOT_FOUND: ..."         → 资源不存在
"IO_ERROR: ..."          → 文件 I/O 错误
其他                      → 通用错误
```

---

## 5. 测试约定

### 5.1 测试分层

| 层 | 工具 | 范围 | v1.2 新增 |
|----|------|------|-----------|
| 单元测试 | Vitest | 工具函数、SyncManager、Changelog | SyncManager.test.ts, Changelog.test.ts |
| 组件测试 | Vitest + Testing Library | 组件渲染和交互 | CreationWizard.test.tsx, StatusBar.test.tsx, GlobalSearch.test.tsx |
| 后端测试 | Rust `#[cfg(test)]` | db.rs CRUD | 导入/导出测试, 版本戳冲突测试 |
| E2E 测试 | Playwright | 关键用户流程 | v1.2 不做完整 E2E, 仅手动测试 |

### 5.2 v1.2 新增测试文件

```
src/__tests__/
├── SyncManager.test.ts      # 队列、重试、在线检测
├── Changelog.test.ts        # undo/redo 栈
├── CreationWizard.test.tsx  # 新建向导弹窗
├── StatusBar.test.tsx       # 保存状态指示器
└── GlobalSearch.test.tsx    # 全局搜索
```

### 5.3 测试前置条件

SyncManager 测试依赖 IndexedDB mock 和 Tauri invoke mock。

---

## 6. 复用优先原则

### 6.1 自研 vs 复用决策

| 需求 | 决策 | 理由 |
|------|------|------|
| Markdown 序列化 | 复用 `@tiptap/extension-markdown` | 与 TipTap 原生集成 |
| Markdown 语法高亮 | CodeMirror 6 + @codemirror/lang-markdown | 专业级编辑器，减少自研成本 |
| 全文搜索 | 前端自研模糊 + Fuse.js | 轻量级，无需后端集成 |
| 持久化队列 | IndexedDB + idb wrapper | 浏览器原生支持 |
| 拼音搜索 | pinyin-pro 库 | 中文场景特定需求 |
| 文件 zip | Rust `zip` crate | Tauri 后端原生 |
| undo/redo 栈 | 自研 | 数据结构简单 |

### 6.2 禁止自研

| 需求 | 禁止理由 | 替代方案 |
|------|---------|---------|
| 状态管理框架 (Redux/Zustand) | 当前模式可扩展 | 保持提升状态 + Context |
| CSS 框架 | 项目已用 CSS 变量 | 保持现有方案 |
| 构建工具替换 | Vite 6 已满足需求 | 不替换 |

### 6.3 第三方库引入决策

引入新依赖必须满足：
- 解决核心技术问题且自研成本 > 3 天
- 与现有技术栈兼容
- Bundle size < 50KB gzip（core functionality 除外）

---

## 7. 代码审查规则

### 7.1 提交前检查

- `[ ]` 新文件是否在 file-locks.yml 中声明
- `[ ]` IPC 命令是否在 commands.rs 和 tauri-api.ts 中对应
- `[ ]` serde rename_all 是否一致
- `[ ]` 乐观更新是否有对应的 SyncManager 操作
- `[ ]` 测试是否覆盖主路径和错误路径
- `[ ]` 无 console.log 遗留（console.error 允许用于错误报告）

### 7.2 Style Guide

- 遵循 TypeScript strict mode
- React 组件使用 function declaration + hooks
- 不使用 class component
- CSS 变量优先于内联 style
- Props 类型定义在组件文件顶部或独立类型文件
