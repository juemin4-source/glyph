import { useState, useMemo, useCallback, useRef, type ReactNode, type DragEvent } from 'react';
import { Trash2, FileText, User, Lock, Search, Plus, ChevronRight, ChevronLeft, ChevronDown, Square, Hash, Globe } from 'lucide-react';
import type { WorldObject, ObjectType } from '../types/world';

interface HeadingItem {
  level: 1 | 2 | 3;
  text: string;
  lineNumber: number;
}

interface DocOutlineProps {
  allObjects: WorldObject[];
  currentObjectId: string | null;
  currentObjectContent?: string;
  onNavigate: (name: string, id?: string) => void;
  onCreateObject?: (templateType: ObjectType) => void;
  /** Glyph v0.1: Called when an outline item is dropped to reorder/nest */
  onReorderOutline?: (objectId: string, newParentId: string | null, newSortOrder: number) => void;
}

interface GroupConfig {
  key: string;
  label: string;
  icon: ReactNode;
  predicate: (obj: WorldObject) => boolean;
}

const GROUPS: GroupConfig[] = [
  { key: 'discarded', label: '废弃', icon: <Trash2 size={14} />, predicate: (o) => o.status === '废弃' },
  { key: 'draft', label: '草稿', icon: <FileText size={14} />, predicate: (o) => o.status === '草稿' },
  { key: 'chapter', label: '正文', icon: <FileText size={14} />, predicate: (o) => o.type === '章节' && o.status !== '废弃' && o.status !== '草稿' },
  { key: 'character', label: '人物', icon: <User size={14} />, predicate: (o) => o.type === '人物' && o.status !== '废弃' && o.status !== '草稿' },
  { key: 'setting', label: '设定', icon: <Globe size={14} />, predicate: (o) => ['地点', '组织', '规则/机制', '事件', '物品', '术语'].includes(o.type) && o.status !== '废弃' && o.status !== '草稿' },
];

function createTypeForGroup(groupKey: string): ObjectType {
  switch (groupKey) {
    case 'chapter': return '章节';
    case 'character': return '人物';
    case 'draft': return '事件';
    case 'discarded': return '事件';
    case 'setting': return '事件';
    default: return '事件';
  }
}

function statusIcon(status: string): ReactNode {
  switch (status) {
    case '锁定': return <Lock size={12} />;
    case '草稿': return <FileText size={12} />;
    case '待验证': return <Search size={12} />;
    case '待定': return <Search size={12} />;
    case '废弃': return <Trash2 size={12} />;
    case '占位': return <Square size={12} />;
    default: return <FileText size={12} />;
  }
}

/** Parse Markdown ATX headings (# ## ###) from content text */
function parseHeadings(content: string): HeadingItem[] {
  const lines = content.split('\n');
  const headings: HeadingItem[] = [];
  const re = /^(#{1,3})\s+(.+?)(?:\s+#{1,3})?$/;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(re);
    if (match) {
      const level = match[1].length as 1 | 2 | 3;
      const text = match[2].trim();
      if (text) {
        headings.push({ level, text, lineNumber: i });
      }
    }
  }
  return headings;
}

