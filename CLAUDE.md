# Glyph — AI-native Writing Platform

> 版本：v0.1
> 基线：从织梦机 v2 beta skeleton 重构，写作体验优先

## 产品定位

Glyph 是一款写作优先的 AI 辅助创作平台。

核心理念：**先有优秀的写作体验，再在上面加 AI 和方法论。** AI 是辅助，不是入口。

## 当前阶段

- **季节**：春生早段
- **状态**：v0.1 体验基线版（刚刚完成代码搬迁和改名）
- **核心任务**：把写作体验拉到可面世基线

## 目录结构

```
glyph/
├── App.tsx                    # 主入口（待重构为写作优先）
├── components/                # 通用 UI 组件
│   ├── ai/                    # AI 交互组件
│   ├── ui/                    # UI 原语
│   └── feedback/              # 反馈组件
├── features/                  # 功能模块
│   ├── canvas-01-premise/     # 前提卡（管线，待拆为可选）
│   ├── canvas-02-structure/   # 结构图
│   ├── canvas-03-setting/     # 设定集
│   ├── canvas-04-packet/      # 细纲包
│   ├── canvas-05-text/        # 正文编辑
│   ├── pipeline-nav/          # 管线导航
│   ├── pipeline-canvas/       # 管线画板壳
│   └── quick-draft/           # 快速速写
├── api/                       # Tauri 命令封装
├── lib/                       # 业务逻辑
│   └── ai/                    # AI 管线逻辑
├── stores/                    # Zustand 状态管理
├── types/                     # TypeScript 类型定义
├── contracts/                 # 接口契约
├── styles/                    # 全局样式
├── product/                   # 产品文档（历史）
├── scripts/                   # 构建/验收脚本
├── e2e/                       # Playwright 端到端测试
├── __tests__/                 # 单元测试
└── acceptance/                # 机器验收脚本
```

## 开发命令

```powershell
npm run dev        # 启动 dev server
npm run build      # TS 检查 + Vite 构建
npm run tauri      # Tauri CLI
npm test           # 运行 vitest 单元测试
cargo check        # Rust 编译检查
cargo tauri build  # 打包桌面应用
```

## 技术栈

- 前端：React 19 + TypeScript + Vite (Tiptap 编辑器, xyflow 画板, Zustand 状态管理)
- 桌面：Tauri 2 (Rust 后端)
- 数据：SQLite (rusqlite + bundled) + IndexedDB (同步队列)
- 测试：Vitest (单元), Playwright (E2E)

## 写作优先原则

1. **打开项目默认进入编辑器**，不经过管线
2. 管线（前提→结构→设定→细纲包→正文）是可选的高级模式
3. AI 是辅助，不是入口——所有 AI 功能在写作界面中以工具栏形式出现
4. 设定集在侧栏或独立面板，不阻塞写作

## 禁止改动区域

- `product/` 下为历史产品文档，当前不做修改
- `master-prototype/` 为设计原型，不做代码性修改
- 第三方依赖锁文件（package-lock.json, Cargo.lock）不经明确授权不得修改

## 当前非目标

- 方法论系统（八字六变/十二时位等）当前不做产品化
- BYOK（自定义 AI 模型接入）已移除，后续再评估
- 商业化/定价/订阅系统（v2.4 以后的规划）
