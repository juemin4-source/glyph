import { useState, useMemo, useCallback, useEffect } from 'react';
import type { WorldObject, ObjectType, ObjectStatus } from '../types/world';
import { OBJECT_TYPES, OBJECT_STATUSES, CANON_LEVELS, STATUS_DISPLAY } from '../types/world';
import { TEMPLATES } from '../data/seed';
import { ArrowUp, ArrowDown, Check } from 'lucide-react';

interface SettingCollectionProps {
  allObjects: WorldObject[];
  onSelectObject: (objectId: string | null) => void;
  onNavigate: (name: string) => void;
  onUpdateObject: (id: string, updates: Partial<WorldObject>) => void;
  onCreateObject: (templateType: ObjectType) => void;
  defaultSelected?: string;
}

export default function SettingCollection({
  allObjects, onSelectObject, onNavigate, onUpdateObject, onCreateObject, defaultSelected
}: SettingCollectionProps) {
  const [filterType, setFilterType] = useState<string>('全部');
  const [filterStatus, setFilterStatus] = useState<string>('全部');
  const [filterCanon, setFilterCanon] = useState<string>('全部');
  const [searchText, setSearchText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelected ?? null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  useEffect(() => {
    if (defaultSelected) { setSelectedId(defaultSelected); onSelectObject(defaultSelected); }
  }, [defaultSelected]);

  const canonObjects = useMemo(() => allObjects.filter(o => o.canonLevel !== '未收录'), [allObjects]);

  const filteredObjects = useMemo(() => {
    return canonObjects.filter(o => {
      if (filterType !== '全部' && o.type !== filterType) return false;
      if (filterStatus !== '全部' && o.status !== filterStatus) return false;
      if (filterCanon !== '全部' && o.canonLevel !== filterCanon) return false;
      if (searchText && !o.name.includes(searchText) && !o.tags.some(t => t.includes(searchText))) return false;
      return true;
    });
  }, [canonObjects, filterType, filterStatus, filterCanon, searchText]);

  const selectedObject = useMemo(() => {
    if (!selectedId) return null;
    return allObjects.find(o => o.id === selectedId) || null;
  }, [selectedId, allObjects]);

  const handleSelect = useCallback((id: string) => { setSelectedId(id); onSelectObject(id); }, [onSelectObject]);

  const handlePromote = useCallback(() => {
    if (!selectedObject) return;
    const idx = CANON_LEVELS.indexOf(selectedObject.canonLevel);
    if (idx < CANON_LEVELS.length - 1) onUpdateObject(selectedObject.id, { canonLevel: CANON_LEVELS[idx + 1] });
  }, [selectedObject, onUpdateObject]);

  const handleDemote = useCallback(() => {
    if (!selectedObject) return;
    const idx = CANON_LEVELS.indexOf(selectedObject.canonLevel);
    if (idx > 0) onUpdateObject(selectedObject.id, { canonLevel: CANON_LEVELS[idx - 1] });
  }, [selectedObject, onUpdateObject]);

  const canPromote = selectedObject && CANON_LEVELS.indexOf(selectedObject.canonLevel) < CANON_LEVELS.length - 1;
  const canDemote = selectedObject && CANON_LEVELS.indexOf(selectedObject.canonLevel) > 0;

  return (
    <div className="setting-view">
      <div className="setting-filters">
        <label>类型</label>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="全部">全部</option>
          {OBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label>状态</label>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="全部">全部</option>
          {OBJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label>正典等级</label>
        <select value={filterCanon} onChange={e => setFilterCanon(e.target.value)}>
          <option value="全部">全部</option>
          {CANON_LEVELS.filter(c => c !== '未收录').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="text" placeholder="搜索名称或标签..." value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: 160 }} />
        <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto' }}>{filteredObjects.length} / {canonObjects.length} 个设定</span>
        <div style={{ position: 'relative' }}>
          <button className="tb-btn primary" onClick={() => setShowTemplateMenu(!showTemplateMenu)} style={{ background: '#333' }}>套用模板</button>
          {showTemplateMenu && (
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, background: '#1e1e1e', border: '1px solid #333', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', padding: 4, minWidth: 120 }}>
              {TEMPLATES.map(t => (
                <div key={t.type} style={{ padding: '6px 10px', cursor: 'pointer', borderRadius: 2, fontSize: 13, color: '#ccc' }}
                  onClick={() => { onCreateObject(t.type); setShowTemplateMenu(false); }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{t.type}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="setting-content">
        <div className="setting-list">
          {filteredObjects.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: 13 }}>没有匹配的设定</div>
          ) : (
            filteredObjects.map(obj => {
              const sd = STATUS_DISPLAY[obj.status];
              const isSelected = selectedId === obj.id;
              return (
                <div key={obj.id} className={`setting-item ${isSelected ? 'selected' : ''}`} onClick={() => handleSelect(obj.id)} onDoubleClick={() => onNavigate(obj.name)}>
                  <div className="item-name">{obj.name}</div>
                  <div className="item-meta">
                    <span>{obj.type}</span>
                    <span style={{ color: sd.text, border: `1px solid ${sd.border.split(' ')[1]}`, padding: '0 4px', borderRadius: 2, background: sd.background }}>{obj.status}</span>
                    <span style={{ color: obj.canonLevel === '核心正典' ? '#FFB74D' : obj.canonLevel === '项目正典' ? '#90CAF9' : obj.canonLevel === '草案正典' ? '#CE93D8' : '#666' }}>{obj.canonLevel}</span>
                    {obj.tags.slice(0, 2).map(t => (<span key={t} style={{ color: '#666' }}>#{t}</span>))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="setting-preview">
          {selectedObject ? (
            <div>
              <h2 style={{ fontSize: 20, marginBottom: 4, color: '#e8e8e8' }}>{selectedObject.name}</h2>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 12 }}>
                <span style={{ color: '#888' }}>{selectedObject.type}</span>
                <span style={{ padding: '1px 6px', borderRadius: 3, background: STATUS_DISPLAY[selectedObject.status].background, color: STATUS_DISPLAY[selectedObject.status].text, border: STATUS_DISPLAY[selectedObject.status].border }}>{selectedObject.status}</span>
                <span style={{ padding: '1px 6px', borderRadius: 3, background: selectedObject.canonLevel === '核心正典' ? '#3E2723' : selectedObject.canonLevel === '项目正典' ? '#1A237E' : selectedObject.canonLevel === '草案正典' ? '#4A148C' : '#333', color: selectedObject.canonLevel === '核心正典' ? '#FFB74D' : selectedObject.canonLevel === '项目正典' ? '#90CAF9' : selectedObject.canonLevel === '草案正典' ? '#CE93D8' : '#999' }}>{selectedObject.canonLevel}</span>
              </div>
              {selectedObject.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>{selectedObject.tags.map(t => (<span key={t} className="prop-tag">{t}</span>))}</div>
              )}
              {selectedObject.aliases.length > 0 && (<div style={{ marginBottom: 12, fontSize: 13, color: '#888' }}>别名: {selectedObject.aliases.join(', ')}</div>)}
              <div style={{ border: '1px solid #2a2a2a', borderRadius: 6, padding: 12, background: '#141414', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto', color: '#ccc' }}>
                {selectedObject.content || <span style={{ color: '#555' }}>暂无内容</span>}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: '#666', display: 'flex', gap: 24 }}>
                <span>创建: {new Date(selectedObject.createdAt).toLocaleDateString('zh-CN')}</span>
                <span>更新: {new Date(selectedObject.updatedAt).toLocaleDateString('zh-CN')}</span>
                <span>引用: {selectedObject.referencesCount} 次</span>
              </div>
              {canPromote && (<button className="canon-promote" onClick={handlePromote}><ArrowUp size={14} /> 提升至 {CANON_LEVELS[CANON_LEVELS.indexOf(selectedObject.canonLevel) + 1]}</button>)}
              {canDemote && (<button className="canon-demote" onClick={handleDemote}><ArrowDown size={14} /> 降级至 {CANON_LEVELS[CANON_LEVELS.indexOf(selectedObject.canonLevel) - 1]}</button>)}
              {selectedObject.canonLevel === '核心正典' && (<div style={{ marginTop: 12, fontSize: 12, color: '#FFB74D', fontStyle: 'italic' }}><Check size={14} /> 已达最高正典等级</div>)}
            </div>
          ) : (
            <div className="empty"><p>选择一个设定查看详情</p><p style={{ fontSize: 12, marginTop: 8 }}>设定集仅显示正典等级 &gt; 未收录 的对象</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
