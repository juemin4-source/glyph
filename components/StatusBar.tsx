/**
 * StatusBar — Bottom status bar with save indicator and metadata (P1-05, P2-04).
 *
 * Left: save status (5-state: saved/saving/unsaved/offline/failed) + sync queue count
 * Right: word count, link count, canon label, last update time
 *
 * Matches editor prototype design tokens.
 */

import type { SaveStatus } from '../types/world';
import type { ReactNode } from 'react';
import { Check, RefreshCw, TriangleAlert } from 'lucide-react';

interface StatusBarProps {
  saveStatus: SaveStatus;
  wordCount: number;
  linkCount?: number;
  onRetrySave?: () => void;
  onSaveClick?: () => void;
  canonLabel?: string;
  lastUpdateText?: string;
}

const STATUS_CONFIG: Record<SaveStatus, { text: ReactNode; color: string; cls: string }> = {
  saved:   { text: <><Check size={11} /> 已保存</>,        color: '#4CAF50', cls: 'saved' },
  saving:  { text: <><RefreshCw size={11} /> 保存中...</>, color: '#FFC107', cls: 'saving' },
  unsaved: { text: '未保存 ●',    color: '#FF9800', cls: 'unsaved' },
  offline: { text: '离线 ●',      color: '#888',    cls: 'offline' },
  failed:  { text: <><TriangleAlert size={11} /> 保存失败 点击重试</>, color: '#f44336', cls: 'failed' },
};

/** Derived sync queue count per status (0 = hidden) */
const SYNC_QUEUE: Record<SaveStatus, number> = {
  saved:   0,
  saving:  0,
  unsaved: 1,
  offline: 3,
  failed:  2,
};

export default function StatusBar({
  saveStatus,
  wordCount,
  onRetrySave,
  onSaveClick,
  linkCount = 0,
  canonLabel = '',
  lastUpdateText = '',
}: StatusBarProps) {
  const config = STATUS_CONFIG[saveStatus] || STATUS_CONFIG.saved;
  const syncQueue = SYNC_QUEUE[saveStatus];
  const isClickable = saveStatus === 'failed' || saveStatus === 'unsaved';

  const handleClick = () => {
    if (saveStatus === 'failed' && onRetrySave) onRetrySave();
    if (onSaveClick) onSaveClick();
  };

  return (
    <div
      style={{
        height: 28,
        background: 'var(--bg-header, #0e0e0e)',
        borderTop: '1px solid var(--border-default, #2a2a2a)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px',
        fontSize: '0.6875rem',
        color: 'var(--text-muted, #666)',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Left: save indicator + sync queue */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          className={`status-save ${config.cls}`}
          onClick={handleClick}
          style={{
            cursor: isClickable ? 'pointer' : 'default',
            padding: '1px 6px',
            borderRadius: 3,
            transition: 'background 0.12s',
            color: config.color,
          }}
          title={
            saveStatus === 'offline'
              ? '离线模式，数据暂存本地'
              : saveStatus === 'failed'
                ? '点击重试保存'
                : ''
          }
          onMouseEnter={e => {
            if (isClickable) (e.currentTarget as HTMLElement).style.background = 'var(--bg-raised, #1e1e1e)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {config.text}
        </span>
        {syncQueue > 0 && (
          <span
            style={{
              color: 'var(--text-muted, #666)',
              padding: '1px 6px',
              borderRadius: 3,
              marginLeft: 4,
              fontSize: '0.6875rem',
            }}
          >
            队列: {syncQueue} 项待同步
          </span>
        )}
      </div>

      {/* Right: metadata */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>
          字数:{' '}
          <span style={{ color: 'var(--text-secondary, #a0a0a0)' }}>
            {wordCount.toLocaleString()}
          </span>
        </span>
        <span style={{ color: 'var(--border-default, #2a2a2a)' }}>|</span>
        <span>
          链接:{' '}
          <span style={{ color: 'var(--text-secondary, #a0a0a0)' }}>
            {linkCount}
          </span>
        </span>
        {canonLabel && (
          <>
            <span style={{ color: 'var(--border-default, #2a2a2a)' }}>|</span>
            <span style={{ color: '#FFB74D' }}>{canonLabel}</span>
          </>
        )}
        {lastUpdateText && (
          <>
            <span style={{ color: 'var(--border-default, #2a2a2a)' }}>|</span>
            <span>{lastUpdateText}</span>
          </>
        )}
      </div>
    </div>
  );
}
