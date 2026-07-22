/**
 * AiFillCard — 通用 AI 填充卡片组件
 *
 * Pattern: AI fills first, user reviews and edits.
 * Reusable across all method-step canvases.
 *
 * Props:
 * - title: Card title
 * - aiContent: Content generated/displayed by AI
 * - children: User-editable form elements
 * - onConfirm: Called when user confirms
 * - onReTrigger: Called when user re-triggers AI
 * - loading: Whether AI is generating
 * - confirmed: Whether step is confirmed
 * - confirmDisabled: Whether confirm button is disabled
 * - confirmLabel: Custom confirm button label
 * - showReTrigger: Whether to show re-trigger AI button
 */

import React from 'react';
import { Button } from '../../../components/ui';
import DoNotAskAgainToggle from './DoNotAskAgainToggle';
import './step-progress.css';

interface AiFillCardProps {
  title: string;
  aiContent?: React.ReactNode;
  children?: React.ReactNode;
  onConfirm?: () => void;
  onReTrigger?: () => void;
  loading?: boolean;
  confirmed?: boolean;
  confirmDisabled?: boolean;
  confirmLabel?: string;
  showReTrigger?: boolean;
  doNotAskAgain?: boolean;
  onDoNotAskAgainChange?: (value: boolean) => void;
  className?: string;
}

export default function AiFillCard({
  title,
  aiContent,
  children,
  onConfirm,
  onReTrigger,
  loading = false,
  confirmed = false,
  confirmDisabled = false,
  confirmLabel = '确认并继续',
  showReTrigger = true,
  doNotAskAgain = false,
  onDoNotAskAgainChange,
  className = '',
}: AiFillCardProps) {
  if (confirmed) {
    return (
      <div className={`ai-fill-card ai-fill-card-confirmed ${className}`}>
        <div className="ai-fill-card-header">
          <span className="ai-fill-card-check">✓</span>
          <span className="ai-fill-card-title">{title}</span>
          <span className="ai-fill-card-badge">已完成</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`ai-fill-card ${className}`}>
      <div className="ai-fill-card-header">
        <span className="ai-fill-card-title">{title}</span>
        {loading && <span className="ai-fill-card-loading">AI 生成中...</span>}
      </div>

      <div className="ai-fill-card-content">
        {aiContent && (
          <div className="ai-fill-card-ai-section">
            <div className="ai-fill-card-ai-label">AI 建议</div>
            {aiContent}
          </div>
        )}

        {children && (
          <div className="ai-fill-card-edit-section">
            {children}
          </div>
        )}
      </div>

      <div className="ai-fill-card-actions">
        {onDoNotAskAgainChange !== undefined && (
          <DoNotAskAgainToggle
            checked={doNotAskAgain}
            onChange={onDoNotAskAgainChange}
          />
        )}

        <div className="ai-fill-card-buttons">
          {showReTrigger && onReTrigger && (
            <Button
              variant="secondary"
              onClick={onReTrigger}
              disabled={loading}
            >
              {loading ? '生成中...' : '重新生成'}
            </Button>
          )}

          {onConfirm && (
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={confirmDisabled || loading}
            >
              {loading ? '处理中...' : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
