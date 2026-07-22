/**
 * TextCanvas — 画板⑤ 正文编辑主组件。
 *
 * 布局：
 * ┌───────────────────────────────────────────────────────┐
 * │  左侧主区（DocumentView + chapterPacket label）  │ 右侧参考面板 │
 * │                                                   │              │
 * │  ┌─ AI 控制行 ─────────────────────────────────┐  │ PacketReference │
 * │  │ 📄 ChapterPacket 标题  [AI 写本章] 模型 ▼  │  │ Panel           │
 * │  ├───────────────────────────────────────────┤  │                │
 * │  │  DocumentView (TipTap)                    │  │  - 章节摘要      │
 * │  │                                           │  │  - 角色简档      │
 * │  │                                           │  │  - 场景列表      │
 * │  └───────────────────────────────────────────┘  │  - 知识边界      │
 * │                                                   │                │
 * └───────────────────────────────────────────────────┴──────────────┘
 *
 * 设计约束：
 * - 不改 App.tsx（由 C5 Integration 替换 text stage 渲染）
 * - 不直接调用 invoke
 * - 不含 mock AI
 * - AI 生成不做 fallback mock
 */
import { useState, useEffect, useCallback } from 'react';
import DocumentView from '../../components/DocumentView';
import PacketReferencePanel from './PacketReferencePanel';
import { generateDraftFromChapterPacket } from '../../lib/generateDraft';
import { testConnection } from '../../lib/llm-client';
import { DEFAULT_MODELS } from '../../types/ai';
import type { AiModel } from '../../types/ai';
import type { WorldObject, ObjectType, SaveStatus } from '../../types/world';
import type { ChapterPacket } from '../../contracts/chapter-packet.contract';
import { Button } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { chapterPacketsToMarkdown, suggestExportFilename } from '../../utils/markdown';
import { exportTextAsMarkdown } from '../../api/exportApi';
import './text-canvas.css';

interface TextCanvasProps {
  // ── DocumentView 透传 props ──
  currentObject: WorldObject | null;
  allObjects: WorldObject[];
  allBoardTabs: string[];
  onUpdateObject: (id: string, updates: Partial<WorldObject>) => void;
  onNavigate: (name: string) => void;
  onAddToBoard: (objectId: string, board: string) => void;
  onLockObject: (objectId: string, reason: string) => void;
  onDiscardObject: (objectId: string, reason: string) => void;
  onCreateObject: (templateType: ObjectType) => void;
  onCreateNamedObject?: (name: string, objectType: ObjectType) => void;
  saveStatus?: SaveStatus;
  onTriggerSave?: () => void;

  // ── C3 新增 ──
  /** 当前确认的 ChapterPacket，驱动右侧参考面板 */
  chapterPacket?: ChapterPacket | null;
  /** 所有可用的 packets（用于导航），C5 集成时可用 */
  chapterPackets?: ChapterPacket[];
  /** 项目名称（用于导出文件名） */
  projectName?: string;
}

