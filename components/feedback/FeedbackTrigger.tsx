/**
 * FeedbackTrigger — 底部悬浮反馈入口按钮。
 *
 * 固定在右下角，点击打开 FeedbackModal。
 * 只在有活跃项目时渲染（由父组件控制）。
 */
import { type MouseEvent } from 'react';
import './feedback.css';

export interface FeedbackTriggerProps {
  projectId: string;
  onOpen: () => void;
}

export function FeedbackTrigger({ onOpen }: FeedbackTriggerProps) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onOpen();
  };

  return (
    <button
      className="feedback-trigger"
      onClick={handleClick}
      title="反馈意见"
      aria-label="反馈意见"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
