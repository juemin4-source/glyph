# 织梦机 Slash Command + 双链 v0.6 — 设计文档

> **版本**：v0.6-draft  
> **基线**：v0.5.3（slash router MVP 已上线）  
> **日期**：2026-07-30  

---

## 一、设计目标

为织梦机建立**以命令为入口、以双链为组织方式**的交互模型，替代传统 UI 功能堆叠。

1. 用户通过 `/` 调用能力，不依赖菜单/按钮/标签页
2. `[[wiki链接]]` 在正文中可直接感知和操作
3. 第一个真实命令 `/整理` 跑通全链路

---

## 二、Slash Command 体系

### 2.1 当前架构（v0.5.3）

```
FsAiPanel.submit()
  ├── 以 / 开头 → runCommand(cmd, args, taskId)
  │     ├── /scan → scanProject → 返回结果到对话
  │     └── 未知 → "未知命令"
  └── 其他 → runProjectAiTask（正常 AI 对话）
```

### 2.2 v0.6 架构

```
FsAiPanel.submit()
  ├── 以 / 开头 → runCommand(cmd, args, taskId)
  │     ├── 内置命令表 (cmdMap)
  │     │     ├── /scan    → scanProject
  │     │     ├── /整理    → organizeWorld
  │     │     ├── /人物    → showEntity or createEntity
  │     │     └── /help    → 显示可用命令列表
  │     ├── 匹配到 → 执行 handler → 返回 markdown 结果
  │     └── 未匹配 → "未知命令 /xxx，输入 /help 查看可用命令"
  └── 其他 → runProjectAiTask（正常 AI 对话）
```

命令表和 handler 分离：

```typescript
// 命令注册表
const COMMANDS: Record<string, CommandDef> = {
  scan: {
    name: 'scan',
    label: '扫描项目',
    description: '从正文中提取人物、地点、组织、物品等设定',
    handler: handleScan,
  },
  整理: {
    name: '整理',
    label: '整理设定',
    description: '综合分析项目设定状态，给出整理建议',
    handler: handleOrganize,
  },
  人物: {
    name: '人物',
    label: '人物管理',
    description: '查看/创建/编辑人物设定。用法：/人物 陈末',
    handler: handleEntity,
  },
  help: {
    name: 'help',
    label: '帮助',
    description: '显示所有可用命令',
    handler: handleHelp,
  },
};
```

### 2.3 Handler 签名

```typescript
type CommandHandler = (args: string, task: { id: string; patch: (p: Partial<ProjectAiTaskCard>) => void }) => Promise<string>;
```

Handler 返回 markdown 字符串，直接渲染到 AI 对话中。这使得每个命令的产出天然可读、可复制。

---

## 三、/整理 命令（第一个真实命令）

### 3.1 行为

```
/整理
  → 1. 检查 Schema 完整度
       P0 9 个字段：已填 X/9
       未填字段列表：核心追问、美学辨识度…
  → 2. 检查实体数量
       现有实体 N 个（人物/地点/组织/物品）
       每个类型的分布
  → 3. 运行 AI 扫描（如果未扫描过）
       发现新候选 → 提示确认
  → 4. AI 分析
       世界观是否一致？
       当前已有的设定之间有关联吗？
       推荐下一步做什么？
  → 5. 返回综合报告（markdown）
```

### 3.2 输出示例

```
## 设定整理报告

### 📊 世界观骨架
P0 字段：5/9 已填写
- ✅ 核心机制：乐园机制
- ✅ 世界缺憾：自我决定权的缺失
- ❌ 核心追问：未填写
- ❌ 美学辨识度：未填写
- ❌ 执行人：未填写
- ❌ 当前局势：未填写
- ✅ 规则与代价：人造人不得离开指定区域
- ✅ 主角缺憾：缺少自我认知
- ✅ 压缩场：灰楼

### 📖 实体索引
共 3 个设定实体
- 人物：陈末（已确认·核心正典）
- 地点：灰楼（草稿·草案正典）
- 组织：乐园管理委员会（待验证）

### 💡 AI 建议
你的核心机制提到「乐园机制」，但没有定义「执行人」。
建议补充「执行人」字段，并考虑创建「执行者」组织实体。
```

### 3.3 实现方式

不调 AI 的部分直接走 store：
- Schema 完整度 → `useCanonStore.getState().schema`
- 实体数量 → `useCanonStore.getState().entities`