export default function TextCanvas(props: TextCanvasProps) {
  const {
    currentObject,
    allObjects,
    allBoardTabs,
    onUpdateObject,
    onNavigate,
    onAddToBoard,
    onLockObject,
    onDiscardObject,
    onCreateObject,
    onCreateNamedObject,
    saveStatus,
    onTriggerSave,
    chapterPacket,
    chapterPackets,
    projectName,
  } = props;

  // ── AI state ──
  const [aiModel, setAiModel] = useState<AiModel>(DEFAULT_MODELS[0]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ── AI config check ──
  useEffect(() => {
    const hasTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    if (hasTauri) {
      setAiConfigured(true);
      return;
    }
    testConnection('http://localhost:3001/v1', '')
      .then(r => setAiConfigured(r.success))
      .catch(() => setAiConfigured(false));
  }, []);

  // ── AI Draft Generation ──

  const handleAiGenerate = async (model: AiModel) => {
    if (!chapterPacket) return;
    setAiGenerating(true);
    setShowModelPicker(false);
    setAiDraft(null);
    try {
      const draft = await generateDraftFromChapterPacket({
        packet: chapterPacket,
        model,
      });
      setAiDraft(draft);
      setShowPreviewModal(true);
    } catch (err: any) {
      console.error('[TextCanvas] AI generate error', err);
      // Show error by setting draft to error message
      setAiDraft(null);
      setShowPreviewModal(false);
      alert('AI 生成失败: ' + (err?.message || '未知错误'));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleConfirmDraft = () => {
    if (!aiDraft || !currentObject) return;
    onUpdateObject(currentObject.id, { content: aiDraft });
    setAiDraft(null);
    setShowPreviewModal(false);
  };

  const handleAbandonDraft = () => {
    setAiDraft(null);
    setShowPreviewModal(false);
  };

  // ── Markdown Export ──

  const { showToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExportMarkdown = useCallback(async () => {
    // Use chapterPackets if available, otherwise wrap the single packet
    const packets = (chapterPackets && chapterPackets.length > 0)
      ? chapterPackets
      : (chapterPacket ? [chapterPacket] : []);

    if (!projectName || packets.length === 0) {
      showToast('没有可导出的正文内容', 'info');
      return;
    }
    setIsExporting(true);
    try {
      const markdownContent = chapterPacketsToMarkdown(packets);
      const defaultName = suggestExportFilename(projectName);
      const savedPath = await exportTextAsMarkdown({
        chapterContent: markdownContent,
        defaultName,
      });
      showToast(`已导出: ${savedPath}`, 'success');
    } catch (err: any) {
      if (err?.includes?.('CANCELLED')) {
        // User cancelled the dialog — not an error
      } else {
        showToast('导出失败: ' + (err || '未知错误'), 'error');
      }
    } finally {
      setIsExporting(false);
    }
  }, [projectName, chapterPacket, chapterPackets, showToast]);

  // ── Render ──

  // 无 packet 时显示空状态引导
  if (!chapterPacket) {
    return (
      <div className="text-canvas">
        <div className="text-canvas-empty">
          <div className="text-canvas-empty-icon">📄</div>
          <div className="text-canvas-empty-title">暂无细纲包</div>
          <div className="text-canvas-empty-desc">
            当前画板⑤需要先有一个已确认的 ChapterPacket 才能开始正文写作。
            请前往画板④（排期细纲）完成一个章节包的生成和确认。
          </div>
          <div className="text-canvas-empty-action">
            <span className="text-canvas-packet-badge">→ 前往画板④</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-canvas">
      {/* ── 左侧主区 ── */}
      <div className="text-canvas-main">
        {/* AI control row */}
        <div className="text-canvas-ai-row">
          <div className="text-canvas-ai-row-info">
            <span className="text-canvas-ai-row-icon">📄</span>
            <span className="text-canvas-ai-row-title">{chapterPacket.title}</span>
            <span className="text-canvas-ai-row-meta">第{chapterPacket.chapterNumber}章 · {chapterPacket.chapterFunction || '未指定功能'}</span>
          </div>
          <div className="text-canvas-ai-row-actions">
            <button
              onClick={handleExportMarkdown}
              disabled={isExporting}
              title="导出 Markdown"
              aria-label="导出 Markdown 文件"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.75rem',
                borderRadius: 6,
                background: isExporting ? '#333' : '#1a1a2e',
                color: isExporting ? '#666' : '#90CAF9',
                border: `1px solid ${isExporting ? '#333' : '#2a2a4e'}`,
                fontSize: '0.8125rem',
                fontFamily: 'inherit',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                lineHeight: 1.4,
              }}
            >
              {isExporting ? '导出中...' : '📄 导出 .md'}
            </button>
            <Button
              variant="secondary"
              onClick={() => setShowModelPicker(true)}
              disabled={aiGenerating || aiConfigured === false}
              loading={aiGenerating}
              size="sm"
            >
              {aiConfigured === null ? '检测 AI...' : aiConfigured === false ? 'AI 未配置' : 'AI 写本章'}
            </Button>
          </div>
        </div>

        <DocumentView
          currentObject={currentObject}
          allObjects={allObjects}
          allBoardTabs={allBoardTabs}
          onUpdateObject={onUpdateObject}
          onNavigate={onNavigate}
          onAddToBoard={onAddToBoard}
          onLockObject={onLockObject}
          onDiscardObject={onDiscardObject}
          onCreateObject={onCreateObject}
          onCreateNamedObject={onCreateNamedObject}
          saveStatus={saveStatus}
          onTriggerSave={onTriggerSave}
          chapterPacket={chapterPacket}
        />
      </div>

      {/* ── 右侧参考面板 ── */}
      <div className="text-canvas-panel">
        <PacketReferencePanel packet={chapterPacket} />
      </div>

      {/* ── AI Model Picker Modal ── */}
      {showModelPicker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { if (!aiGenerating) setShowModelPicker(false); }}
        >
          <div
            style={{ background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-lg, 14px)', maxWidth: 420, width: '90%', padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>选择 AI 模型</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted, #666)', marginBottom: 16 }}>
              选择一个模型来生成正文。ChapterPacket 四层数据将作为 prompt 上下文发送给 AI。
            </p>
            {DEFAULT_MODELS.map(m => (
              <div
                key={m.id}
                onClick={() => handleAiGenerate(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 'var(--radius-sm, 6px)', cursor: aiGenerating ? 'not-allowed' : 'pointer',
                  marginBottom: 4, opacity: aiGenerating ? 0.6 : 1,
                  background: aiModel.id === m.id ? 'var(--accent-soft, rgba(183,255,0,0.1))' : 'transparent',
                  border: aiModel.id === m.id ? '1px solid rgba(183,255,0,0.2)' : '1px solid transparent',
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent, #B7FF00)', opacity: aiModel.id === m.id ? 1 : 0.2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{m.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>{m.providerName} · {m.description}</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)' }}>{m.costPer1KTokens === 0 ? '免费' : `$${m.costPer1KTokens}/1K`}</div>
              </div>
            ))}
            {aiGenerating && (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary, #a0a0a0)', fontSize: '0.8125rem' }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #444', borderTopColor: '#B7FF00', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />
                AI 正在生成正文...
              </div>
            )}
            <button
              onClick={() => setShowModelPicker(false)}
              disabled={aiGenerating}
              style={{ marginTop: 16, width: '100%', padding: '8px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-default, #2a2a2a)', background: 'transparent', color: aiGenerating ? 'var(--text-muted, #666)' : 'var(--text-secondary, #a0a0a0)', cursor: aiGenerating ? 'not-allowed' : 'pointer', fontSize: '0.8125rem' }}
            >
              {aiGenerating ? '生成中...' : '取消'}
            </button>
          </div>
        </div>
      )}

      {/* ── AI Draft Preview Modal ── */}
      {showPreviewModal && aiDraft && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { if (!aiGenerating) handleAbandonDraft(); }}
        >
          <div
            style={{ background: 'var(--bg-surface, #141414)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-lg, 14px)', maxWidth: 720, width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default, #2a2a2a)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>AI 生成结果预览</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)', margin: '4px 0 0' }}>
                  基于 {chapterPacket.title} 生成 · 共 {aiDraft.length} 字
                </p>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              <textarea
                readOnly
                value={aiDraft}
                style={{ width: '100%', minHeight: 300, background: 'var(--bg-input, #0a0a0a)', border: '1px solid var(--border-default, #2a2a2a)', borderRadius: 'var(--radius-sm, 6px)', color: 'var(--text-primary, #e0e0e0)', fontSize: '0.875rem', lineHeight: 1.8, padding: 16, fontFamily: 'var(--font-mono, monospace)', resize: 'none' }}
              />
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-default, #2a2a2a)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={handleAbandonDraft}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid var(--border-default, #2a2a2a)', background: 'transparent', color: 'var(--text-secondary, #a0a0a0)', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                放弃
              </button>
              <button
                onClick={handleConfirmDraft}
                disabled={!currentObject}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm, 6px)', border: 'none', background: !currentObject ? '#444' : 'var(--accent, #B7FF00)', color: !currentObject ? '#888' : '#0a0a0a', cursor: !currentObject ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 500 }}
              >
                {currentObject ? '确认写入正文' : '请先创建章节对象'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
