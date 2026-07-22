import type { FormatOperation } from './format-operation'

export interface ToolbarButton {
  id: string
  groupId: 'text-format' | 'block-elements' | 'insert' | 'history' | 'font-size'
  label: string
  tooltip: string
  shortcut: string | null
  ariaLabel: string
  operation: FormatOperation
  isToggle: boolean
  disabledWhen: 'never' | 'no-history' | 'no-redo' | 'no-node-selected'
  hasColorDot?: boolean
}

export interface ToolbarGroup {
  id: string
  label: string
  buttons: ToolbarButton[]
}

export interface ToolbarButtonStates {
  default: { background: string; color: string }
  hover: { background: string; color: string; tooltipDelay: string }
  active: { background: string; color: string; transform: string }
  activeToggle: { background: string; color: string; borderBottom: string }
  disabled: { opacity: string; cursor: string }
}

export const BUTTON_STATES: ToolbarButtonStates = {
  default: { background: 'transparent', color: 'var(--text-secondary)' },
  hover: { background: 'var(--accent-soft)', color: 'var(--accent-text)', tooltipDelay: '400ms' },
  active: { background: 'var(--accent)', color: '#ffffff', transform: 'scale(0.95)' },
  activeToggle: { background: 'var(--accent-soft)', color: 'var(--accent)', borderBottom: '2px solid var(--accent)' },
  disabled: { opacity: '0.35', cursor: 'not-allowed' }
}
