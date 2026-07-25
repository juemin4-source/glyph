import { AlertTriangle, FileText, Eye, EyeOff, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { AiActionDetail } from '../types/fs-ai';

interface AiRevertConflictDialogProps {
  action: AiActionDetail;
  currentContent: string;
  onClose: () => void;
  onViewOlder: () => Promise<void>;
  onSaveOlder: () => Promise<void>;
  onKeepCurrent: () => void;
  onOverwrite: () => Promise<void>;
}

export default function AiRevertConflictDialog({
  action,
  currentContent,
  onClose,
  onViewOlder,
  onSaveOlder,
  onKeepCurrent,
  onOverwrite,
}: AiRevertConflictDialogProps) {
  const [showCurrent, setShowCurrent] = useState(true);
  const [overwriteConfirming, setOverwriteConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleViewOlder = useCallback(async () => {
    setBusy(true);
    try { await onViewOlder(); } finally { setBusy(false); }
  }, [onViewOlder]);

  const handleSaveOlder = useCallback(async () => {
    setBusy(true);
    try { await onSaveOlder(); } finally { setBusy(false); }
  }, [onSaveOlder]);

  const handleOverwrite = useCallback(async () => {
    setBusy(true);
    try { await onOverwrite(); } finally { setBusy(false); }
  }, [onOverwrite]);

  return (
    <div className="fs-ai-provider-backdrop" onClick={onClose}>
      <div className="fs-revert-conflict-dialog" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <strong><AlertTriangle size={15} /> 撤销冲突</strong>
            <span>文件已在 AI 写入后发生变化，无法直接恢复。</span>
          </div>
          <button onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </header>

        <div className="fs-revert-conflict-info">
          <p><strong>操作：</strong>{action.instruction || action.changeSummary || action.operationId}</p>
          <p><strong>目标文件：</strong>{action.targetPath}</p>
          <p><strong>快照文件：</strong>{action.snapshotPath || '无'}</p>
        </div>

        <div className="fs-revert-conflict-content">
          <div className="fs-revert-conflict-tabs">
            <button
              className={`fs-revert-conflict-tab ${showCurrent ? 'active' : ''}`}
              onClick={() => setShowCurrent(true)}
            >
              <Eye size={13} /> 当前文件内容
            </button>
            <button
              className={`fs-revert-conflict-tab ${!showCurrent ? 'active' : ''}`}
              onClick={() => setShowCurrent(false)}
            >
              <EyeOff size={13} /> 快照版本（AI 修改前）
            </button>
          </div>
          <pre className="fs-revert-conflict-pre">
            {showCurrent ? currentContent : '(从快照加载……)'}
          </pre>
        </div>

        <div className="fs-revert-conflict-actions">
          {!overwriteConfirming ? (
            <>
              <button className="fs-revert-conflict-btn secondary" onClick={handleViewOlder} disabled={busy}>
                <FileText size={13} /> 查看快照
              </button>
              <button className="fs-revert-conflict-btn secondary" onClick={handleSaveOlder} disabled={busy}>
                <FileText size={13} /> 另存快照
              </button>
              <button className="fs-revert-conflict-btn" onClick={onKeepCurrent} disabled={busy}>
                保留当前
              </button>
              <button className="fs-revert-conflict-btn danger" onClick={() => setOverwriteConfirming(true)} disabled={busy}>
                <AlertTriangle size={13} /> 覆盖
              </button>
            </>
          ) : (
            <div className="fs-revert-confirm-row">
              <span>确认用旧版本覆盖当前文件？此操作不可撤销。</span>
              <button className="fs-revert-conflict-btn danger" onClick={handleOverwrite} disabled={busy}>
                {busy ? '覆盖中…' : '确认覆盖'}
              </button>
              <button className="fs-revert-conflict-btn secondary" onClick={() => setOverwriteConfirming(false)}>
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
