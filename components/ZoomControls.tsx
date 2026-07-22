/**
 * ZoomControls — Floating panel for canvas zoom (P1-06).
 *
 * Bottom-right floating panel: +/- 25% steps, percentage display,
 * fit canvas / reset to 100%.
 * Ctrl+wheel zoom anchored to mouse position.
 */

import { useCallback } from 'react';

interface ZoomControlsProps {
  scale: number;
  onZoomChange: (scale: number) => void;
  onFitCanvas?: () => void;
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export default function ZoomControls({ scale, onZoomChange, onFitCanvas }: ZoomControlsProps) {
  const handleZoomIn = useCallback(() => {
    const nextIdx = ZOOM_STEPS.findIndex(s => s > scale + 0.01);
    if (nextIdx >= 0) {
      onZoomChange(ZOOM_STEPS[nextIdx]);
    } else {
      onZoomChange(Math.min(3.0, scale + 0.25));
    }
  }, [scale, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const reversed = [...ZOOM_STEPS].reverse();
    const next = reversed.find(s => s < scale - 0.01);
    if (next !== undefined) {
      onZoomChange(next);
    } else {
      onZoomChange(Math.max(0.2, scale - 0.25));
    }
  }, [scale, onZoomChange]);

  const handleReset = useCallback(() => {
    onZoomChange(1.0);
  }, [onZoomChange]);

  const percentage = Math.round(scale * 100);

  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 20,
      display: 'flex', alignItems: 'center', gap: 2,
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 8, padding: 3,
      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      zIndex: 50, userSelect: 'none',
    }}>
      {/* Zoom out */}
      <button
        className="tb-btn"
        onClick={handleZoomOut}
        disabled={scale <= 0.2}
        title="缩小 (Ctrl+-)"
        style={{ width: 30, height: 30, fontSize: '0.9375rem', opacity: scale <= 0.2 ? 0.4 : 1 }}
      >
        −
      </button>

      {/* Percentage */}
      <div style={{
        minWidth: 44, textAlign: 'center', fontSize: '0.75rem',
        color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums',
      }}>
        {percentage}%
      </div>

      {/* Zoom in */}
      <button
        className="tb-btn"
        onClick={handleZoomIn}
        disabled={scale >= 3.0}
        title="放大 (Ctrl++)"
        style={{ width: 30, height: 30, fontSize: '0.9375rem', opacity: scale >= 3.0 ? 0.4 : 1 }}
      >
        +
      </button>

      {/* Fit / Reset */}
      <button
        className="tb-btn"
        onClick={onFitCanvas || handleReset}
        title="适应画布 (Ctrl+0)"
        style={{ width: 30, height: 30, fontSize: '0.8125rem' }}
      >
        ⊞
      </button>
    </div>
  );
}
