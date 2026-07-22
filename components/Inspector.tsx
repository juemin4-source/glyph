import { useState, useEffect, useRef } from 'react';
import type { WorldObject } from '../types/world';
import { Info, Check } from 'lucide-react';
import { STATUS_DISPLAY, CANON_LEVELS, CANON_COLORS } from '../types/world';

interface InspectorProps {
  object: WorldObject | null;
  allObjects: WorldObject[];
  allBoardTabs: string[];
  onNavigate: (name: string) => void;
  onAction: (action: string, objectId: string, extra?: string) => void;
}

function ReasonDialog({
  actionName, objectName, onConfirm, onCancel,
}: {
  actionName: string;
  objectName: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && reason.trim()) onConfirm(reason.trim());
  };
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={e => e.stopPropagation()}>
        <h4>{actionName}「{objectName}」</h4>
        <p style={{ fontSize: 13, color: '#888', margin: '4px 0 12px' }}>请填写操作原因：</p>
        <input ref={inputRef} type="text" value={reason} onChange={e => setReason(e.target.value)}
          onKeyDown={handleKeyDown} placeholder="输入原因..." className="dialog-input" />
        <div className="dialog-actions">
          <button className="ia-btn" onClick={onCancel}>取消</button>
          <button className="ia-btn"
            style={{ background: actionName === '废弃' ? '#B71C1C' : '#1B5E20', opacity: reason.trim() ? 1 : 0.5 }}
            disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>确认{actionName}</button>
        </div>
      </div>
    </div>
  );
}

