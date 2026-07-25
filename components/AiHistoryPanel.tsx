import { ChevronDown, ChevronRight, FileText, RotateCcw, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AiActionSummary } from '../types/fs-ai';
import { useFsStore } from '../stores/fsStore';

const STATUS_LABEL: Record<string, string> = {
  planned: '等待执行',
  generating: '正在生成',
  ready_to_commit: '准备写入',
  committing: '正在写入',
  completed: '已完成',
  failed: '已失败',
  cancelled: '已取消',
  blocked: '已阻止',
  reverted: '已撤销',
};

const ACTION_TYPE_LABEL: Record<string, string> = {
  create: '新建文件',
  modify: '修改文件',
};

interface AiHistoryPanelProps {
  onOpenFile: (path: string) => Promise<boolean>;
}

function ActionCard({ action, onOpenFile }: { action: AiActionSummary; onOpenFile: (path: string) => Promise<boolean> }) {
  const [expanded, setExpanded] = useState(false);
  const revertAction = useFsStore((s) => s.revertAction);
  const loadActionHistory = useFsStore((s) => s.loadActionHistory);
  const [reverting, setReverting] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  const canRevert = action.status === 'completed' && !action.revertedAt;
  const isReverted = !!action.revertedAt;

  const handleRevert = useCallback(async () => {
    if (!canRevert || reverting) return;
    setReverting(true);
    setRevertError(null);
    try {
      const result = await revertAction({
        operationId: action.operationId,
        targetPath: action.targetPath,
        expectedVersion: action.newVersion || '',
      });
      if (result && !result.restored) {
        setRevertError(result.reason || '撤销失败');
      }
      await loadActionHistory();
    } catch (e) {
      setRevertError(String(e));
    } finally {
      setReverting(false);
    }
  }, [canRevert, reverting, revertAction, loadActionHistory, action.operationId, action.targetPath, action.newVersion]);

  const statusText = isReverted ? '已撤销' : (STATUS_LABEL[action.status] || action.status);
  const actionLabel = ACTION_TYPE_LABEL[action.actionType] || action.actionType;
  const timeStr = new Date(action.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <article className={`fs-ai-task ${isReverted ? 'fs-ai-task-reverted' : ''}`}>
      <div className="fs-ai-action-summary" style={{ cursor: 'pointer' }} onClick={() => setExpanded((v) => !v)}>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className={`fs-ai-phase-dot fs-ai-phase-dot-${action.status}`} />
        <strong>{actionLabel}</strong>
        <span className="fs-ai-action-path">{action.targetPath}</span>
        <span className="fs-ai-action-time">{timeStr}</span>
      </div>

      <div className="fs-ai-task-state">
        <span>{statusText}</span>
        {action.instruction && <span className="fs-ai-phase-detail">· {action.instruction.slice(0, 120)}</span>}
      </div>

      {expanded && (
        <div className="fs-ai-history-detail">
          {action.changeSummary && (
            <div className="fs-ai-history-field">
              <strong>变更摘要</strong>
              <p>{action.changeSummary}</p>
            </div>
          )}
          {action.error && (
            <div className="fs-ai-error">{action.error}</div>
          )}
          <div className="fs-ai-history-actions">
            <button className="fs-ai-open-source" onClick={() => void onOpenFile(action.targetPath)}>
              <FileText size={13} /> 打开文件
            </button>
            {canRevert && (
              <button className="fs-ai-revert-btn" onClick={handleRevert} disabled={reverting}>
                <RotateCcw size={13} /> {reverting ? '撤销中…' : '撤销本次修改'}
              </button>
            )}
          </div>
          {revertError && <div className="fs-ai-error">{revertError}</div>}
        </div>
      )}
    </article>
  );
}

export default function AiHistoryPanel({ onOpenFile }: AiHistoryPanelProps) {
  const actionHistory = useFsStore((s) => s.actionHistory);
  const actionHistoryLoading = useFsStore((s) => s.actionHistoryLoading);
  const actionHistoryError = useFsStore((s) => s.actionHistoryError);
  const loadActionHistory = useFsStore((s) => s.loadActionHistory);

  useEffect(() => {
    if (actionHistory.length === 0 && !actionHistoryLoading) {
      loadActionHistory().catch(() => {});
    }
  }, [actionHistory.length, actionHistoryLoading, loadActionHistory]);

  if (actionHistoryLoading && actionHistory.length === 0) {
    return (
      <section className="fs-ai-panel" aria-label="AI 操作历史">
        <header className="fs-ai-header">
          <div>
            <strong><RotateCcw size={14} /> AI 操作历史</strong>
            <span>正在加载操作记录…</span>
          </div>
        </header>
      </section>
    );
  }

  if (actionHistoryError && actionHistory.length === 0) {
    return (
      <section className="fs-ai-panel" aria-label="AI 操作历史">
        <header className="fs-ai-header">
          <div>
            <strong><RotateCcw size={14} /> AI 操作历史</strong>
            <span>加载失败</span>
          </div>
        </header>
        <div className="fs-ai-task-list">
          <div className="fs-ai-empty" style={{ minHeight: 100 }}>
            <strong>无法加载操作历史</strong>
            <p>{actionHistoryError}</p>
          </div>
        </div>
      </section>
    );
  }

  if (actionHistory.length === 0) {
    return (
      <section className="fs-ai-panel" aria-label="AI 操作历史">
        <header className="fs-ai-header">
          <div>
            <strong><RotateCcw size={14} /> AI 操作历史</strong>
            <span>AI 尚未对作品执行写入操作</span>
          </div>
        </header>
        <div className="fs-ai-task-list">
          <div className="fs-ai-empty">
            <Sparkles size={24} />
            <strong>还没有操作记录</strong>
            <p>当 AI 副手创建或修改文件后，操作历史会显示在这里。你可以查看每次修改的详情，必要时撤销 AI 的写入。</p>
          </div>
        </div>
      </section>
    );
  }

  // Show newest first
  const sorted = [...actionHistory].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <section className="fs-ai-panel" aria-label="AI 操作历史">
      <header className="fs-ai-header">
        <div>
          <strong><RotateCcw size={14} /> AI 操作历史</strong>
          <span>{actionHistory.length} 次操作</span>
        </div>
        <button
          className="fs-ai-evidence-toggle"
          style={{ width: 'auto', padding: '4px 10px', fontSize: 11 }}
          onClick={() => loadActionHistory().catch(() => {})}
          disabled={actionHistoryLoading}
        >
          {actionHistoryLoading ? '刷新中…' : '刷新'}
        </button>
      </header>

      <div className="fs-ai-task-list">
        {sorted.map((action) => (
          <ActionCard key={action.operationId} action={action} onOpenFile={onOpenFile} />
        ))}
      </div>
    </section>
  );
}
