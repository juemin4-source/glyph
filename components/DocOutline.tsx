import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
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

// ── 拖拽层级工具 ──

/** Compute indent level by following parentId chain. */
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
  onMouseDown,
}: {
  object: WorldObject;
  indentLevel: number;
  isActive: boolean;
  hasChildren: boolean;
  onNavigate: (name: string, id?: string) => void;
  onMouseDown?: (e: ReactMouseEvent, objectId: string) => void;
}) {
  const baseLeftPad = 28;
  const leftPad = baseLeftPad + indentLevel * 16;

  return (
    <div
      className={`outline-item-wrapper ${isActive ? 'active' : ''}`}
      data-item-id={object.id}
      onMouseDown={(e) => onMouseDown?.(e, object.id)}
    >
      {/* Indent guide lines */}
      {indentLevel > 0 && (
        <div className="outline-indent-guides" style={{ left: 20 }}>
          {Array.from({ length: indentLevel }).map((_, i) => (
            <div key={i} className="outline-indent-guide" style={{ left: i * 16 + 8 }} />
          ))}
        </div>
      )}

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

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groups = useMemo(() => {
    return GROUPS
      .map(g => ({
        ...g,
        items: allObjects.filter(g.predicate).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      }))
      .filter(g => g.items.length > 0);
  }, [allObjects]);

  const headings = useMemo(() => {
    if (!currentObjectContent) return [];
    return parseHeadings(currentObjectContent);
  }, [currentObjectContent]);

  // ── 鼠标拖拽（替代 HTML5 DnD，绕过 WebView2 兼容问题）──
  const dragState = useRef<{
    sourceId: string;
    startY: number;
    sourceTop: number;
    clone: HTMLElement | null;
  } | null>(null);

  const handleItemMouseDown = useCallback((e: ReactMouseEvent, objectId: string) => {
    // 只响应左键
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.4';
    el.classList.add('dragging');
    dragState.current = {
      sourceId: objectId,
      startY: e.clientX,
      sourceTop: e.clientY,
      clone: null,
    };
  }, []);

  // 文档级 mouse move/up 监听（拖拽期间）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;

      // 找到鼠标下的 outline-item-wrapper
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const wrapper = el?.closest?.('.outline-item-wrapper') as HTMLElement | null;
      const targetId = wrapper?.dataset?.itemId;

      if (targetId && targetId !== ds.sourceId) {
        const rect = wrapper!.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const h = rect.height;
        let zone: string;
        if (y < h * 0.25) zone = 'above';
        else if (y > h * 0.75) zone = 'below';
        else zone = 'inside';

        // 高亮目标
        document.querySelectorAll('.outline-item-wrapper.drop-above, .outline-item-wrapper.drop-below, .outline-item-wrapper.drop-inside').forEach(el => {
          el.classList.remove('drop-above', 'drop-below', 'drop-inside');
        });
        wrapper!.classList.add(`drop-${zone}`);
      } else {
        document.querySelectorAll('.outline-item-wrapper.drop-above, .outline-item-wrapper.drop-below, .outline-item-wrapper.drop-inside').forEach(el => {
          el.classList.remove('drop-above', 'drop-below', 'drop-inside');
        });
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      dragState.current = null;

      // 恢复样式
      document.querySelectorAll('.outline-item-wrapper.dragging').forEach(el => {
        el.classList.remove('dragging');
        (el as HTMLElement).style.opacity = '1';
      });
      document.querySelectorAll('.outline-item-wrapper.drop-above, .outline-item-wrapper.drop-below, .outline-item-wrapper.drop-inside').forEach(el => {
        el.classList.remove('drop-above', 'drop-below', 'drop-inside');
      });

      // 最小拖动距离检查（防止点了一下就触发）
      const dist = Math.sqrt((e.clientX - ds.startY) ** 2 + (e.clientY - ds.sourceTop) ** 2);
      if (dist < 10) return;

      if (!onReorderOutline) return;

      // 找目标
      const targetEl = document.elementFromPoint(e.clientX, e.clientY);
      if (!targetEl) return;
      const wrapper = targetEl.closest?.('.outline-item-wrapper') as HTMLElement | null;
      if (!wrapper) return;
      const targetId = wrapper.dataset.itemId;
      if (!targetId || targetId === ds.sourceId) return;

      const draggedObj = allObjects.find(o => o.id === ds.sourceId);
      const targetObj = allObjects.find(o => o.id === targetId);
      if (!draggedObj || !targetObj) return;

      // 计算落区
      const r = wrapper.getBoundingClientRect();
      const y = e.clientY - r.top;
      const h = r.height;
      const zone = y < h * 0.25 ? 'above' as const : y > h * 0.75 ? 'below' as const : 'inside' as const;
      let newParentId: string | null;
      let newSortOrder: number;

      if (zone === 'inside') {
        newParentId = targetId;
        const siblings = allObjects.filter(o => (o.parentId ?? null) === targetId && o.id !== ds.sourceId);
        newSortOrder = siblings.length ? Math.max(...siblings.map(o => o.sortOrder ?? 0)) + 1 : 0;
      } else {
        newParentId = targetObj.parentId ?? null;
        const siblings = allObjects.filter(o => (o.parentId ?? null) === newParentId && o.id !== ds.sourceId)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const idx = siblings.findIndex(o => o.id === targetId);
        newSortOrder = zone === 'above'
          ? (idx <= 0 ? 0 : (siblings[idx - 1]?.sortOrder ?? 0) + 1)
          : (idx < 0 || idx >= siblings.length - 1 ? (targetObj.sortOrder ?? 0) + 1 : (siblings[idx]?.sortOrder ?? 0) + 1);
      }

      onReorderOutline(ds.sourceId, newParentId, newSortOrder);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [allObjects, onReorderOutline]);

  // 容器级别 dragover 拦截
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div
      className={`doc-outline ${panelCollapsed ? 'collapsed' : ''}`}
      onDragOver={handleContainerDragOver}
    >
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
                        onMouseDown={handleItemMouseDown}
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
