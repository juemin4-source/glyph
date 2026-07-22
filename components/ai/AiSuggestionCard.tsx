/**
 * AiSuggestionCard — AI 建议卡组件 (织梦机 v2 / D2-UX)
 *
 * 用于 suggest 类型的 AI 输出展示。
 * 用户采纳后才写入画板数据。
 * 可展示在画板字段旁的内联建议。
 */

import { useState } from 'react';
import { Lightbulb, Check, X, CheckCircle, Info } from 'lucide-react';
import type { AiOutputType } from '../../lib/ai-output';
import type { ParseResult } from '../../lib/ai/structured-parser';

export interface AiSuggestionCardProps {
  /** 唯一标识 */
  id: string;
  /** 建议标题 */
  title: string;
  /** 建议内容 */
  content: string;
  /** 建议来源的 outputType */
  outputType?: AiOutputType;
  /** 建议的字段/目标描述 */
  target?: string;
  /** 结构化解析输出（包含验证状态和数据字段） */
  structuredData?: ParseResult;
  /** 采纳回调 */
  onAccept: (id: string) => void;
  /** 忽略回调 */
  onDismiss: (id: string) => void;
  /** 修改建议回调 */
  onModify?: (id: string) => void;
}

export default function AiSuggestionCard({
  id,
  title,
  content,
  target,
  structuredData,
  onAccept,
  onDismiss,
  onModify,
}: AiSuggestionCardProps) {
  const [accepted, setAccepted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (accepted) {
    return (
      <div style={{
        padding: '8px 12px', borderRadius: 6,
        background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.2)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.75rem', color: 'var(--safe, #4CAF50)',
      }}>
        <Check size={14} />
        <span>已采纳: {title}</span>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid rgba(183,255,0,0.15)',
      borderRadius: 8,
      background: 'rgba(183,255,0,0.03)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'rgba(183,255,0,0.05)',
        borderBottom: '1px solid rgba(183,255,0,0.08)',
        fontSize: '0.75rem', fontWeight: 600,
        color: 'var(--accent, #B7FF00)',
      }}>
        <Lightbulb size={14} />
        <span>AI 建议{target ? ` — ${target}` : ''}</span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary, #e0e0e0)', marginBottom: 4 }}>
          {title}
        </div>

        {/* Parser validation status */}
        {structuredData && structuredData.status !== 'fallback' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            marginBottom: 6, padding: '2px 8px',
            background: structuredData.status === 'valid'
              ? 'rgba(76,175,80,0.06)'
              : 'rgba(255,193,7,0.06)',
            borderRadius: 4, fontSize: '0.65rem',
            color: structuredData.status === 'valid'
              ? 'var(--success, #4CAF50)'
              : '#FFC107',
          }}>
            {structuredData.status === 'valid'
              ? <CheckCircle size={11} />
              : <Info size={11} />
            }
            <span>解析状态: {structuredData.status === 'valid' ? '验证通过' : '已自动修复'}</span>
          </div>
        )}

        {/* Structured data display */}
        {structuredData && structuredData.data && Object.keys(structuredData.data).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(structuredData.data).map(([key, value]) => (
              <div key={key} style={{
                background: 'var(--bg-raised, #1e1e1e)',
                border: '1px solid var(--border-default, #2a2a2a)',
                borderRadius: 6, padding: '8px 10px',
              }}>
                <div style={{
                  fontSize: '0.65rem', fontWeight: 600,
                  color: 'var(--accent, #B7FF00)',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  marginBottom: 4,
                }}>
                  {key}
                </div>
                <div style={{
                  fontSize: '0.75rem', color: 'var(--text-secondary, #a0a0a0)',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap',
                }}>
                  {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                </div>
              </div>
            ))}
            {/* Fallback content (title summary) */}
            {content && !Object.values(structuredData.data).some(v =>
              typeof v === 'string' && v.length > 0,
            ) && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #666)', lineHeight: 1.6, marginTop: 4 }}>
                {content}
              </div>
            )}
          </div>
        ) : (
          /* Plain text fallback */
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #a0a0a0)', lineHeight: 1.6 }}>
            {content}
          </div>
        )}

        {/* Repair log */}
        {structuredData && structuredData.repairLog && structuredData.repairLog.length > 0 && (
          <div style={{
            marginTop: 6, fontSize: '0.6rem', color: 'var(--text-muted, #666)',
            fontStyle: 'italic', padding: '4px 8px', background: 'rgba(255,193,7,0.04)',
            borderRadius: 4,
          }}>
            {structuredData.repairLog.map((log, i) => (
              <div key={i}>修复提示: {log}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{
        display: 'flex', gap: 6, padding: '8px 12px',
        borderTop: '1px solid var(--border-default, #2a2a2a)',
      }}>
        <button
          onClick={() => { setAccepted(true); onAccept(id); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 4, border: 'none',
            background: 'var(--accent, #B7FF00)', color: '#0a0a0a',
            cursor: 'pointer', fontSize: '0.6875rem', fontWeight: 500,
          }}
        >
          <Check size={12} /> 采纳
        </button>
        <button
          onClick={() => { setDismissed(true); onDismiss(id); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 4,
            border: '1px solid var(--border-default, #2a2a2a)',
            background: 'transparent', color: 'var(--text-secondary, #a0a0a0)',
            cursor: 'pointer', fontSize: '0.6875rem',
          }}
        >
          <X size={12} /> 忽略
        </button>
        {onModify && (
          <button
            onClick={() => onModify(id)}
            style={{
              padding: '4px 10px', borderRadius: 4,
              border: '1px solid var(--border-default, #2a2a2a)',
              background: 'transparent', color: 'var(--text-secondary, #a0a0a0)',
              cursor: 'pointer', fontSize: '0.6875rem',
              marginLeft: 'auto',
            }}
          >
            修改建议
          </button>
        )}
      </div>
    </div>
  );
}
