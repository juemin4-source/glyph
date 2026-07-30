import { useCallback, useMemo, useState } from 'react';
import { FileText, Search, ScanLine, X, Sparkles } from 'lucide-react';
import { useCanonStore } from '../stores/canonStore';
import type { Entity, EntityType } from '../types/fs-ai';
import { ENTITY_TYPES, CANON_LEVELS, CANON_COLORS, ENTITY_STATUSES } from '../types/fs-ai';
import SettingScanDialog from './SettingScanDialog';

interface EntityPanelProps {
  projectRoot: string;
  onOpenFile: (path: string) => Promise<boolean>;
}

export default function EntityPanel({ projectRoot, onOpenFile }: EntityPanelProps) {
  const entities = useCanonStore((s) => s.entities);
  const loadEntities = useCanonStore((s) => s.loadEntities);
  const removeEntity = useCanonStore((s) => s.removeEntity);
  const schema = useCanonStore((s) => s.schema);
const loading = useCanonStore((s) => s.loading);

  const [filterType, setFilterType] = useState<string>('全部');
  const [filterStatus, setFilterStatus] = useState<string>('全部');
  const [searchText, setSearchText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showScanDialog, setShowScanDialog] = useState(false);

  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (filterType !== '全部' && e.type !== filterType) return false;
      if (filterStatus !== '全部' && e.status !== filterStatus) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.tags.some((t) => t.includes(q))) return false;
      }
      return true;
    });
  }, [entities, filterType, filterStatus, searchText]);

  const selected = useMemo(
    () => (selectedId ? entities.find((e) => e.id === selectedId) ?? null : null),
    [selectedId, entities],
  );

  const handleRefresh = useCallback(() => {
    void loadEntities(projectRoot);
  }, [projectRoot, loadEntities]);

  const handleDelete = useCallback(
    (entityId: string) => {
      void removeEntity(projectRoot, entityId);
      if (selectedId === entityId) setSelectedId(null);
    },
    [projectRoot, removeEntity, selectedId],
  );

  return (
    <div className="canon-entity-panel">
      {/* Toolbar */}
      <div className="canon-entity-toolbar">
        <div className="canon-entity-toolbar-left">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="canon-select-sm">
            <option value="全部">全部类型</option>
            {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="canon-select-sm">
            <option value="全部">全部状态</option>
            {ENTITY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="canon-entity-toolbar-right">
          <div className="canon-search-box">
            <Search size={13} />
            <input
              type="text"
              placeholder="搜索..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button className="canon-search-clear" onClick={() => setSearchText('')}>
                <X size={12} />
              </button>
            )}
          </div>
          <button className="canon-refresh-btn" onClick={handleRefresh} title="刷新">
            <ScanLine size={14} />
          </button>
          <button
            className="canon-scan-btn"
            onClick={() => setShowScanDialog(true)}
            title="AI 扫描设定"
          >
            <Sparkles size={14} />
          </button>
        </div>
      </div>

      {/* Body: list + detail */}
      <div className="canon-entity-body">
        {/* List */}
        <div className="canon-entity-list">
          {loading && entities.length === 0 ? (
            <div className="canon-list-empty">加载中…</div>
          ) : filtered.length === 0 ? (
            <div className="canon-list-empty">
              {entities.length === 0 ? '暂无设定，点击刷新扫描项目' : '没有匹配的设定'}
            </div>
          ) : (
            filtered.map((entity) => (
              <div
                key={entity.id}
                className={`canon-entity-item ${selectedId === entity.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(entity.id)}
              >
                <div className="canon-entity-item-name">{entity.name}</div>
                <div className="canon-entity-item-meta">
                  <span>{entity.type}</span>
                  <span className="canon-status-dot" data-status={entity.status} />
                  <span style={{ color: CANON_COLORS[entity.canonLevel] }}>
                    {entity.canonLevel}
                  </span>
                  {entity.tags.slice(0, 2).map((t) => (
                    <span key={t} className="canon-tag">#{t}</span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="canon-entity-detail">
          {selected ? (
            <EntityDetail entity={selected} schema={schema} onDelete={handleDelete} onOpenFile={onOpenFile} />
          ) : (
            <div className="canon-detail-empty">选择一个实体查看详情</div>
          )}
        </div>
      </div>

      {showScanDialog && (
        <SettingScanDialog
          projectRoot={projectRoot}
          onClose={() => {
            setShowScanDialog(false);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}

function EntityDetail({
  entity,
  schema,
  onDelete,
  onOpenFile,
}: {
  entity: Entity;
  schema: import('../types/fs-ai').SparrowSchema;
  onDelete: (id: string) => void;
  onOpenFile: (path: string) => Promise<boolean>;
}) {
  return (
    <div className="canon-detail">
      <div className="canon-detail-header">
        <h2>{entity.name}</h2>
        <div className="canon-detail-badges">
          <span>{entity.type}</span>
          <span
            className="canon-status-badge"
            data-status={entity.status}
          >
            {entity.status}
          </span>
          <span style={{ color: CANON_COLORS[entity.canonLevel] }}>
            {entity.canonLevel}
          </span>
        </div>
      </div>

      {entity.aliases.length > 0 && (
        <div className="canon-detail-aliases">
          别名: {entity.aliases.join('、')}
        </div>
      )}

      {entity.tags.length > 0 && (
        <div className="canon-detail-tags">
          {entity.tags.map((t) => (
            <span key={t} className="canon-tag">{t}</span>
          ))}
        </div>
      )}

      <div className="canon-detail-section">
        <strong>概要</strong>
        <p>{entity.summary || '暂无'}</p>
      </div>

      {entity.detail && (
        <div className="canon-detail-section">
          <strong>详情</strong>
          <p>{entity.detail}</p>
        </div>
      )}

      {entity.schemaKeys.length > 0 && (
        <div className="canon-detail-section">
          <strong>关联世界观字段</strong>
          {entity.schemaKeys.map((k) => {
            const value = (schema as any)[k]?.trim();
            return (
              <div key={k} className="canon-schema-field-link">
                <span className="canon-schema-key">{k}</span>
                {value ? (
                  <p className="canon-schema-value">{value}</p>
                ) : (
                  <p className="canon-schema-value empty">（字段未填写）</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {entity.sourceRefs.length > 0 && (
        <div className="canon-detail-section">
          <strong>来源引用</strong>
          {entity.sourceRefs.map((ref, i) => (
            <div key={i} className="canon-source-ref">
              <button
                className="canon-source-link"
                onClick={() => void onOpenFile(ref.filePath)}
              >
                <FileText size={12} />
                {ref.filePath}
              </button>
              <blockquote>{ref.textSnippet}</blockquote>
            </div>
          ))}
        </div>
      )}

      <div className="canon-detail-meta">
        <span>创建: {new Date(entity.createdAt).toLocaleDateString('zh-CN')}</span>
        <span>引用: {entity.referencesCount} 次</span>
      </div>

      <button
        className="canon-delete-btn"
        onClick={() => onDelete(entity.id)}
      >
        删除
      </button>
    </div>
  );
}
