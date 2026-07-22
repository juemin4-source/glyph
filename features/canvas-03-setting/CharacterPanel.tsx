/**
 * CharacterPanel — 画板③ 角色面板 (织梦机 v2)
 *
 * CRUD list + editor for CharacterCard entities.
 * Fields: name, hook, currentWant, realBlock, archetype, description.
 */

import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import * as settingApi from '../../api/settingApi';
import type { CharacterCard } from '../../contracts/setting.contract';
import { Button, Input, TextArea, EmptyState } from '../../components/ui';
import './character-panel.css';

export default function CharacterPanel() {
  const projectId = useProjectStore(s => s.currentProjectId);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CharacterCard | null>(null);
  const [editName, setEditName] = useState('');
  const [editHook, setEditHook] = useState('');
  const [editCurrentWant, setEditCurrentWant] = useState('');
  const [editRealBlock, setEditRealBlock] = useState('');
  const [editArchetype, setEditArchetype] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const list = await settingApi.listCharacterCards(projectId);
      setCharacters(list);
    } catch (e) {
      console.error('Failed to load characters', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const resetEdit = useCallback(() => {
    setSelected(null);
    setEditName('');
    setEditHook('');
    setEditCurrentWant('');
    setEditRealBlock('');
    setEditArchetype('');
    setEditDescription('');
    setIsAdding(false);
  }, []);

  const selectChar = useCallback((c: CharacterCard) => {
    setSelected(c);
    setEditName(c.name);
    setEditHook(c.hook);
    setEditCurrentWant(c.currentWant);
    setEditRealBlock(c.realBlock);
    setEditArchetype(c.archetype);
    setEditDescription(c.description);
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectId) return;
    if (selected) {
      try {
        const updated = await settingApi.updateCharacterCard({
          id: selected.id, name: editName, hook: editHook,
          currentWant: editCurrentWant, realBlock: editRealBlock,
          archetype: editArchetype, description: editDescription,
        });
        setCharacters(prev => prev.map(c => (c.id === updated.id ? updated : c)));
        setSelected(updated);
      } catch (e) { console.error('Failed to update character', e); }
    } else {
      try {
        const created = await settingApi.createCharacterCard({
          projectId, name: editName || '新角色', hook: editHook,
          currentWant: editCurrentWant, realBlock: editRealBlock,
          archetype: editArchetype, description: editDescription,
        });
        setCharacters(prev => [...prev, created]);
        setSelected(created);
      } catch (e) { console.error('Failed to create character', e); }
    }
  }, [projectId, selected, editName, editHook, editCurrentWant, editRealBlock, editArchetype, editDescription]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    try {
      await settingApi.deleteCharacterCard(selected.id);
      setCharacters(prev => prev.filter(c => c.id !== selected.id));
      resetEdit();
    } catch (e) { console.error('Failed to delete character', e); }
  }, [selected, resetEdit]);

  const handleAdd = useCallback(() => { resetEdit(); setIsAdding(true); }, [resetEdit]);

  if (loading) {
    return <EmptyState title="加载中..." />;
  }

  return (
    <div className="character-wrapper">
      <div className="character-toolbar">
        <Button variant="primary" size="sm" onClick={handleAdd}>
          + 添加角色
        </Button>
      </div>

      <div className="character-list">
        {characters.length === 0 && !selected ? (
          <EmptyState
            title="还没有角色"
            description="点击上方按钮添加第一个角色"
          />
        ) : (
          characters.map(c => (
            <div
              key={c.id}
              className={`character-card${selected?.id === c.id ? ' character-card-selected' : ''}`}
              onClick={() => selectChar(c)}
            >
              <div className="character-card-title">{c.name || '未命名角色'}</div>
              {c.hook && <div className="character-card-sub">{c.hook}</div>}
              <div className="character-card-meta">
                {c.archetype && <span>原型: {c.archetype}</span>}
                {c.currentWant && <span>欲望: {c.currentWant}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor */}
      {(selected || isAdding) && (
        <div className="character-editor">
          <div>
            <div className="character-label">角色名</div>
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="角色名称" />
          </div>
          <div>
            <div className="character-label">钩子 (Hook)</div>
            <Input value={editHook} onChange={e => setEditHook(e.target.value)} placeholder="一句话让读者记住角色" />
          </div>
          <div>
            <div className="character-label">表面欲望 (Current Want)</div>
            <Input value={editCurrentWant} onChange={e => setEditCurrentWant(e.target.value)} placeholder="角色当前追求什么" />
          </div>
          <div>
            <div className="character-label">真实阻碍 (Real Block)</div>
            <Input value={editRealBlock} onChange={e => setEditRealBlock(e.target.value)} placeholder="真正的内心阻碍" />
          </div>
          <div>
            <div className="character-label">原型 (Archetype)</div>
            <Input value={editArchetype} onChange={e => setEditArchetype(e.target.value)} placeholder="如：英雄、导师、守护者" />
          </div>
          <div>
            <div className="character-label">描述</div>
            <TextArea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="角色详细描述" rows={3} />
          </div>
          <div className="character-editor-actions">
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