export default function Inspector({ object, allObjects, allBoardTabs, onNavigate, onAction }: InspectorProps) {
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const [pendingAction, setPendingAction] = useState<{ action: string; label: string } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boardRef.current && !boardRef.current.contains(e.target as Node)) setShowBoardMenu(false);
    };
    if (showBoardMenu) { document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }
  }, [showBoardMenu]);

  if (!object) {
    const totalObjects = allObjects.length;
    const allBoards = new Set<string>();
    allObjects.forEach(o => o.selectedBoards.forEach(b => allBoards.add(b)));
    const totalSettings = allObjects.filter(o => o.canonLevel !== '未收录').length;
    const totalJudgments = allObjects.reduce((sum, o) => sum + o.judgmentHistory.length, 0);
    return (
      <div className="inspector-panel inspector-empty">
        <h3>项目总览</h3>
        <div className="inspector-overview">
          <div className="overview-item"><span className="overview-count">{totalObjects}</span><span className="overview-label">对象数</span></div>
          <div className="overview-item"><span className="overview-count">{allBoards.size}</span><span className="overview-label">画板数</span></div>
          <div className="overview-item"><span className="overview-count">{totalSettings}</span><span className="overview-label">设定数</span></div>
          <div className="overview-item"><span className="overview-count">{totalJudgments}</span><span className="overview-label">判断数</span></div>
        </div>
      </div>
    );
  }

  const sd = STATUS_DISPLAY[object.status];
  const boardNames = object.selectedBoards;
  const referencedBy = allObjects.filter(o => o.id !== object.id && o.content.includes(object.name));
  const isLocked = object.status === '锁定';
  const isDiscarded = object.status === '废弃';
  const isUncollected = object.canonLevel === '未收录';
  const allBoardsCovered = allBoardTabs.length > 0 && allBoardTabs.every(b => object.selectedBoards.includes(b));
  const handleLockClick = () => setPendingAction({ action: '锁定', label: '锁定' });
  const handleDiscardClick = () => setPendingAction({ action: '废弃', label: '废弃' });
  const handleUnlockClick = () => setPendingAction({ action: '解锁', label: '解锁' });

  return (
    <div className="inspector-panel">
      <h3 style={{ borderBottom: `2px solid ${sd.border.split(' ')[1]}`, paddingBottom: 8 }}>{object.name}</h3>

      <div className="inspector-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '8px 0 12px', borderBottom: '1px solid #222', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className="ia-btn" disabled={!isUncollected} onClick={() => onAction('收录为设定', object.id)}
            title={isUncollected ? '将对象收录为设定（正典等级提升为草案正典）' : '已收录为设定'}>收录为设定</button>
          <span style={{ fontSize: 13, cursor: 'help', color: '#888' }}
            title="正典等级：未收录(灰色) → 草案正典(紫色) → 项目正典(蓝色) → 核心正典(金色)"><Info size={14} /></span>
        </div>
        <div className="ia-btn-wrapper" ref={boardRef}>
          <button className="ia-btn" disabled={allBoardsCovered || allBoardTabs.length === 0} onClick={() => setShowBoardMenu(v => !v)} title="放入画板">放入画板</button>
          {showBoardMenu && !allBoardsCovered && (
            <div className="ia-board-menu">
              {allBoardTabs.map(board => (
                <div key={board} className={`ia-board-item${object.selectedBoards.includes(board) ? ' checked' : ''}`}
                  onClick={() => { onAction('放入画板', object.id, board); setShowBoardMenu(false); }}>
                  {object.selectedBoards.includes(board) ? <><Check size={12} />{' '}</> : ''}{board}
                </div>
              ))}
            </div>
          )}
        </div>
        {isLocked ? (
          <button className="ia-btn" onClick={handleUnlockClick} title="解锁回退到待验证">解锁</button>
        ) : (
          <>
            <button className="ia-btn" disabled={isDiscarded} onClick={handleLockClick} title={isDiscarded ? '已废弃，无法锁定' : '锁定对象'}>锁定</button>
            <button className="ia-btn ia-btn-danger" disabled={isDiscarded} onClick={handleDiscardClick} title={isDiscarded ? '已废弃' : '废弃对象'}>废弃</button>
          </>
        )}
        <button className="ia-btn" onClick={() => onAction('查看引用', object.id)} title="查看引用">引用{referencedBy.length > 0 ? ` (${referencedBy.length})` : ''}</button>
        <button className="ia-btn" onClick={() => onAction('判断记录', object.id)} title="查看判断记录">判断{object.judgmentHistory.length > 0 ? ` (${object.judgmentHistory.length})` : ''}</button>
      </div>

      <div className="inspector-field"><label>类型</label><div className="value">{object.type}</div></div>
      <div className="inspector-field">
        <label>状态</label>
        <div className="value"><span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 3, background: sd.background, color: sd.text, border: sd.border, fontSize: 12 }}>{object.status}</span></div>
      </div>
      <div className="inspector-field">
        <label>正典等级</label>
        <div className="value">
          {CANON_LEVELS.indexOf(object.canonLevel) >= 0 ? (
            <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 3,
              background: object.canonLevel === '核心正典' ? '#3E2723' : object.canonLevel === '项目正典' ? '#1A237E' : object.canonLevel === '草案正典' ? '#4A148C' : '#333',
              color: CANON_COLORS[object.canonLevel] || '#999', fontSize: 12 }}>
              {object.canonLevel}
            </span>
          ) : '未收录'}
        </div>
      </div>
      <div className="inspector-field"><label>引用次数</label><div className="value">{object.referencesCount} 次</div></div>
      <div className="inspector-field">
        <label>被引用</label>
        <div className="value">
          {referencedBy.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {referencedBy.map(o => (<span key={o.id} className="prop-tag" onClick={() => onNavigate(o.name)} style={{ cursor: 'pointer' }}>{o.name}</span>))}
            </div>
          ) : (<span style={{ color: '#666', fontSize: 12 }}>无</span>)}
        </div>
      </div>
      {object.aliases.length > 0 && (
        <div className="inspector-field"><label>别名</label><div className="value" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{object.aliases.map((a, i) => (<span key={i} className="prop-tag">{a}</span>))}</div></div>
      )}
      {object.tags.length > 0 && (
        <div className="inspector-field"><label>标签</label><div className="value" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{object.tags.map((t, i) => (<span key={i} className="prop-tag">{t}</span>))}</div></div>
      )}
      <div className="inspector-field"><label>所属画板</label><div className="value">{boardNames.length > 0 ? boardNames.join('、') : <span style={{ color: '#666', fontSize: 12 }}>无</span>}</div></div>
      <div className="inspector-field">
        <label>摘要</label>
        <div className="value" style={{ fontSize: 13, lineHeight: 1.6, color: '#aaa' }}>{object.content.slice(0, 150)}{object.content.length > 150 ? '...' : ''}</div>
      </div>
      {object.judgmentHistory.length > 0 && (
        <div className="inspector-field">
          <label>判断记录</label>
          <div style={{ fontSize: 12 }}>
            {object.judgmentHistory.slice(-3).reverse().map((j, i, arr) => (
              <div key={j.id} style={{ padding: '4px 0', borderBottom: i < arr.length - 1 ? '1px solid #2a2a2a' : 'none' }}>
                <span style={{ display: 'inline-block', padding: '0 4px', borderRadius: 2, fontSize: 10, marginRight: 4,
                  background: j.operationType === '锁定' ? '#1B5E20' : j.operationType === '废弃' ? '#B71C1C' : j.operationType === '待验证' ? '#E65100' : '#1A237E',
                  color: j.operationType === '锁定' ? '#A5D6A7' : j.operationType === '废弃' ? '#EF9A9A' : j.operationType === '待验证' ? '#FFCC80' : '#90CAF9' }}>
                  {j.operationType}
                </span>
                {j.reason}
                <div style={{ color: '#666', fontSize: 10, marginTop: 1 }}>{new Date(j.timestamp).toLocaleDateString('zh-CN')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingAction && (
        <ReasonDialog
          actionName={pendingAction.label}
          objectName={object.name}
          onConfirm={(reason) => { onAction(pendingAction.action, object.id, reason); setPendingAction(null); }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
