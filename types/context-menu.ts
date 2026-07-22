export type ContextMenuType = 'node' | 'edge' | 'canvas'

export interface ContextMenuItem {
  id: string
  label?: string
  danger?: boolean
  divider?: boolean
  children?: ContextMenuItem[]
  icon?: string
}

export const PRESCRIBED_CONTEXT_MENU_ITEMS: Record<ContextMenuType, ContextMenuItem[]> = {
  node: [
    { id: 'edit-content', label: '编辑内容' },
    { id: 'copy-node', label: '复制节点' },
    { id: 'group', label: '编组/解组' },
    { id: 'pin-top', label: '置顶显示' },
    { id: 'divider-1', divider: true },
    {
      id: 'change-type',
      label: '节点类型',
      children: [
        { id: 'type:plot', label: '情节', icon: '#e94560' },
        { id: 'type:character_beat', label: '角色', icon: '#4fc3f7' },
        { id: 'type:twist', label: '转折', icon: '#ffb74d' },
        { id: 'type:foreshadow', label: '伏笔', icon: '#81c784' },
        { id: 'type:note', label: '笔记', icon: '#9b9b9b' }
      ]
    },
    {
      id: 'change-size',
      label: '节点大小',
      children: [
        { id: 'size:compact', label: '紧凑' },
        { id: 'size:standard', label: '标准' },
        { id: 'size:wide', label: '宽大' }
      ]
    },
    { id: 'divider-2', divider: true },
    { id: 'delete-node', label: '删除节点', danger: true }
  ],
  edge: [
    { id: 'edit-label', label: '编辑标签' },
    {
      id: 'change-link-type',
      label: '切换连线类型',
      children: [
        { id: 'link-type:timeline', label: '时间线' },
        { id: 'link-type:causality', label: '因果' },
        { id: 'link-type:conflict', label: '冲突' },
        { id: 'link-type:emotion', label: '情感' },
        { id: 'link-type:association', label: '关联' }
      ]
    },
    { id: 'reverse-direction', label: '反转方向' },
    { id: 'divider-1', divider: true },
    { id: 'delete-link', label: '删除连线', danger: true }
  ],
  canvas: [
    { id: 'add-node', label: '新建节点' },
    { id: 'paste-node', label: '粘贴节点' },
    { id: 'divider-1', divider: true },
    { id: 'select-all', label: '全选' },
    { id: 'fit-canvas', label: '适应画布' }
  ]
}
