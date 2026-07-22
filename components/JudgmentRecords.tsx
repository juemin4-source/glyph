import { useState, useMemo, useCallback } from 'react';
import type { WorldObject, JudgmentOperation, ChangelogEntry } from '../types/world';

interface JudgmentRecordsProps {
  allObjects: WorldObject[];
  onNavigate: (name: string) => void;
  changelogEntries?: ChangelogEntry[];
}

type TabKey = 'actionLog' | 'fieldChanges' | 'decisionLog';

const JUDGMENT_TYPES: JudgmentOperation[] = ['锁定', '废弃', '待验证', '提升正典', '收录'];

const TAB_OPTIONS: { key: TabKey; label: string }[] = [
  { key: 'actionLog', label: '动作日志' },
  { key: 'fieldChanges', label: '字段变更' },
  { key: 'decisionLog', label: '决策日志' },
];

const ACTION_LABELS: Record<string, string> = {
  create_object: '创建对象',
  delete_object: '删除对象',
  update_object: '更新对象',
  move_canvas_node: '移动节点',
  create_connection: '创建连线',
  delete_connection: '删除连线',
  update_canvas_state: '更新画板',
};

interface DisplayRecord {
  id: string;
  objectId: string;
  objectName: string;
  operationType: string;
  reason: string;
  timestamp: number;
  previousStatus: string;
  newStatus: string;
  objectType: string;
  isChangelog?: boolean;
}

export default function JudgmentRecords({ allObjects, onNavigate, changelogEntries = [] }: JudgmentRecordsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('actionLog');
  const [filterObject, setFilterObject] = useState<string>('全部');
  const [filterType, setFilterType] = useState<string>('全部');

  const allRecords = useMemo(() => {
    const records: DisplayRecord[] = [];

    // Add judgment records from allObjects
    allObjects.forEach(obj => {
      obj.judgmentHistory.forEach(j => {
        records.push({
          id: j.id,
          objectId: j.objectId,
          objectName: j.objectName,
          operationType: j.operationType,
          reason: j.reason || '无说明',
          timestamp: j.timestamp,
          previousStatus: j.previousStatus,
          newStatus: j.newStatus,
          objectType: obj.type,
          isChangelog: false,
        });
      });
    });

    // Add changelog entries
    changelogEntries.forEach(entry => {
      const obj = allObjects.find(o => o.id === entry.objectId);
      const actionLabel = ACTION_LABELS[entry.action] || entry.action;
      records.push({
        id: 'cl-' + entry.timestamp + '-' + entry.objectId + '-' + entry.action,
        objectId: entry.objectId,
        objectName: (entry.snapshot?.name as string) || entry.objectId,
        operationType: actionLabel,
        reason: actionLabel,
        timestamp: entry.timestamp,
        previousStatus: '',
        newStatus: '',
        objectType: (entry.snapshot?.type as string) || (obj ? obj.type : '编辑操作'),
        isChangelog: true,
      });
    });

    records.sort((a, b) => b.timestamp - a.timestamp);
    return records;
  }, [allObjects, changelogEntries]);

  const filteredRecords = useMemo(() => {
    return allRecords.filter(r => {
      if (filterObject !== '全部' && r.objectName !== filterObject) return false;
      if (filterType !== '全部' && r.operationType !== filterType) return false;
      return true;
    });
  }, [allRecords, filterObject, filterType]);

  const fieldChanges = useMemo(
    () => allRecords.filter(r => !r.isChangelog && r.previousStatus !== r.newStatus),
    [allRecords]
  );

  const objectNames = useMemo(() => {
    const names = new Set<string>();
    allRecords.forEach(r => names.add(r.objectName));
    return Array.from(names).sort();
  }, [allRecords]);

  const getBadgeClass = (op: string): string => {
    switch (op) {
      case '锁定': return 'lock';
      case '废弃': return 'discard';
      case '待验证': return 'pending';
      case '提升正典': return 'promote';
      case '收录': return 'admit';
      default: return 'changelog';
    }
  };

  const handleObjectClick = useCallback((name: string) => onNavigate(name), [onNavigate]);

  const formatTime = (ts: number) => new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="judgment-view">
      <div className="judgment-tabs">
        {TAB_OPTIONS.map(tab => (
          <div key={tab.key} className={'judgment-tab' + (activeTab === tab.key ? ' active' : '')} onClick={() => setActiveTab(tab.key)}>{tab.label}</div>
        ))}
      </div>

      {activeTab === 'actionLog' && (
        <>
          <div className="judgment-filters">
            <label>对象</label>
            <select value={filterObject} onChange={e => setFilterObject(e.target.value)} style={{ width: 140 }}>
              <option value="全部">全部对象</option>
              {objectNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <label>类型</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="全部">全部类型</option>
              {JUDGMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto' }}>共 {filteredRecords.length} 条记录</span>
          </div>
          <div className="judgment-list">
            {filteredRecords.length === 0 ? (
              <div className="judgment-empty"><p style={{ fontSize: 16, marginBottom: 8 }}>暂无判断记录</p><p>锁定、废弃或标记待验证操作会自动生成判断记录</p></div>
            ) : (
              filteredRecords.map(r => (
                <div key={r.id} className={'judgment-card' + (r.isChangelog ? ' changelog-card' : '')}>
                  <div className={'op-badge ' + getBadgeClass(r.operationType)}>{r.operationType}</div>
                  <div className="card-main">
                    <div className="card-header-line">
                      <span className="obj-link" onClick={() => handleObjectClick(r.objectName)} title={'跳转到「' + r.objectName + '」的文档'}>{r.objectName}<span className="obj-link-arrow">→</span></span>
                      <span className="obj-type-badge">{r.objectType}</span>
                    </div>
                    {!r.isChangelog && <div className="reason">{r.reason || '无说明'}</div>}
                    <div className="time">{formatTime(r.timestamp)}{!r.isChangelog && r.previousStatus !== r.newStatus && (<span style={{ marginLeft: 8, color: '#666' }}>{r.previousStatus} → {r.newStatus}</span>)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === 'fieldChanges' && (
        <div className="judgment-list">
          {fieldChanges.length === 0 ? (
            <div className="judgment-empty"><p style={{ fontSize: 16, marginBottom: 8 }}>暂无字段变更记录</p></div>
          ) : (
            fieldChanges.map(r => (
              <div key={r.id} className="judgment-card field-change-card">
                <div className="op-badge field-badge">字段变更</div>
                <div className="card-main">
                  <div className="card-header-line">
                    <span className="obj-link" onClick={() => handleObjectClick(r.objectName)} title={'跳转到「' + r.objectName + '」的文档'}>{r.objectName}<span className="obj-link-arrow">→</span></span>
                    <span className="obj-type-badge">{r.objectType}</span>
                  </div>
                  <div className="field-change-detail">
                    <span className="field-name">状态</span>
                    <span className="old-value">{r.previousStatus}</span>
                    <span className="field-change-arrow">→</span>
                    <span className="new-value">{r.newStatus}</span>
                  </div>
                  <div className="reason" style={{ marginTop: 2 }}>{r.reason || '无说明'}</div>
                  <div className="time">{formatTime(r.timestamp)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'decisionLog' && (
        <div className="judgment-list">
          <div className="judgment-empty">
            <p style={{ fontSize: 16, marginBottom: 8 }}>🗒 决策日志 (Decision Log)</p>
            <p style={{ color: 'var(--text-muted, #6b6b6b)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
              AI 关键操作留痕（假设采纳/驳回、packet 确认、AI 生成确认）将在此展示。
              <br /><br />
              后端集成完成后自动生效。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}