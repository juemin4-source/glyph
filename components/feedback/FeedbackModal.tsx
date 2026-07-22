/**
 * FeedbackModal — 反馈收集弹窗。
 *
 * 状态：
 * - Input: 评分选择器 + 选填文本
 * - Submitting: 提交中，按钮禁用
 * - Success: 感谢信息，3秒后自动关闭
 * - Error: 错误重试
 * - Validation: 评分必须 ≥ 1
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { submitFeedback } from '../../api/feedbackApi';
import './feedback.css';

export interface FeedbackModalProps {
  projectId: string;
  onClose: () => void;
}

type ModalView = 'input' | 'submitting' | 'success';

export function FeedbackModal({ projectId, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [view, setView] = useState<ModalView>('input');
  const [error, setError] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (rating === 0) {
      setError('请选择一个评分');
      return;
    }
    setError(null);
    setView('submitting');
    try {
      await submitFeedback({
        projectId,
        rating,
        feedbackText: comment,
      });
      setView('success');
      closeTimerRef.current = setTimeout(() => onClose(), 3000);
    } catch (err) {
      setError('提交失败，请稍后重试');
      setView('input');
    }
  }, [rating, comment, projectId, onClose]);

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleStarClick = useCallback((value: number) => {
    if (view === 'input') setRating(value);
  }, [view]);

  return (
    <div className="feedback-overlay" onClick={handleOverlayClick}>
      <div className="feedback-modal" role="dialog" aria-modal="true" aria-label="反馈">
        {view === 'success' ? (
          /* ── Success View ── */
          <div className="feedback-success">
            <div className="feedback-success-icon">✅</div>
            <h3 className="feedback-success-title">感谢你的反馈！</h3>
            <p className="feedback-success-desc">我们会认真阅读每一条意见。</p>
            <button className="feedback-btn feedback-btn-secondary" onClick={onClose}>
              关闭
            </button>
          </div>
        ) : (
          /* ── Input / Submitting View ── */
          <>
            <div className="feedback-header">
              <h3 className="feedback-title">帮助我们做得更好</h3>
              <button className="feedback-close" onClick={onClose} aria-label="关闭">✕</button>
            </div>
            <div className="feedback-body">
              <p className="feedback-prompt">你觉得织梦机怎么样？</p>

              {/* ⭐ Star Rating */}
              <div className="feedback-stars">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    className={`feedback-star ${value <= rating ? 'feedback-star-active' : ''}`}
                    onClick={() => handleStarClick(value)}
                    disabled={view === 'submitting'}
                    aria-label={`${value}星`}
                    type="button"
                  >
                    {value <= rating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>

              {/* Optional Text */}
              <textarea
                className="feedback-textarea"
                placeholder="有什么想对我们说的吗？（选填）"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={view === 'submitting'}
                rows={4}
              />

              {/* Error */}
              {error && <p className="feedback-error">{error}</p>}
            </div>
            <div className="feedback-footer">
              <button
                className="feedback-btn feedback-btn-ghost"
                onClick={handleSkip}
                disabled={view === 'submitting'}
              >
                跳过
              </button>
              <button
                className="feedback-btn feedback-btn-primary"
                onClick={handleSubmit}
                disabled={view === 'submitting'}
              >
                {view === 'submitting' ? (
                  <>
                    <span className="feedback-spinner" />
                    提交中...
                  </>
                ) : (
                  '提交反馈'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