function HeadingOutline({ headings }: { headings: HeadingItem[] }) {
  if (headings.length === 0) return null;

  return (
    <div className="outline-group">
      <div className="outline-group-header">
        <Hash size={14} />
        <span className="outline-group-label" style={{ marginLeft: 6 }}>标题</span>
        <span className="outline-count">{headings.length}</span>
      </div>
      <div className="outline-items">
        {headings.map((h, idx) => (
          <div
            key={`h-${idx}-${h.lineNumber}`}
            className="outline-item outline-heading-item"
            title={`${h.text} (第 ${h.lineNumber + 1} 行)`}
            style={{ paddingLeft: 12 + (h.level - 1) * 16 }}
          >
            <span className="outline-item-name" style={{ fontSize: 12 - h.level * 0.5, fontWeight: h.level === 1 ? 600 : 400 }}>
              {h.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drag-and-drop helpers ──

/** Data attributes stored in drag event */
interface DragData {
  objectId: string;
  /** The group key this item was dragged from */
  groupKey: string;
}

const DRAG_DATA_TYPE = 'application/x-glyph-outline-item';

/**
 * Build a sorted tree from flat objects list.
 * Root items have parentId == null. Children are nested under their parent.
 */
function buildOutlineTree(objects: WorldObject[]): WorldObject[] {
  const childrenMap = new Map<string | null, WorldObject[]>();
  for (const obj of objects) {
    const pid = obj.parentId ?? null;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(obj);
  }
  // Sort each level by sort_order
  for (const [, children] of childrenMap) {
    children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }
  // Flatten the tree in display order (root items first, then recursively children)
  const result: WorldObject[] = [];
  function traverse(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId);
    if (!children) return;
    for (const child of children) {
      result.push(child);
      traverse(child.id, depth + 1);
    }
  }
  traverse(null, 0);
  return result;
}

/** Compute indent level for display purposes (not from parentId, since we flattened). */
function getIndentLevel(object: WorldObject, allObjects: WorldObject[]): number {
  let level = 0;
  let current: WorldObject | undefined = object;
  const visited = new Set<string>();
  while (current?.parentId) {
    if (visited.has(current.parentId)) break; // cycle guard
    visited.add(current.parentId);
    current = allObjects.find(o => o.id === current!.parentId);
    level++;
  }
  return level;
}

// ── Sub-components ──

function OutlineItem({
  object,
  indentLevel,
  isActive,
  hasChildren,
  onNavigate,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOverState,
}: {
  object: WorldObject;
  indentLevel: number;
  isActive: boolean;
  hasChildren: boolean;
  onNavigate: (name: string, id?: string) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, objectId: string, groupKey: string) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, objectId: string, zone: 'above' | 'below' | 'inside') => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>, targetId: string, zone: 'above' | 'below' | 'inside') => void;
  dragOverState: { targetId: string; zone: string } | null;
}) {
  const isDragOver = dragOverState?.targetId === object.id;
  const dropZone = isDragOver ? dragOverState!.zone : null;
  const baseLeftPad = 28; // base padding for root items
  const leftPad = baseLeftPad + indentLevel * 16;

  return (
    <div
      className={`
        outline-item-wrapper
        ${isActive ? 'active' : ''}
        ${dropZone === 'above' ? 'drop-above' : ''}
        ${dropZone === 'below' ? 'drop-below' : ''}
        ${dropZone === 'inside' ? 'drop-inside' : ''}
      `}
      draggable
      onDragStart={(e) => onDragStart(e, object.id, '')}
      onDragOver={(e) => onDragOver(e, object.id, 'inside')}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, object.id, 'inside')}
    >
      {/* Indent guide lines (vertical lines for tree depth) */}
      {indentLevel > 0 && (
        <div className="outline-indent-guides" style={{ left: 20 }}>
          {Array.from({ length: indentLevel }).map((_, i) => (
            <div key={i} className="outline-indent-guide" style={{ left: i * 16 + 8 }} />
          ))}
        </div>
      )}

      {/* Ghost drop zones for above/below insertion */}
      <div
        className="outline-drop-zone outline-drop-above"
        onDragOver={(e) => onDragOver(e, object.id, 'above')}
        onDrop={(e) => onDrop(e, object.id, 'above')}
      />
      <div
        className="outline-drop-zone outline-drop-below"
        onDragOver={(e) => onDragOver(e, object.id, 'below')}
        onDrop={(e) => onDrop(e, object.id, 'below')}
      />

      <div
        className={`outline-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: leftPad }}
        onClick={() => onNavigate(object.name, object.id)}
        title={object.name}
      >
        <span className="outline-item-status">{statusIcon(object.status)}</span>
        <span className="outline-item-name">{object.name}</span>
        {hasChildren && <ChevronDown size={10} className="outline-children-indicator" />}
      </div>
    </div>
  );
}

export default function DocOutline({ allObjects, currentObjectId, currentObjectContent, onNavigate, onCreateObject, onReorderOutline }: DocOutlineProps) {
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [dragOverState, setDragOverState] = useState<{ targetId: string; zone: string } | null>(null);
  const dragSourceRef = useRef<DragData | null>(null);
  const dragCounterRef = useRef(0); // For tracking nested enter/leave

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groups = useMemo(() => {
    return GROUPS
      .map(g => ({
        ...g,
        items: allObjects.filter(g.predicate),
      }))
      .filter(g => g.items.length > 0);
  }, [allObjects]);

  const headings = useMemo(() => {
    if (!currentObjectContent) return [];
    return parseHeadings(currentObjectContent);
  }, [currentObjectContent]);

  // ── Drag handlers ──
  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, objectId: string, _groupKey: string) => {
    dragSourceRef.current = { objectId, groupKey: _groupKey };
    e.dataTransfer.setData(DRAG_DATA_TYPE, JSON.stringify(dragSourceRef.current));
    e.dataTransfer.effectAllowed = 'move';
    // Slight opacity feedback
    const el = e.currentTarget as HTMLElement;
    setTimeout(() => { el.style.opacity = '0.4'; }, 0);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, _targetId: string, _zone: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverState({ targetId: _targetId, zone: _zone });
  }, []);

  const handleDragLeave = useCallback((_e: DragEvent<HTMLDivElement>) => {
    setDragOverState(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetId: string, zone: string) => {
    e.preventDefault();
    setDragOverState(null);
    // Reset source opacity
    const items = document.querySelectorAll('.outline-item-wrapper[draggable]');
    items.forEach(el => { (el as HTMLElement).style.opacity = '1'; });

    if (!onReorderOutline) return;
    const raw = e.dataTransfer.getData(DRAG_DATA_TYPE);
    if (!raw) return;
    let sourceData: DragData;
    try { sourceData = JSON.parse(raw); } catch { return; }
    if (!sourceData?.objectId || sourceData.objectId === targetId) return;

    const draggedObj = allObjects.find(o => o.id === sourceData.objectId);
    const targetObj = allObjects.find(o => o.id === targetId);
    if (!draggedObj || !targetObj) return;

    // Determine new parentId and sort_order based on drop zone
    let newParentId: string | null;
    let newSortOrder: number;

    const sameParent = (a: WorldObject, b: WorldObject): boolean =>
      (a.parentId ?? null) === (b.parentId ?? null);

    if (zone === 'inside') {
      // Drop inside target: make dragged item a child of target
      newParentId = targetId;
      // Count existing children of target to place at end
      const siblings = allObjects.filter(o => (o.parentId ?? null) === targetId && o.id !== sourceData.objectId);
      newSortOrder = siblings.length > 0 ? Math.max(...siblings.map(o => o.sortOrder ?? 0)) + 1 : 0;
    } else if (zone === 'above') {
      // Insert above target: same parent level, before target
      newParentId = targetObj.parentId ?? null;
      // Get all siblings at this level, sort by current sort_order
      const siblings = allObjects
        .filter(o => (o.parentId ?? null) === newParentId && o.id !== sourceData.objectId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const targetIdx = siblings.findIndex(o => o.id === targetId);
      if (targetIdx <= 0) {
        newSortOrder = 0;
      } else {
        newSortOrder = (siblings[targetIdx - 1]?.sortOrder ?? 0) + 1;
      }
    } else {
      // below: same parent level, after target
      newParentId = targetObj.parentId ?? null;
      const siblings = allObjects
        .filter(o => (o.parentId ?? null) === newParentId && o.id !== sourceData.objectId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const targetIdx = siblings.findIndex(o => o.id === targetId);
      if (targetIdx < 0 || targetIdx >= siblings.length - 1) {
        newSortOrder = (targetObj.sortOrder ?? 0) + 1;
      } else {
        newSortOrder = (siblings[targetIdx]?.sortOrder ?? 0) + 1;
      }
    }

    onReorderOutline(sourceData.objectId, newParentId, newSortOrder);
  }, [allObjects, onReorderOutline]);

  const handleDragEnd = useCallback(() => {
    dragSourceRef.current = null;
    setDragOverState(null);
    const items = document.querySelectorAll('.outline-item-wrapper[draggable]');
    items.forEach(el => { (el as HTMLElement).style.opacity = '1'; });
  }, []);

  return (
    <div className={`doc-outline ${panelCollapsed ? 'collapsed' : ''}`} onDragEnd={handleDragEnd}>
      <div className="doc-outline-header">
        {!panelCollapsed && <span className="doc-outline-title">大纲</span>}
        <button className="doc-outline-toggle-btn" onClick={() => setPanelCollapsed(!panelCollapsed)} title={panelCollapsed ? '展开大纲' : '收起大纲'}>
          {panelCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>
      {!panelCollapsed && (
        <div className="doc-outline-tree">
          {/* File-level object groups */}
          {groups.map(group => (
            <div key={group.key} className="outline-group">
              <div className="outline-group-header" onClick={() => toggleGroup(group.key)}>
                <span className="outline-toggle">{collapsedGroups[group.key] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</span>
                <span className="outline-group-icon">{group.icon}</span>
                <span className="outline-group-label">{group.label}</span>
                <span className="outline-count">{group.items.length}</span>
                {onCreateObject && (
                  <button
                    className="outline-add-btn"
                    title={`新建${createTypeForGroup(group.key)}`}
                    onClick={(e) => { e.stopPropagation(); onCreateObject(createTypeForGroup(group.key)); }}
                  ><Plus size={14} /></button>
                )}
              </div>
              {!collapsedGroups[group.key] && (
                <div className="outline-items">
                  {group.items.map(item => {
                    const indentLevel = getIndentLevel(item, allObjects);
                    const hasChildren = allObjects.some(o => (o.parentId ?? null) === item.id);
                    return (
                      <OutlineItem
                        key={item.id}
                        object={item}
                        indentLevel={indentLevel}
                        isActive={currentObjectId === item.id}
                        hasChildren={hasChildren}
                        onNavigate={onNavigate}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        dragOverState={dragOverState}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Markdown heading outline (current document) */}
          <HeadingOutline headings={headings} />

          {groups.length === 0 && headings.length === 0 && (
            <div className="outline-empty">
              <div style={{ marginBottom: 8 }}>暂无对象</div>
              {onCreateObject && (
                <button className="tb-btn primary" onClick={() => onCreateObject('章节')} style={{ fontSize: 12, padding: '6px 12px', margin: '0 auto' }}>
                  + 新建文档
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
