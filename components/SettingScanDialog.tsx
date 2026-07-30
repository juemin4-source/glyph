import { ScanLine, X, Check, Loader2, AlertTriangle } from 'lucide-react';
import { useCanonStore } from '../stores/canonStore';
import { ENTITY_TYPES } from '../types/fs-ai';

interface SettingScanDialogProps {
  projectRoot: string;
  onClose: () => void;
}

export default function SettingScanDialog({ projectRoot, onClose }: SettingScanDialogProps) {
  const scanCandidates = useCanonStore((s) => s.scanCandidates);
  const scanning = useCanonStore((s) => s.scanning);
  const scanProject = useCanonStore((s) => s.scanProject);
  const acceptCandidate = useCanonStore((s) => s.acceptCandidate);
  const rejectCandidate = useCanonStore((s) => s.rejectCandidate);
  const confirmCandidates = useCanonStore((s) => s.confirmCandidates);
  const error = useCanonStore((s) => s.error);

  // Start scan on mount if not already scanned
  const started = scanCandidates.length > 0 || scanning;
  if (!started && !error) {
    // Use setTimeout to avoid calling async in render
    setTimeout(() => scanProject(projectRoot), 0);
  }

  const acceptedCount = scanCandidates.filter((c) => c.confidence === 'high').length;

  const handleConfirm = async () => {
    await confirmCandidates(projectRoot);
    onClose();
  };

  return (
    <div className="fs-ai-provider-backdrop" onClick={onClose}>
      <div className="scan-dialog" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <strong><ScanLine size={15} /> AI 设定扫描</strong>
            <span>{scanning ? '正在分析正文…' : `发现 ${scanCandidates.length} 个候选设定`}</span>
          </div>
          <button onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </header>

        {scanning && (
          <div className="scan-loading">
            <Loader2 size={20} className="scan-spinner" />
            <span>正在读取正文并提取设定…</span>
          </div>
        )}

        {error && !scanning && scanCandidates.length === 0 && (
          <div className="scan-error">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        {!scanning && scanCandidates.length > 0 && (
          <>
            <div className="scan-list">
              {scanCandidates.map((candidate) => {
                const accepted = candidate.confidence === 'high';
                const typeColor =
                  candidate.type === '人物' ? '#90CAF9'
                  : candidate.type === '地点' ? '#A5D6A7'
                  : candidate.type === '组织' ? '#CE93D8'
                  : '#FFCC80';

                return (
                  <div key={candidate.id} className={`scan-item ${accepted ? 'accepted' : ''}`}>
                    <button
                      className="scan-check"
                      onClick={() => accepted ? rejectCandidate(candidate.id) : acceptCandidate(candidate.id)}
                    >
                      <div className={`scan-checkbox ${accepted ? 'checked' : ''}`}>
                        {accepted && <Check size={11} />}
                      </div>
                    </button>
                    <div className="scan-item-body">
                      <div className="scan-item-header">
                        <span className="scan-item-name">{candidate.name}</span>
                        <span className="scan-item-type" style={{ color: typeColor }}>
                          {candidate.type}
                        </span>
                        <span className={`scan-confidence ${candidate.confidence}`}>
                          {candidate.confidence === 'high' ? '高置信' : candidate.confidence === 'medium' ? '中置信' : '低置信'}
                        </span>
                      </div>
                      <span className="scan-item-source">{candidate.sourcePath}</span>
                      {candidate.evidenceText && (
                        <blockquote className="scan-item-evidence">
                          "{candidate.evidenceText}"
                        </blockquote>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <footer className="scan-footer">
              <span>已选 {acceptedCount}/{scanCandidates.length}</span>
              <div className="scan-footer-actions">
                <button className="scan-btn secondary" onClick={onClose}>取消</button>
                <button
                  className="scan-btn primary"
                  onClick={handleConfirm}
                  disabled={acceptedCount === 0}
                >
                  确认 {acceptedCount} 项
                </button>
              </div>
            </footer>
          </>
        )}

        {!scanning && scanCandidates.length === 0 && !error && (
          <div className="scan-empty">未发现新的候选设定</div>
        )}
      </div>
    </div>
  );
}
