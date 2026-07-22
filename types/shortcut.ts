export interface KeyboardShortcut {
  keys: string
  scope: 'editor' | 'canvas' | 'global'
  action: string
  description: string
}

export const SHORTCUT_REGISTRY: KeyboardShortcut[] = [
  { keys: 'Ctrl+S', scope: 'editor', action: 'save', description: '保存当前节点' },
  { keys: 'Ctrl+Z', scope: 'editor', action: 'undo', description: '撤销' },
  { keys: 'Ctrl+Shift+Z / Ctrl+Y', scope: 'editor', action: 'redo', description: '重做' },
  { keys: 'Ctrl+B', scope: 'editor', action: 'bold', description: '加粗' },
  { keys: 'Ctrl+I', scope: 'editor', action: 'italic', description: '斜体' },
  { keys: 'Ctrl+K', scope: 'editor', action: 'link', description: '插入链接' },
  { keys: 'Ctrl+Shift+5', scope: 'editor', action: 'strikethrough', description: '删除线' },
  { keys: 'Ctrl+Shift+`', scope: 'editor', action: 'inline-code', description: '行内代码' },
  { keys: 'Ctrl+Shift+C', scope: 'editor', action: 'code-block', description: '代码块' },
  { keys: 'Ctrl+Shift+.', scope: 'editor', action: 'blockquote', description: '引用块' },
  { keys: 'Ctrl+Shift+7', scope: 'editor', action: 'ordered-list', description: '有序列表' },
  { keys: 'Ctrl+Shift+8', scope: 'editor', action: 'unordered-list', description: '无序列表' },
  { keys: 'Ctrl+=', scope: 'canvas', action: 'zoom-in', description: '画布放大' },
  { keys: 'Ctrl+-', scope: 'canvas', action: 'zoom-out', description: '画布缩小' },
  { keys: 'Ctrl+0', scope: 'canvas', action: 'fit-canvas', description: '适应画布' },
  { keys: 'Ctrl+F', scope: 'canvas', action: 'focus-search', description: '聚焦搜索栏' },
  { keys: 'Ctrl+A', scope: 'canvas', action: 'select-all-nodes', description: '全选节点' },
  { keys: 'Delete / Backspace', scope: 'canvas', action: 'delete-selected', description: '删除选中项' },
  { keys: 'Escape', scope: 'global', action: 'clear-state', description: '关闭菜单/清空搜索/取消连线模式' }
]
