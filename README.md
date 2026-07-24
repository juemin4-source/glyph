# Glyph / 织梦机

本地文件优先的 AI 小说创作工作台。

当前候选版本为 **v0.4.4 Gate C UX 修复**：在保留 Gate C 单文件 AI 行动边界的同时，恢复可视化 / 源码 / 预览三种 Markdown 编辑方式、格式工具、选区浮动菜单和斜杠命令，并修正首页滚动区与窗口关闭。作者可以在真实 Markdown 项目中自由写作，让 AI 搜索、读取项目证据，并在明确范围内创建或修改一个 Markdown 文件。AI 生成与正式提交分离；修改前会建立快照，提交前会再次检查编辑器与磁盘版本，冲突时保留为未提交草稿。

Gate C 只允许单文件行动：新建文件、改写当前选区、在当前光标插入，以及用户明确要求时替换当前完整文件。删除、重命名、批量修改、项目外访问、来源显示与完整撤销界面仍不在本 Gate 范围内。

## 验收

```bash
npm run accept:gate-a
npm run accept:gate-b
npm run accept:gate-c
npm run test:gate-c
```

完整构建与 Rust 检查见 `CLAUDE.md`。
