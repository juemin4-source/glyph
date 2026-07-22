/**
 * ChatDrawer — 浮动聊天面板 (织梦机 v2 / D2-UX)
 *
 * 从右侧滑出的对话历史面板。
 * - CanvasAiBar 发送按钮 → 打开此面板并显示对话
 * - 默认隐藏，点击画板右上角的"聊"按钮打开
 * - 从右侧滑入，不覆盖画板内容
 * - AIChat 保留为 legacy（此为轻量版）
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { User, Bot, X, MessageSquare, CheckCircle, Info } from 'lucide-react';
import type { AiOutputType } from '../../lib/ai-output';
import type { ParseResult } from '../../lib/ai/structured-parser';

// ─── Types ───

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  outputType?: AiOutputType;
  /** Structured parser output (ParseResult has status + data + repairLog) */
  structuredData?: ParseResult;
}

export interface ChatDrawerProps {
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 对话消息列表 */
  messages: ChatMessage[];
  /** 是否正在加载 */
  loading?: boolean;
  /** 清除对话 */
  onClear?: () => void;
}

// ─── Helpers ───

let msgIdCounter = 0;
export function uid(): string {
  return 'cd_msg_' + (++msgIdCounter);
}

// ─── Markdown renderer (lightweight, inline only) ───

