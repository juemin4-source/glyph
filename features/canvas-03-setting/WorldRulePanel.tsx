/**
 * WorldRulePanel — 画板③ 世界观规则面板 (织梦机 v2)
 *
 * CRUD list + editor for WorldRule entities.
 */

import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import * as settingApi from '../../api/settingApi';
import type { WorldRule } from '../../contracts/setting.contract';
import { Button, Input, TextArea, EmptyState } from '../../components/ui';
import './world-rule-panel.css';

export default function WorldRulePanel() {
  const projectId = useProjectStore(s => s.currentProjectId);
  const [rules, setRules] = useState<WorldRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WorldRule | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editRuleText, setEditRuleText] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editEnforcer, setEditEnforcer] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const list = await settingApi.listWorldRules(projectId);
      setRules(list);
    } catch (e) {
      console.error('Failed to load world rules', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const resetEdit = useCallback(() => {
    setSelected(null);
    setEditTitle('');
    setEditRuleText('');
    setEditCost('');
    setEditEnforcer('');
    setIsAdding(false);
  }, []);

  const selectRule = useCallback((r: WorldRule) => {
    setSelected(r);
    setEditTitle(r.title);
    setEditRuleText(r.ruleText);
    setEditCost(r.cost);
    setEditEnforcer(r.enforcer);
  }, []);

  const handleSave = useCallback(async () => {
    if (!projectId) return;
    if (selected) {
      try {
        const updated = await settingApi.updateWorldRule({
          id: selected.id,
          title: editTitle,
          ruleText: editRuleText,
          cost: editCost,
          enforcer: editEnforcer,
        });
        setRules(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        setSelected(updated);
      } catch (e) { console.error('Failed to update world rule', e); }
    } else {
      try {
        const created = await settingApi.createWorldRule({
          projectId,
          title: editTitle || '新规则',
          ruleText: editRuleText,
          cost: editCost,
          enforcer: editEnforcer,
        });
        setRules(prev => [...prev, created]);
        setSelected(created);
      } catch (e) { console.error('Failed to create world rule', e); }
    }
  }, [projectId, selected, editTitle, editRuleText, editCost, editEnforcer]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    try {
      await settingApi.deleteWorldRule(selected.id);
      setRules(prev => prev.filter(r => r.id !== selected.id));
      resetEdit();
    } catch (e) { console.error('Failed to delete world rule', e); }
  }, [selected, resetEdit]);

  const handleAdd = useCallback(() => { resetEdit(); setIsAdding(true); }, [resetEdit]);

  if (loading) {
    return <EmptyState title="加载中..." />;
  }

  return (
    <div className="world-rule-wrapper">
      <div className="world-rule-toolbar">
        <Button variant="primary" size="sm" onClick={handleAdd}>
          + 添加规则
        </Button>
      </div>

      <div className="world-rule-list">
        {rules.length === 0 && !selected ? (
          <EmptyState
            title="还没有世界观规则"
            description="点击上方按钮添加第一条规则"
          />
        ) : (
          rules.map(r => (
            <div
              key={r.id}
              className={`world-rule-card${selected?.id === r.id ? ' world-rule-card-selected' : ''}`}
              onClick={() => selectRule(r)}
            >
              <div className="world-rule-card-title">{r.title || '未命名规则'}</div>
              {r.ruleText && <div className="world-rule-card-sub">{r.ruleText}</div>}
              <div className="world-rule-card-meta">
                <span>代价: {r.cost || '-'}</span>
                <span>执行者: {r.enforcer || '-'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Editor */}
      {(selected || isAdding) && (
        <div className="world-rule-editor">
          <div>
            <div className="world-rule-label">规则名称</div>
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="如：魔法守恒定律" />
          </div>
          <div>
            <div className="world-rule-label">规则描述</div>
            <TextArea value={editRuleText} onChange={e => setEditRuleText(e.target.value)} placeholder="规则的具体内容" rows={3} />
          </div>
          <div>
            <div className="world-rule-label">代价</div>
            <Input value={editCost} onChange={e => setEditCost(e.target.value)} placeholder="使用规则需要付出的代价" />
          </div>
          <div>
            <div className="world-rule-label">执行者</div>
            <Input value={editEnforcer} onChange={e => setEditEnforcer(e.target.value)} placeholder="谁/什么力量执行此规则" />
          </div>
          <div className="world-rule-editor-actions">
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
