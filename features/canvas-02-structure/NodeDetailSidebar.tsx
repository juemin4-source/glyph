/**
 * NodeDetailSidebar — 节点详情侧边栏 (织梦机 v2.1.0)
 *
 * Shows selected node details: title, summary, metadata, edit actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/ui';
import type { Canvas2NodeRecord, LayerType } from '../../contracts/structure.contract';

const LAYER_LABELS: Record<LayerType, string> = {
  book: '作品',
  shiwei: '始位',
  hou: '后',
  zhang: '章',
};

interface NodeDetailSidebarProps {
  node: Canvas2NodeRecord | null;
  onSave: (input: Partial<Canvas2NodeRecord>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddChild: (parentId: string) => Promise<void>;
  onClose: () => void;
}

export default function NodeDetailSidebar({ node, onSave, onDelete, onAddChild, onClose }: NodeDetailSidebarProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setTitle(node.title || '');
      setSummary(node.summary || '');
    }
  }, [node]);

  const handleSave = useCallback(async () => {
    if (!node) return;
    setSaving(true);
    try {
      await onSave({ id: node.id, title, summary });
    } finally {
      setSaving(false);
    }
  }, [node, title, summary, onSave]);

  const handleDelete = useCallback(async () => {
    if (!node) return;
    if (window.confirm(`确定删除「${node.title}」及其所有子节点？`)) {
      await onDelete(node.id);
    }
  }, [node, onDelete]);

  const handleAddChild = useCallback(async () => {
    if (!node) return;
    await onAddChild(node.id);
  }, [node, onAddChild]);

  if (!node) return null;

  return (
    <div className="c2-sidebar">
      <div className="c2-sidebar-header">
        <span className="c2-sidebar-title">节点详情</span>
        <button className="c2-sidebar-close" onClick={onClose}>&times;</button>
      </div>

      <div className="c2-sidebar-body">
        <div className="c2-sidebar-field">
          <label>层级</label>
          <span className="c2-sidebar-value">{LAYER_LABELS[node.layerType]}</span>
        </div>

        <div className="c2-sidebar-field">
          <label>标题</label>
          <input
            className="c2-sidebar-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="节点标题"
          />
        </div>

        {node.layerType === 'shiwei' && (
          <div className="c2-sidebar-field">
            <label>时期</label>
            <span className="c2-sidebar-value">{node.timePeriod || '-'}</span>
          </div>
        )}

        {node.layerType === 'hou' && (
          <div className="c2-sidebar-field">
            <label>章节范围</label>
            <span className="c2-sidebar-value">{node.chapterRange || '-'}</span>
          </div>
        )}

        {node.layerType === 'zhang' && (
          <>
            <div className="c2-sidebar-field">
              <label>场景数</label>
              <span className="c2-sidebar-value">{node.sceneCount}</span>
            </div>
            <div className="c2-sidebar-field">
              <label>字数</label>
              <span className="c2-sidebar-value">{node.wordCount}</span>
            </div>
          </>
        )}

        <div className="c2-sidebar-field">
          <label>摘要</label>
          <textarea
            className="c2-sidebar-textarea"
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="节点摘要..."
            rows={4}
          />
        </div>

        <div className="c2-sidebar-actions">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleAddChild}>
            添加子节点
          </Button>
          {node.layerType !== 'book' && (
            <Button variant="danger" size="sm" onClick={handleDelete}>
              删除
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
