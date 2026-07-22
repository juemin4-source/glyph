/**
 * CanonGuideCard — Popup that appears after 3rd object creation (P1-07).
 * Explains 4 canon levels with colored examples.
 * "不再显示" checkbox sets localStorage flag.
 */

import { useState } from 'react';
import { CANON_LEVELS, CANON_COLORS } from '../types/world';
import { Globe } from 'lucide-react';

interface CanonGuideCardProps {
  onDismiss: (dontShowAgain: boolean) => void;
}

const CANON_EXAMPLES: Array<{ level: string; color: string; example: string; description: string }> = [
  { level: '未收录', color: CANON_COLORS['未收录'], example: '灵感笔记', description: '初步构想，尚未确认是否纳入世界' },
  { level: '草案正典', color: CANON_COLORS['草案正典'], example: '初步设定', description: '初步认定，还在打磨和验证阶段' },
  { level: '项目正典', color: CANON_COLORS['项目正典'], example: '核心设定', description: '团队/个人认可的正典设定' },
  { level: '核心正典', color: CANON_COLORS['核心正典'], example: '基石设定', description: '不可更改的世界基石，修改需裁决' },
];

export default function CanonGuideCard({ onDismiss }: CanonGuideCardProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <div className="dialog-overlay" style={{ zIndex: 600 }}>
      <div
        className="dialog-box"
        style={{ minWidth: 420, maxWidth: 500 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Globe size={32} />
          <h4 style={{ fontSize: 17, marginTop: 8, color: '#f0f0f0' }}>正典等级 — 管理设定的可信度</h4>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            织梦机用「正典」来管理你世界设定的稳定性。每个对象有四个等级：
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {CANON_EXAMPLES.map((item, i) => (
            <div
              key={item.level}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 8,
                background: i === 3 ? `rgba(255, 183, 77, 0.08)` : i === 2 ? `rgba(144, 202, 249, 0.08)` : 'transparent',
                border: `1px solid ${item.color}33`,
              }}
            >
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: item.color,
                flexShrink: 0,
                boxShadow: `0 0 6px ${item.color}66`,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: item.color }}>{item.level}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{item.description}</div>
              </div>
              <div style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 4,
                background: `${item.color}22`, color: item.color,
                whiteSpace: 'nowrap',
              }}>
                {item.example}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: '#666', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>
          在右侧面板中，你可以将对象「收录为设定」或提升正典等级。
          {CANON_LEVELS[3]}修改需要填写裁决原因。
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={e => setDontShowAgain(e.target.checked)}
              style={{ accentColor: '#B7FF00' }}
            />
            不再显示
          </label>
          <button
            className="ia-btn"
            style={{ background: '#B7FF00', color: '#0a0a0a', fontWeight: 600, padding: '8px 20px', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            onClick={() => onDismiss(dontShowAgain)}
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if canon guide should be shown for a project.
 */
export function shouldShowCanonGuide(projectId: string): boolean {
  try {
    return localStorage.getItem(`zhimengji-canon-guide-done-${projectId}`) !== 'true';
  } catch {
    return true;
  }
}
