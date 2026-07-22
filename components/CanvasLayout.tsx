/**
 * CanvasLayout — 画板骨架组件
 *
 * 统一 5 个画板的导航 + 标题 + 内容区布局。
 * 逐步替换各 canvas 中的重复导航代码。
 */

import type { ReactNode } from 'react';

interface CanvasLayoutProps {
  title: string;
  subtitle?: string;
  /** 右上角操作区 */
  actions?: ReactNode;
  /** AI 输入条 */
  aiBar?: ReactNode;
  /** 主要内容 */
  children: ReactNode;
}

export function CanvasLayout({ title, subtitle, actions, aiBar, children }: CanvasLayoutProps) {
  return (
    <div className="canvas-container" style={{
      display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-surface, #141414)',
    }}>
      {/* Header */}
      <div className="canvas-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border-default, #2a2a2a)',
      }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #a0a0a0)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>

      {/* AI Bar */}
      {aiBar && <div className="canvas-ai-bar">{aiBar}</div>}

      {/* Content */}
      <div className="canvas-content" style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {children}
      </div>
    </div>
  );
}

export function CanvasHeader({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
