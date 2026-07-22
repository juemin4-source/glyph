import { useState, useMemo, type ReactNode } from 'react';
import { Trash2, FileText, User, Lock, Search, Plus, ChevronRight, ChevronLeft, ChevronDown, Square, Globe } from 'lucide-react';
import type { WorldObject, ObjectType } from '../types/world';

interface DocOutlineProps {
  allObjects: WorldObject[];
  currentObjectId: string | null;
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

/** Map group key to the most appropriate ObjectType to create */
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

export default function DocOutline({ allObjects, currentObjectId, onNavigate, onCreateObject }: DocOutlineProps) {
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
          {groups.length === 0 && (
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

