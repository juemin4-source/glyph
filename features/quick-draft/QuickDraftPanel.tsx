/**
 * QuickDraftPanel — 一键速写交互面板
 *
 * States: INPUT → LOADING → PREVIEW (or ERROR)
 *
 * Flow:
 * 1. User types story idea in textarea → clicks "一键生成正文"
 * 2. Calls quickDraftApi.generateQuickDraft() → shows loading
 * 3. Receives QuickDraftGenerateResult → shows preview
 * 4. User clicks "转入正式管线" → calls quickDraftApi.transferQuickDraft()
 * 5. On success → calls onTransferred(projectId)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { transferQuickDraft } from '../../api/quickDraftApi';
import { generateQuickDraft as aiGenerateQuickDraft } from '../../lib/ai/quick-draft';
import { createProject } from '../../tauri-api';
import type { QuickDraftGenerateResult } from '../../contracts/quick-draft.contract';
import DraftPreview from './DraftPreview';

interface QuickDraftPanelProps {
  onClose: () => void;
  onTransferred: (projectId: string) => void;
}

type PanelState = 'input' | 'loading' | 'preview' | 'error';

export default function QuickDraftPanel({ onClose, onTransferred }: QuickDraftPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('input');
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState<QuickDraftGenerateResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    if (panelState === 'input' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [panelState]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && panelState !== 'loading') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, panelState]);

  const handleGenerate = useCallback(async () => {
    const trimmed = userInput.trim();
    if (!trimmed) {
      setErrorMsg('请输入你的故事想法');
      setPanelState('error');
      return;
    }

    setPanelState('loading');
    setErrorMsg('');

    try {
      // Ensure a project exists for the draft
      let pid = currentProjectId;
      if (!pid) {
        const dto = await createProject(
          `速写草稿 - ${trimmed.slice(0, 20)}${trimmed.length > 20 ? '...' : ''}`,
          '未分类',
          'conceiving',
          0,
          '["#6366f1","#8b5cf6"]',
        );
        pid = dto.id;
        setCurrentProjectId(pid);
      }

      const genResult = await aiGenerateQuickDraft({ projectId: pid, userInput: trimmed });
      setResult(genResult);
      setPanelState('preview');
    } catch (err: any) {
      console.error('QuickDraft generation failed:', err);
      setErrorMsg(err?.message || err?.toString() || '生成失败，请稍后重试');
      setPanelState('error');
    }
  }, [userInput, currentProjectId]);

  const handleTransfer = useCallback(async () => {
    if (!result) return;
    setTransferring(true);

    try {
      const transferred = await transferQuickDraft({ draftId: result.draft.id });
      onTransferred(transferred.projectId);
    } catch (err: any) {
      console.error('QuickDraft transfer failed:', err);
      setErrorMsg(err?.message || err?.toString() || '转入正式管线失败');
      setTransferring(false);
    }
  }, [result, onTransferred]);

  const handleRegenerate = useCallback(() => {
    setResult(null);
    setPanelState('input');
  }, []);

  const handleRetry = useCallback(() => {
    setErrorMsg('');
    setPanelState('input');
  }, []);

  // Overlay backdrop style
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  };

  // Panel card style
  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85vh',
    overflowY: 'auto',
    background: '#0e0e0e',
    border: '1px solid #2a2a2a',
    borderRadius: 14,
    padding: '1.5rem',
    boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 96,
    padding: '0.75rem',
    borderRadius: 8,
    background: '#141416',
    color: '#e0e0e0',
    border: '1px solid #2a2a2a',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    resize: 'vertical',
    outline: 'none',
  };

  return (
    <div style={backdropStyle} onClick={(e) => { if (e.target === e.currentTarget && panelState !== 'loading') onClose(); }}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={titleStyle}>
            <span style={{ fontSize: '1.1rem' }}>&#x26A1;</span>
            一键速写
          </div>
          <button
            onClick={onClose}
            disabled={panelState === 'loading'}
            aria-label="关闭"
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            &#10005;
          </button>
        </div>

        <div style={{ fontSize: '0.75rem', color: '#666', lineHeight: 1.5 }}>
          写下你的故事想法，AI 将为你生成正文草稿和章节结构。
          {panelState === 'preview' && result && (
            <> 预览满意后，一键转入正式创作管线。</>
          )}
        </div>

        {/* ===== INPUT STATE ===== */}
        {panelState === 'input' && (
          <>
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="写下你的故事想法...&#10;&#10;例如：一个程序员意外穿越到修仙世界，&#10;发现自己写的代码在这个世界竟然变成了法术..."
              style={textareaStyle}
              rows={4}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  background: 'transparent',
                  color: '#a0a0a0',
                  border: '1px solid #2a2a2a',
                  fontSize: '0.8125rem',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleGenerate}
                disabled={!userInput.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  background: userInput.trim() ? '#B7FF00' : '#444',
                  color: userInput.trim() ? '#0a0a0a' : '#888',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: userInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                &#x2728; 一键生成正文
              </button>
            </div>
          </>
        )}

        {/* ===== LOADING STATE ===== */}
        {panelState === 'loading' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              padding: '2rem 0',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                border: '3px solid #2a2a2a',
                borderTopColor: '#B7FF00',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <div style={{ fontSize: '0.8125rem', color: '#888' }}>
              正在生成...
            </div>
          </div>
        )}

        {/* ===== PREVIEW STATE ===== */}
        {panelState === 'preview' && result && (
          <DraftPreview
            result={result}
            onRegenerate={handleRegenerate}
            onTransfer={handleTransfer}
            transferring={transferring}
          />
        )}

        {/* ===== ERROR STATE ===== */}
        {panelState === 'error' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1.5rem 0',
            }}
          >
            <div style={{ fontSize: '1.5rem', color: '#f44336' }}>&#10060;</div>
            <div style={{ fontSize: '0.8125rem', color: '#e0e0e0', textAlign: 'center' }}>
              {errorMsg || '生成失败，请稍后重试'}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  background: 'transparent',
                  color: '#a0a0a0',
                  border: '1px solid #2a2a2a',
                  fontSize: '0.8125rem',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleRetry}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  background: '#B7FF00',
                  color: '#0a0a0a',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                重试
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe style for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
