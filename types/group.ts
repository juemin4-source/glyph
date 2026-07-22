export interface Group {
  id: string
  projectId: string
  title: string
  nodeIds: string[]
  color?: string
  collapsed?: boolean
  createdAt: string
  updatedAt: string
}

export interface GroupVisualConfig {
  background: string
  border: string
  headerHeight: number
  headerFontSize: string
  headerColor: string
  collapsedBadgeBg: string
}

export const DEFAULT_GROUP_VISUAL_CONFIG: GroupVisualConfig = {
  background: 'rgba(85, 150, 246, 0.05)',
  border: '1px dashed rgba(85, 150, 246, 0.3)',
  headerHeight: 24,
  headerFontSize: '11px',
  headerColor: 'var(--text-muted)',
  collapsedBadgeBg: 'var(--accent-soft)'
}
