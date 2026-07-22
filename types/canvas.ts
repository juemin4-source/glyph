export type NodeSizeMode = 'compact' | 'standard' | 'wide'

export const NODE_SIZE_DIMENSIONS: Record<NodeSizeMode, { width: number; height: number; textMaxWidth: number; textWrap: string }> = {
  compact: { width: 90, height: 28, textMaxWidth: 80, textWrap: 'ellipsis' },
  standard: { width: 120, height: 36, textMaxWidth: 110, textWrap: 'ellipsis' },
  wide: { width: 180, height: 42, textMaxWidth: 168, textWrap: 'wrap' }
}

export interface ZoomState {
  level: number
  minZoom: number
  maxZoom: number
  zoomStep: number
}

export const DEFAULT_ZOOM_STATE: ZoomState = {
  level: 1.0,
  minZoom: 0.2,
  maxZoom: 3.0,
  zoomStep: 1.3
}

export interface ZoomControlConfig {
  zoomLevel: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  zoomPercentage: string
}

export interface AutoLayoutConfig {
  name: 'cose'
  animate: boolean
  animationDuration: number
  fit: boolean
  padding: number
  nodeRepulsion: number
  idealEdgeLength: number
  gravity: number
  numIter: number
}

export const DEFAULT_AUTO_LAYOUT_CONFIG: AutoLayoutConfig = {
  name: 'cose',
  animate: true,
  animationDuration: 400,
  fit: true,
  padding: 50,
  nodeRepulsion: 12000,
  idealEdgeLength: 150,
  gravity: 0.2,
  numIter: 1000
}

export interface LayoutAnchorState {
  isRunning: boolean
  onStart: () => void
  onComplete: () => void
}

export interface MinimapConfig {
  enabled: boolean
  width: number
  height: number
  position: 'bottom-left'
  debounceMs: number
  viewportColor: string
  onToggle?: (visible: boolean) => void
}

export const DEFAULT_MINIMAP_CONFIG: MinimapConfig = {
  enabled: true,
  width: 160,
  height: 100,
  position: 'bottom-left',
  debounceMs: 33,
  viewportColor: 'rgba(255,255,255,0.15)'
}

export interface SearchFilterState {
  query: string
  typeFilters: string[]
  debounceMs: number
}

export const DEFAULT_SEARCH_FILTER_STATE: SearchFilterState = {
  query: '',
  typeFilters: [],
  debounceMs: 200
}

export interface EdgeBendPoint {
  edgeId: string
  index: number
  x: number
  y: number
  enabled: boolean
}

export interface EdgeLabelEditState {
  edgeId: string | null
  value: string
  position: { x: number; y: number } | null
}

export type LinkLineStyle = 'solid' | 'dashed' | 'dotted'

export interface LinkStyleConfig {
  lineStyle: LinkLineStyle
  width: number
  color: string
  dashPattern?: number[]
}

export const LINK_TYPE_STYLES: Record<string, LinkStyleConfig> = {
  timeline: { lineStyle: 'solid', width: 1.5, color: '#2e2e2e' },
  causality: { lineStyle: 'solid', width: 2.0, color: '#5596f6' },
  conflict: { lineStyle: 'dashed', width: 2.0, color: '#e94560', dashPattern: [6, 3] },
  emotion: { lineStyle: 'dotted', width: 1.5, color: '#ab47bc', dashPattern: [2, 2] },
  association: { lineStyle: 'dashed', width: 1.0, color: '#81c784', dashPattern: [4, 4] }
}
