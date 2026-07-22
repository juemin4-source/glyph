/**
 * AiWritePreviewPanel — AI 写入预览面板 (织梦机 v2 / D2-UX)
 *
 * 用于 write_preview 类型的 AI 输出展示。
 * AI 生成内容显示为预览，用户确认后才写入正式数据。
 * 从 TextCanvas 的预览弹窗提取为独立组件。
 */

import { useState } from 'react';
import type { AiOutputType } from '../../lib/ai-output';
import type { ParseResult } from '../../lib/ai/structured-parser';

export interface AiWritePreviewPanelProps {
  /** 预览内容 */
  content: string;
  /** 标题（如章节标题、字段名） */
  title: string;
  /** 副标题/说明 */
  subtitle?: string;
  /** AI 输出三态类型 */
  outputType?: AiOutputType;
  /** 字数统计标签 */
  statsLabel?: string;
  /** 结构化解析输出（包含验证状态和数据字段） */
  structuredData?: ParseResult;
  /** 确认回调 */
  onConfirm: () => void;
  /** 放弃回调 */
  onAbandon: () => void;
  /** 是否打开 */
  open: boolean;
}

export default function AiWritePreviewPanel({
  content,
  title,
  subtitle,
  statsLabel,
  structuredData,
  onConfirm,
  onAbandon,
  open,
}: AiWritePreviewPanelProps) {
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const charCount = content.length;
  const statText = statsLabel || `共 ${charCount} 字`;

  const handleConfirm = () => {
    setConfirming(true);
    try {
      onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => { if (!confirming) onAbandon(); }}
    >
      <div
        style={{
          background: 'var(--bg-surface, #141414)',
          border: '1px solid var(--border-default, #2a2a2a)',
          borderRadius: 'var(--radius-lg, 14px)',
          maxWidth: 720, width: '90%',
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default, #2a2a2a)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary, #e0e0e0)' }}>
              AI 生成结果预览
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)', margin: '4px 0 0' }}>
              {subtitle || `基于 ${title} 生成`} · {statText}
            </p>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent, #B7FF00)', background: 'rgba(183,255,0,0.08)', padding: '4px 10px', borderRadius: 4 }}>
            待确认写入
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {/* Parser validation status */}
          {structuredData && structuredData.status !== 'fallback' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8,
              padding: '4px 10px', borderRadius: 4, fontSize: '0.7rem',
              background: structuredData.status === 'valid'
                ? 'rgba(76,175,80,0.08)' : 'rgba(255,193,7,0.08)',
              color: structuredData.status === 'valid'
                ? 'var(--success, #4CAF50)' : '#FFC107',
              border: '1px solid ' + (structuredData.status === 'valid'
                ? 'rgba(76,175,80,0.15)' : 'rgba(255,193,7,0.15)'),
            }}>
              <span>结构化解析: {structuredData.status === 'valid' ? '全部通过' : '已自动修复'} </span>
              {structuredData.validationErrors.length > 0 && (
                <span style={{ marginLeft: 4, color: '#FFC107' }}>
                  ({structuredData.validationErrors.length} 个修复)
                </span>
              )}
            </div>
          )}

          {/* Structured data display — field by field */}
          {structuredData && structuredData.data && Object.keys(structuredData.data).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
              {Object.entries(structuredData.data).map(([key, value]) => (
                <div key={key} style={{
                  background: 'var(--bg-raised, #1e1e1e)',
                  border: '1px solid var(--border-default, #2a2a2a)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '6px 12px', fontSize: '0.7rem', fontWeight: 600,
                    color: 'var(--accent, #B7FF00)',
                    background: 'rgba(183,255,0,0.05)',
                    borderBottom: '1px solid var(--border-default, #2a2a2a)',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {key}
                  </div>
                  <div style={{ padding: '8px 12px' }}>
                    {typeof value === 'string' ? (
                      <div style={{
                        fontSize: '0.8125rem', lineHeight: 1.8,
                        color: 'var(--text-primary, #e0e0e0)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {value}
                      </div>
                    ) : (
                      <pre style={{
                        margin: 0, fontSize: '0.75rem', lineHeight: 1.5,
                        fontFamily: 'var(--font-mono, monospace)',
                        color: 'var(--text-secondary, #a0a0a0)',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Raw content display (fallback when no structured data, or additional view) */}
          <textarea
            readOnly
            value={content}
            style={{
              width: '100%', minHeight: structuredData && Object.keys(structuredData.data).length > 0 ? 150 : 300,
              background: 'var(--bg-input, #0a0a0a)',
              border: '1px solid var(--border-default, #2a2a2a)',
              borderRadius: 'var(--radius-sm, 6px)',
              color: 'var(--text-primary, #e0e0e0)',
              fontSize: '0.875rem', lineHeight: 1.8,
              padding: 16,
              fontFamily: 'var(--font-mono, monospace)',
              resize: 'none',
            }}
          />

          {/* Repair log */}
          {structuredData && structuredData.repairLog && structuredData.repairLog.length > 0 && (
            <div style={{
              marginTop: 8, fontSize: '0.65rem', color: 'var(--text-muted, #666)',
              fontStyle: 'italic', padding: '6px 10px',
              background: 'rgba(255,193,7,0.04)',
              border: '1px solid rgba(255,193,7,0.1)',
              borderRadius: 4,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>自动修复记录:</div>
              {structuredData.repairLog.map((log, i) => (
                <div key={i}>- {log}</div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-default, #2a2a2a)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            onClick={onAbandon}
            disabled={confirming}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid var(--border-default, #2a2a2a)',
              background: 'transparent',
              color: confirming ? 'var(--text-muted, #666)' : 'var(--text-secondary, #a0a0a0)',
              cursor: confirming ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            放弃
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm, 6px)',
              border: 'none',
              background: confirming ? '#444' : 'var(--accent, #B7FF00)',
              color: confirming ? '#888' : '#0a0a0a',
              cursor: confirming ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem', fontWeight: 500,
            }}
          >
            {confirming ? '确认中...' : '确认写入'}
          </button>
        </div>
      </div>
    </div>
  );
}
