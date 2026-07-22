/**
 * SparrowStepCard — Canvas 3 Sparrow Mode individual step card
 *
 * Each of the 9 steps: expandable/collapsible, AI fill, user edit,
 * do-not-ask-again toggle, confirm action.
 * Step 3 is visually marked as required.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '../../components/ui';
import DoNotAskAgainToggle from '../common/method-step/DoNotAskAgainToggle';
import type { SparrowStepId, SparrowStepState } from '../../contracts/setting.contract';
import './sparrow.css';

export interface SparrowStepCardProps {
  stepNumber: number;
  stepId: SparrowStepId;
  label: string;
  content?: string;
  isExpanded?: boolean;
  isRequired: boolean;
  isComplete: boolean;
  aiGenerated?: boolean;
  doNotAskAgain?: boolean;
  loading?: boolean;
  onToggleExpand?: () => void;
  onContentChange?: (content: string) => void;
  onConfirm?: () => void;
  onReTrigger?: () => void;
  onDoNotAskAgainChange?: (value: boolean) => void;
}

export default function SparrowStepCard({
  stepNumber,
  stepId,
  label,
  content = '',
  isExpanded = true,
  isRequired,
  isComplete,
  aiGenerated = false,
  doNotAskAgain = false,
  loading = false,
  onToggleExpand,
  onContentChange,
  onConfirm,
  onReTrigger,
  onDoNotAskAgainChange,
}: SparrowStepCardProps) {
  const [editContent, setEditContent] = useState(content);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setEditContent(val);
    onContentChange?.(val);
  }, [onContentChange]);

  const cardClass = [
    'sparrow-step-card',
    isRequired ? 'sparrow-step-card-required' : '',
    isComplete ? 'sparrow-step-card-complete' : '',
  ].filter(Boolean).join(' ');

  const numberClass = [
    'sparrow-step-number',
    isComplete ? 'sparrow-step-number-complete' : '',
    !isComplete ? 'sparrow-step-number-active' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClass}>
      {/* Header — clickable to expand/collapse */}
      <div className="sparrow-step-header" onClick={onToggleExpand}>
        <div className={numberClass}>
          {isComplete ? '✓' : stepNumber}
        </div>
        <div className="sparrow-step-label">{label}</div>
        {isRequired && !isComplete && (
          <span className="sparrow-step-required-badge">必填</span>
        )}
        {isRequired && isComplete && (
          <span className="sparrow-step-required-badge" style={{ background: 'rgba(34, 197, 94, 0.08)', color: 'var(--safe, #22C55E)' }}>
            已完成
          </span>
        )}
        {!isComplete && !isRequired && (
          <span className="sparrow-step-incomplete-badge">可选</span>
        )}
        <span className={`sparrow-step-chevron ${isExpanded ? 'sparrow-step-chevron-open' : ''}`}>
          ▾
        </span>
      </div>

      {/* Body — expandable */}
      {isExpanded && (
        <div className="sparrow-step-body">
          {/* AI generated content display */}
          {aiGenerated && content && (
            <div className="sparrow-step-ai-content">
              <div className="sparrow-step-ai-label">AI 建议</div>
              <div className="sparrow-step-ai-text">{content}</div>
            </div>
          )}

          {/* User editable textarea */}
          <textarea
            className="sparrow-step-textarea"
            value={editContent}
            onChange={handleContentChange}
            placeholder={`请输入 ${label} 的描述...`}
            rows={4}
          />

          {/* Footer with actions */}
          <div className="sparrow-step-footer">
            {onDoNotAskAgainChange && (
              <DoNotAskAgainToggle
                checked={doNotAskAgain}
                onChange={onDoNotAskAgainChange}
              />
            )}

            <div className="sparrow-step-actions">
              {onReTrigger && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onReTrigger}
                  disabled={loading}
                >
                  {loading ? '生成中...' : 'AI 生成'}
                </Button>
              )}

              {onConfirm && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onConfirm}
                  disabled={loading || !editContent.trim()}
                >
                  {loading ? '处理中...' : '确认'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
