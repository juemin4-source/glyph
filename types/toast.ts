export interface ToastConfig {
  message: string
  duration?: number
  position?: 'bottom-center'
  animation?: {
    fadeIn: { duration: number }
    hold: { duration: number }
    fadeOut: { duration: number }
  }
  maxVisible?: number
}

export const DEFAULT_TOAST_CONFIG: ToastConfig = {
  message: '',
  duration: 2000,
  position: 'bottom-center',
  animation: {
    fadeIn: { duration: 200 },
    hold: { duration: 2000 },
    fadeOut: { duration: 400 }
  },
  maxVisible: 1
}

export interface ResizableDividerConfig {
  defaultWidth: number
  minPanelWidth: number
  maxPanelRatio: number
  storageKey: string
  dividerWidth: number
  dividerHoverBg: string
}

export const DEFAULT_RESIZABLE_DIVIDER: ResizableDividerConfig = {
  defaultWidth: 420,
  minPanelWidth: 320,
  maxPanelRatio: 0.6,
  storageKey: 'novel-panel-sidepanel',
  dividerWidth: 4,
  dividerHoverBg: 'var(--accent)'
}

export interface PanelPersistenceEntry {
  storageKey: string
  default: boolean
  description: string
}

export const PANEL_PERSISTENCE_CONFIG: PanelPersistenceEntry[] = [
  { storageKey: 'novel-panel-nodelist', default: true, description: '节点列表面板（左侧）' },
  { storageKey: 'novel-panel-sidepanel', default: true, description: '侧边面板（右侧）' },
  { storageKey: 'novel-panel-minimap', default: true, description: 'Minimap' }
]
