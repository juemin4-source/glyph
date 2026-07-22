/**
 * FactionPanel — 画板③ 势力面板 (织梦机 v2)
 *
 * CRUD list + editor for FactionCard entities.
 * Fields: name, trueGoal, publicSlogan, resources (string[]),
 * representativeCharacterIds (string[] ← multi-select from characters),
 * dailyInterface.
 */

import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import * as settingApi from '../../api/settingApi';
import type { FactionCard, CharacterCard } from '../../contracts/setting.contract';
import { Button, Input, TextArea, EmptyState } from '../../components/ui';
import './faction-panel.css';

export default function FactionPanel() {
  const projectId = useProjectStore(s => s.currentProjectId);
  const [factions, setFactions] = useState<FactionCard[]>([]);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FactionCard | null>(null);
  const [editName, setEditName] = useState('');
  const [editTrueGoal, setEditTrueGoal] = useState('');
  const [editPublicSlogan, setEditPublicSlogan] = useState('');
  const [editResources, setEditResources] = useState('');
  const [editCharIds, setEditCharIds] = useState<string[]>([]);
  const [editDailyInterface, setEditDailyInterface] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const [factionList, charList] = await Promise.all([
        settingApi.listFactionCards(projectId),
        settingApi.listCharacterCards(projectId),
      ]);
      setFactions(factionList);
      setCharacters(charList);
    } catch (e) {
      console.error('Failed to load factions', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const resetEdit = useCallback(() => {
    setSelected(null);
    setEditName('');
    setEditTrueGoal('');
    setEditPublicSlogan('');
    setEditResources('');
    setEditCharIds([]);
    setEditDailyInterface('');
    setIsAdding(false);
  }, []);

  const selectFaction = useCallback((f: FactionCard) => {
    setSelected(f);
    setEditName(f.name);
    setEditTrueGoal(f.trueGoal);
    setEditPublicSlogan(f.publicSlogan);
    setEditResources((f.resources || []).join('\n'));
    setEditCharIds(f.representativeCharacterIds || []);
    setEditDailyInterface(f.dailyInterface);
  }, []);

  const toggleCharId = useCallback((id: string) => {
    setEditCharIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectId) return;
    // Parse resources from newline-separated text to string[]
    const resourcesArr = editResources
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    if (selected) {
      try {
        const updated = await settingApi.updateFactionCard({
          id: selected.id, name: editName, trueGoal: editTrueGoal,
          publicSlogan: editPublicSlogan, resources: resourcesArr,
          representativeCharacterIds: editCharIds, dailyInterface: editDailyInterface,
        });
        setFactions(prev => prev.map(f => (f.id === updated.id ? updated : f)));
        setSelected(updated);
      } catch (e) { console.error('Failed to update faction', e); }
    } else {
      try {
        const created = await settingApi.createFactionCard({
          projectId, name: editName || '新势力', trueGoal: editTrueGoal,
          publicSlogan: editPublicSlogan, resources: resourcesArr,
          representativeCharacterIds: editCharIds, dailyInterface: editDailyInterface,
        });
        setFactions(prev => [...prev, created]);
        setSelected(created);
      } catch (e) { console.error('Failed to create faction', e); }
    }
  }, [projectId, selected, editName, editTrueGoal, editPublicSlogan, editResources, editCharIds, editDailyInterface]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    try {
      await settingApi.deleteFactionCard(selected.id);
      setFactions(prev => prev.filter(f => f.id !== selected.id));
      resetEdit();
    } catch (e) { console.error('Failed to delete faction', e); }
  }, [selected, resetEdit]);

  const handleAdd = useCallback(() => { resetEdit(); setIsAdding(true); }, [resetEdit]);

  if (loading) {
    return <EmptyState title="加载中..." />;
  }

  return (
    <div className="faction-wrapper">
      <div className="faction-toolbar">
        <Button variant="primary" size="sm" onClick={handleAdd}>
          + 添加势力
        </Button>
      </div>

      <div className="faction-list">
        {factions.length === 0 && !selected ? (
          <EmptyState
            title="还没有势力"
            description="点击上方按钮添加第一个势力"
          />
        ) : (
          factions.map(f => (
            <div
              key={f.id}
              className={`faction-card${selected?.id === f.id ? ' faction-card-selected' : ''}`}
              onClick={() => selectFaction(f)}
            >
              <div className="faction-card-title">{f.name || '未命名势力'}</div>
              {f.publicSlogan && <div className="faction-card-sub">{f.publicSlogan}</div>}
              <div className="faction-card-meta">
                {f.representativeCharacterIds.length > 0 && (
                  <span>代表角色: {f.representativeCharacterIds.length}人</span>
                )}
                {f.resources.length > 0 && (
                  <span>资源: {f.resources.length}项</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor */}
      {(selected || isAdding) && (
        <div className="faction-editor">
          <div>
            <div className="faction-label">势力名称</div>
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="势力名称" />
          </div>
          <div>
            <div className="faction-label">真实目标 (True Goal)</div>
            <Input value={editTrueGoal} onChange={e => setEditTrueGoal(e.target.value)} placeholder="势力真正想要达到的目的" />
          </div>
          <div>
            <div className="faction-label">公开口号 (Public Slogan)</div>
            <Input value={editPublicSlogan} onChange={e => setEditPublicSlogan(e.target.value)} placeholder="对外的宣传口号" />
          </div>
          <div>
            <div className="faction-label">资源 (每行一项)</div>
            <TextArea value={editResources} onChange={e => setEditResources(e.target.value)} placeholder="资源列表，每行一项" rows={3} />
          </div>
          <div>
            <div className="faction-label">代表角色</div>
            {characters.length === 0 ? (
              <div className="faction-no-chars">
                暂无角色，请先在「角色」Tab 中添加
              </div>
            ) : (
              <div className="faction-checkbox-list">
                {characters.map(ch => (
                  <label key={ch.id} className="faction-checkbox">
                    <input
                      type="checkbox"
                      checked={editCharIds.includes(ch.id)}
                      onChange={() => toggleCharId(ch.id)}
                      style={{ accentColor: '#CE93D8' }}
                    />
                    {ch.name}
                  </label>
                ))}
              </div>
            )}
            {editCharIds.length > 0 && (
              <div className="faction-chips">
                {editCharIds.map(id => {
                  const ch = characters.find(c => c.id === id);
                  return ch ? <span key={id} className="faction-chip">{ch.name}</span> : null;
                })}
              </div>
            )}
          </div>
          <div>
            <div className="faction-label">日常面貌 (Daily Interface)</div>
            <TextArea value={editDailyInterface} onChange={e => setEditDailyInterface(e.target.value)} placeholder="势力的日常外在表现" rows={2} />
          </div>
          <div className="faction-editor-actions">
            <Button variant="primary" style={{ flex: 1 }} onClick={handleSave}>
              {selected ? '保存' : '创建'}
            </Button>
            {selected && (
              <Button variant="danger" onClick={handleDelete}>
                删除
              </Button>
            )}
            <Button variant="secondary" onClick={resetEdit}>
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