function renderMd(text: string): React.ReactNode {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Code block
    const cbMatch = remaining.match(/```(\w*)\n?([\s\S]*?)```/);
    if (cbMatch && cbMatch.index !== undefined) {
      if (cbMatch.index > 0) {
        parts.push(<span key={`t${key++}`}>{remaining.slice(0, cbMatch.index)}</span>);
      }
      parts.push(
        <pre key={`cb${key++}`} style={{
          background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6,
          padding: '8px 12px', overflow: 'auto', fontSize: '0.75rem', lineHeight: 1.5,
          margin: '6px 0',
        }}>
          <code style={{ fontFamily: 'var(--font-mono, monospace)', whiteSpace: 'pre', color: '#e0e0e0' }}>{cbMatch[2]}</code>
        </pre>
      );
      remaining = remaining.slice(cbMatch.index + cbMatch[0].length);
      continue;
    }
    // Inline code
    const icMatch = remaining.match(/`([^`]+)`/);
    if (icMatch && icMatch.index !== undefined) {
      if (icMatch.index > 0) parts.push(<span key={`t${key++}`}>{remaining.slice(0, icMatch.index)}</span>);
      parts.push(
        <code key={`ic${key++}`} style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3, fontFamily: 'var(--font-mono, monospace)', fontSize: '0.75rem', color: '#CE93D8' }}>
          {icMatch[1]}
        </code>
      );
      remaining = remaining.slice(icMatch.index + icMatch[0].length);
      continue;
    }
    // Bold
    const bMatch = remaining.match(/\*\*([^*]+)\*\*/);
    if (bMatch && bMatch.index !== undefined) {
      if (bMatch.index > 0) parts.push(<span key={`t${key++}`}>{remaining.slice(0, bMatch.index)}</span>);
      parts.push(<strong key={`b${key++}`} style={{ fontWeight: 700 }}>{bMatch[1]}</strong>);
      remaining = remaining.slice(bMatch.index + bMatch[0].length);
      continue;
    }
    // Italic
    const iMatch = remaining.match(/\*([^*]+)\*/);
    if (iMatch && iMatch.index !== undefined) {
      if (iMatch.index > 0) parts.push(<span key={`t${key++}`}>{remaining.slice(0, iMatch.index)}</span>);
      parts.push(<em key={`i${key++}`} style={{ fontStyle: 'italic', color: '#a0a0a0' }}>{iMatch[1]}</em>);
      remaining = remaining.slice(iMatch.index + iMatch[0].length);
      continue;
    }
    // Newline
    const nlMatch = remaining.match(/^([^\n]*)\n/);
    if (nlMatch && nlMatch.index !== undefined) {
      if (nlMatch[1]) parts.push(<span key={`t${key++}`}>{nlMatch[1]}</span>);
      parts.push(<br key={`br${key++}`} />);
      remaining = remaining.slice(nlMatch.index + nlMatch[0].length);
      continue;
    }
    // Remaining text
    parts.push(<span key={`t${key++}`}>{remaining}</span>);
    remaining = '';
  }

  return <>{parts}</>;
}

// ─── Component ───

export default function ChatDrawer({ open, onClose, messages, loading, onClear }: ChatDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages, scrollToBottom]);

  const handleClear = () => {
    setShowClearConfirm(false);
    onClear?.();
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 45,
          background: 'rgba(0,0,0,0.3)',
          cursor: 'pointer',
        }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 46,
          width: 360, maxWidth: '90vw',
          background: 'var(--bg-surface, #141414)',
          borderLeft: '1px solid var(--border-default, #2a2a2a)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
          animation: 'chat-drawer-slide-in 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-default, #2a2a2a)',
          flexShrink: 0,
        }}>
          <MessageSquare size={16} style={{ color: 'var(--accent, #B7FF00)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)', flex: 1 }}>
            AI 助手
          </span>
          <button
            onClick={() => setShowClearConfirm(true)}
            style={{
              fontSize: '0.6875rem', padding: '3px 8px', borderRadius: 4,
              border: '1px solid var(--border-default, #2a2a2a)',
              background: 'transparent', color: 'var(--text-muted, #666)',
              cursor: messages.length > 0 ? 'pointer' : 'default',
              opacity: messages.length > 0 ? 1 : 0.4,
            }}
          >
            清空
          </button>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', color: 'var(--text-secondary, #a0a0a0)',
              cursor: 'pointer', borderRadius: 6, fontSize: '0.875rem',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1, overflowY: 'auto', padding: '16px',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
          {messages.length === 0 && !loading && (
            <div style={{
              textAlign: 'center', padding: '40px 16px',
              color: 'var(--text-muted, #666)', fontSize: '0.75rem',
            }}>
              <MessageSquare size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>暂无对话。点击发送按钮开始与 AI 交流。</div>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex', gap: 8,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem',
                background: msg.role === 'user' ? 'rgba(66,165,245,0.12)' : 'rgba(183,255,0,0.1)',
                border: msg.role === 'user' ? '1px solid rgba(66,165,245,0.18)' : '1px solid rgba(183,255,0,0.15)',
              }}>
                {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
              </div>
              <div style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: 10,
                fontSize: '0.8125rem',
                lineHeight: 1.6,
                background: msg.role === 'user' ? 'rgba(66,165,245,0.08)' : 'var(--bg-raised, #1e1e1e)',
                border: msg.role === 'user' ? '1px solid rgba(66,165,245,0.12)' : '1px solid var(--border-default, #2a2a2a)',
                color: 'var(--text-primary, #e0e0e0)',
                borderTopRightRadius: msg.role === 'user' ? 4 : 10,
                borderTopLeftRadius: msg.role === 'assistant' ? 4 : 10,
              }}>
                {/* Structured data indicator */}
                {msg.structuredData && msg.structuredData.status !== 'fallback' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    marginBottom: 6, padding: '3px 8px',
                    background: msg.structuredData.status === 'valid'
                      ? 'rgba(76,175,80,0.08)'
                      : msg.structuredData.status === 'repaired'
                        ? 'rgba(255,193,7,0.08)'
                        : 'transparent',
                    borderRadius: 4, fontSize: '0.65rem',
                    color: msg.structuredData.status === 'valid'
                      ? 'var(--success, #4CAF50)'
                      : '#FFC107',
                  }}>
                    {msg.structuredData.status === 'valid'
                      ? <CheckCircle size={12} />
                      : <Info size={12} />
                    }
                    <span>AI结构化输出 · {msg.structuredData.status === 'valid' ? '验证通过' : '已自动修复'}</span>
                  </div>
                )}
                <div style={{ margin: 0 }}>{renderMd(msg.content)}</div>

                {/* Structured data fields */}
                {msg.structuredData && msg.structuredData.status !== 'fallback' && msg.structuredData.data && Object.keys(msg.structuredData.data).length > 0 && (
                  <div style={{
                    marginTop: 8, paddingTop: 6,
                    borderTop: '1px solid var(--border-light, #2a2a2a)',
                  }}>
                    {Object.entries(msg.structuredData.data).map(([key, value]) => (
                      <div key={key} style={{
                        display: 'flex', gap: 8,
                        padding: '2px 0', fontSize: '0.75rem',
                      }}>
                        <span style={{ color: 'var(--accent, #B7FF00)', fontWeight: 500, flexShrink: 0, minWidth: 80 }}>
                          {key}:
                        </span>
                        <span style={{ color: 'var(--text-secondary, #a0a0a0)', wordBreak: 'break-word' }}>
                          {typeof value === 'string' ? value : JSON.stringify(value, null, 1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Repair log */}
                {msg.structuredData && msg.structuredData.repairLog && msg.structuredData.repairLog.length > 0 && (
                  <div style={{
                    marginTop: 6, fontSize: '0.6rem', color: 'var(--text-muted, #666)',
                    fontStyle: 'italic',
                  }}>
                    {msg.structuredData.repairLog.join('; ')}
                  </div>
                )}

                <div style={{
                  fontSize: '0.6rem', color: 'var(--text-muted, #666)',
                  marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left',
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0' }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(183,255,0,0.1)', border: '1px solid rgba(183,255,0,0.15)',
              }}>
                <Bot size={12} />
              </div>
              <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#B7FF00',
                  animation: 'chat-drawer-dot 1.2s infinite', opacity: 0.3,
                }} />
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#B7FF00',
                  animation: 'chat-drawer-dot 1.2s infinite 0.2s', opacity: 0.3,
                }} />
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#B7FF00',
                  animation: 'chat-drawer-dot 1.2s infinite 0.4s', opacity: 0.3,
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clear confirm modal */}
      {showClearConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
        }} onClick={() => setShowClearConfirm(false)}>
          <div style={{
            width: 280, background: 'var(--bg-surface, #141414)',
            border: '1px solid var(--border-default, #2a2a2a)',
            borderRadius: 12, padding: 20,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary, #e0e0e0)', marginBottom: 8 }}>清空对话</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #a0a0a0)', marginBottom: 16 }}>清除所有对话消息？此操作不可撤销。</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowClearConfirm(false)} style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-default, #2a2a2a)',
                background: 'var(--bg-raised, #1e1e1e)', color: 'var(--text-secondary, #a0a0a0)',
                cursor: 'pointer', fontSize: '0.75rem',
              }}>取消</button>
              <button onClick={handleClear} style={{
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: 'var(--danger, #f44336)', color: '#fff',
                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500,
              }}>清空</button>
            </div>
          </div>
        </div>
      )}

      {/* Inject keyframes */}
      <style>{`
        @keyframes chat-drawer-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes chat-drawer-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </>
  );
}