调 AI 的部分走现有 `callLlm`：
- 分析一致性和建议 → 一次 LLM 调用（带上 schema + entity 摘要）

---

## 四、[[双链]] 渲染

### 4.1 语法

```
简单格式：[[陈末]]
带类型：[[人物:陈末]]
带别名：[[陈末|主角]]
```

这三种格式在 markdown 源码中均可识别。预览/阅读时渲染为链接。

### 4.2 渲染位置

编辑器（FsDocumentView）有三种模式：

| 模式 | 双链行为 |
|------|----------|
| **源码 (source)** | `[[陈末]]` 保持原始文本，不做转换 |
| **预览 (preview)** | `[[陈末]]` 渲染为可点击的蓝色链接 |
| **可视化 (wysiwyg)** | `[[陈末]]` 渲染为可点击的蓝色链接（未来实现） |

**Phase 1 只做预览模式**，因为预览模式用的是 `markdownToEditorHtml`，只要在转换结果上加一步 `[[...]]` → HTML 链接的替换即可。

### 4.3 点击行为

点击双链 → 弹出实体卡片（浮层/Popover）：

```
┌─────────────────────────────┐
│ 陈末 · 人物 · 核心正典      │
│                             │
│ 一名觉醒的人造人。          │
│                             │
│ 📎 正文/第1章.md            │
│    "陈末把钥匙插进锁孔…"   │
│                             │
│ [查看详情 →]                │
└─────────────────────────────┘
```

实现方案：
1. `FsDocumentView` 在预览模式渲染完成后，给双链 DOM 元素绑定点击事件
2. 点击时读取 `data-entity-name` → `canonStore.getEntityByName()` → 展示 Popover
3. Popover 内容从 Entity 数据结构直接渲染（复用 EntityPanel 的 detail 逻辑）

### 4.4 实现路径（最小可行）

在 `markdownToEditorHtml` 的输出上做一次后处理替换：

```typescript
function renderWikiLinks(html: string): string {
  // 把 [[陈末]] 替换为 <a class="wiki-link" data-entity="陈末">陈末</a>
  // 把 [[人物:陈末]] 替换为 <a class="wiki-link" data-type="人物" data-entity="陈末">陈末</a>
  return html.replace(
    /\[\[([^\[\]]+?)\]\]/g,
    (match, inner) => {
      const parts = inner.split('|');
      const label = parts[1]?.trim() || parts[0].split(':').pop()?.trim() || inner;
      const typeAndName = parts[0].split(':');
      const type = typeAndName.length > 1 ? typeAndName[0].trim() : '';
      const name = (typeAndName.length > 1 ? typeAndName[1] : typeAndName[0]).trim();
      return `<a class="wiki-link" data-entity="${name}"${type ? ` data-type="${type}"` : ''}>${label}</a>`;
    }
  );
}
```

然后 FsDocumentView 监听点击：

```typescript
// 在预览容器上监听 wiki-link 点击
container.addEventListener('click', (e) => {
  const link = (e.target as HTMLElement).closest('.wiki-link');
  if (!link) return;
  const name = link.getAttribute('data-entity');
  // 查实体 → 显示 Popover
});
```

---

## 五、命令表

### 5.1 Phase 1 命令

| 命令 | Handler | 状态 |
|------|---------|------|
| `/scan` | scan → candidate list | ✅ 已有 |
| `/整理` | organize → comprehensive report | 🆕 本次实现 |
| `/人物 <name>` | entity query → detail card | 规划 |
| `/help` | list commands | 规划 |

### 5.2 未来命令

| 命令 | 功能 |
|------|------|
| `/世界观` | 展示/编辑 P0 schema |
| `/craft <CS-N> <target>` | 调用 Craft Skill 分析 |
| `/link <A> <B>` | 创建实体关联 |
| `/润色` | AI 改写选中段落 |
| `/扩写` | AI 续写 |

---

## 六、否决方向

- ❌ 不做独立的命令面板 UI（Cmd+K 风格）—— 先走 AI 面板输入框
- ❌ 编辑器内 `/` 触发命令菜单—— Phase 1 不做，避免与 markdown 列表语法冲突
- ❌ 不做全局命令注册表（Rust 后端）—— 前端 router 足够
- ❌ 双链不做实时解析（Obsidian 风格）—— 只在预览模式渲染，源码保持原始 `[[...]]`
- ❌ `[[...]]` 不做自动补全—— Phase 1 纯渲染，打字时敲 `[[` 不触发任何事
