import { useState, useMemo, type ReactNode } from 'react';
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

export default function DocOutline({ allObjects, currentObjectId, currentObjectContent, onNavigate, onCreateObject }: DocOutlineProps) {
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const groups = useMemo(() => {
    return GROUPS
      .map(g => ({
        ...g,
        items: allObjects.filter(g.predicate).sort((a, b) => a.name.localeCompare(b.name, 'zh')),
      }))
      .filter(g => g.items.length > 0);
  }, [allObjects]);

  const headings = useMemo(() => {
    if (!currentObjectContent) return [];
    return parseHeadings(currentObjectContent);
  }, [currentObjectContent]);

  return (
    <div className={`doc-outline ${panelCollapsed ? 'collapsed' : ''}`}>
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
                  {group.items.map(item => (
                    <div key={item.id} className={`outline-item ${currentObjectId === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.name, item.id)} title={item.name}>
                      <span className="outline-item-status">{statusIcon(item.status)}</span>
                      <span className="outline-item-name">{item.name}</span>
                    </div>
                  ))}
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
