/**
 * PipelineNav — 五画板管道导航栏 (织梦机 v2)
 *
 * Displays 5 stage nodes horizontally: 前提 → 大纲 → 设定 → 细纲 → 正文.
 * Each node shows number, name, status badge.
 * Color scheme: locked=#666 / ready=#4A9EFF / active=#B7FF00 / done=#22C55E.
 * Top-left "← 书架" back button.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Cog, Monitor, MessageSquare, Database, MoreHorizontal } from 'lucide-react';
import './pipeline-nav.css';

export interface StageItem {
  stage: string;
  status: 'locked' | 'ready' | 'active' | 'done';
}

interface PipelineNavProps {
  stages: StageItem[];
  currentStage: string;
  onStageClick: (stage: string) => void;
  onBack: () => void;
  projectTitle: string;
  onSettingsClick?: () => void;
  onLegacySelect?: (type: 'canvas' | 'ai-chat' | 'setting-collection') => void;
}

const LEGACY_ITEMS: { type: 'canvas' | 'ai-chat' | 'setting-collection'; label: string; icon: React.ReactNode }[] = [
  { type: 'canvas', label: 'CanvasView', icon: <Monitor size={14} /> },
  { type: 'ai-chat', label: 'AI 独立页', icon: <MessageSquare size={14} /> },
  { type: 'setting-collection', label: '设定集旧版', icon: <Database size={14} /> },
];

const STAGE_LABELS: Record<string, string> = {
  premise: '前提',
  structure: '大纲',
  setting: '设定',
  packet: '细纲',
  text: '正文',
};

const STATUS_COLORS: Record<string, string> = {
  locked: '#666',
  ready: '#4A9EFF',
  active: '#B7FF00',
  done: '#22C55E',
};

const STATUS_LABELS: Record<string, string> = {
  locked: '未开放',
  ready: '就绪',
  active: '进行中',
  done: '已完成',
};

export default function PipelineNav({
  stages,
  currentStage,
  onStageClick,
  onBack,
  projectTitle,
  onSettingsClick,
  onLegacySelect,
}: PipelineNavProps) {
  const [legacyOpen, setLegacyOpen] = useState(false);
  const legacyRef = useRef<HTMLDivElement>(null);

  // Close legacy dropdown on click outside
  useEffect(() => {
    if (!legacyOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (legacyRef.current && !legacyRef.current.contains(e.target as Node)) {
        setLegacyOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [legacyOpen]);

  const handleLegacyClick = useCallback((type: 'canvas' | 'ai-chat' | 'setting-collection') => {
    setLegacyOpen(false);
    onLegacySelect?.(type);
  }, [onLegacySelect]);

  return (
    <nav className="pipeline-nav">
      <button
        className="pipeline-back-btn"
        onClick={onBack}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary, #a0a0a0)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.8rem',
          padding: '4px 8px',
          borderRadius: 4,
          transition: 'color 0.15s ease, background 0.15s ease',
        }}
        title="返回书架"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 14, height: 14 }}
        >
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        书架
      </button>

      <span className="pipeline-divider" style={{ width: 1, height: 18, background: 'var(--border-default, #2a2a2a)', margin: '0 8px' }} />

      <span className="pipeline-project-title">{projectTitle}</span>

      <div className="pipeline-stages" style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 16, flex: 1, overflow: 'hidden' }}>
        {stages.map((s, i) => {
          const label = STAGE_LABELS[s.stage] || s.stage;
          const color = STATUS_COLORS[s.status] || '#666';
          const statusLabel = STATUS_LABELS[s.status] || s.status;
          const isActive = s.stage === currentStage;
          const canClick = s.status !== 'locked' && !!onStageClick;

          return (
            <React.Fragment key={s.stage}>
              {i > 0 && (
                <span className="pipeline-arrow" style={{ color: 'var(--text-muted, #6b6b6b)', fontSize: '0.7rem', margin: '0 2px' }}>
                  →
                </span>
              )}
              <button
                className={`pipeline-stage-btn${isActive ? ' active' : ''}`}
                onClick={() => canClick && onStageClick(s.stage)}
                disabled={!canClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  border: '1px solid transparent',
                  borderRadius: 6,
                  cursor: canClick ? 'pointer' : 'default',
                  background: isActive ? 'rgba(183, 255, 0, 0.08)' : 'transparent',
                  borderColor: isActive ? 'rgba(183, 255, 0, 0.25)' : 'transparent',
                  opacity: s.status === 'locked' ? 0.45 : 1,
                  transition: 'background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease',
                  fontFamily: 'inherit',
                  fontSize: '0.78rem',
                  color: isActive ? 'var(--accent, #B7FF00)' : 'var(--text-secondary, #a0a0a0)',
                  whiteSpace: 'nowrap',
                }}
                title={`${label} — ${statusLabel}`}
              >
                <span
                  className="pipeline-stage-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: isActive ? color : 'transparent',
                    border: `1.5px solid ${color}`,
                    color: isActive ? '#0a0a0a' : color,
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {s.status === 'done' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="pipeline-stage-label">{label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
      <div className="pipeline-right-group">
        <button
          className={'pipeline-legacy-btn' + (legacyOpen ? ' open' : '')}
          onClick={() => setLegacyOpen(o => !o)}
          title="旧版工具"
        >
          <MoreHorizontal size={16} />
        </button>
        {legacyOpen && (
          <div className="pipeline-legacy-menu" ref={legacyRef}>
            <div className="pipeline-legacy-menu-label" style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted, #6b6b6b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legacy</div>
            {LEGACY_ITEMS.map(item => (
              <button
                key={item.type}
                className="pipeline-legacy-menu-item"
                onClick={() => handleLegacyClick(item.type)}
              >
                <span className="menu-item-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        )}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius-sm, 4px)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
            title="AI 设置"
          >
            <Cog size={16} />
          </button>
        )}
      </div>
    </nav>
  );
}
