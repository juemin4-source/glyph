/**
 * DraftPreview — 速写草稿预览组件
 *
 * Shows the generated draft in the PREVIEW state of QuickDraftPanel.
 * Displays title, premise text, chapter list with excerpt, word count,
 * and action buttons.
 */

import type { QuickDraft, QuickDraftGenerateResult } from '../../contracts/quick-draft.contract';

interface DraftPreviewProps {
  result: QuickDraftGenerateResult;
  onRegenerate: () => void;
  onTransfer: () => void;
  transferring: boolean;
}

export default function DraftPreview({
  result,
  onRegenerate,
  onTransfer,
  transferring,
}: DraftPreviewProps) {
  const { draft, previewTitle, previewContent } = result;

  // Parse chapters from JSON string
  let chapters: Array<{ title: string; content: string }> = [];
  try {
    chapters = JSON.parse(draft.chapters);
  } catch {
    // If parsing fails, treat the whole content as one chapter
    chapters = [{ title: previewTitle, content: previewContent }];
  }

  const totalChars = previewContent.length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '0.25rem 0',
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: '1.15rem',
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.4,
        }}
      >
        {previewTitle}
      </div>

      {/* Word count */}
      <div style={{ fontSize: '0.75rem', color: '#888' }}>
        {totalChars} 字 · 共 {chapters.length} 章
      </div>

      {/* Premise section */}
      <div
        style={{
          background: '#141416',
          border: '1px solid #2a2a2a',
          borderRadius: 8,
          padding: '0.75rem 1rem',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#B7FF00',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.4rem',
          }}
        >
          故事前提
        </div>
        <div
          style={{
            fontSize: '0.8125rem',
            color: '#ccc',
            lineHeight: 1.7,
          }}
        >
          {draft.premiseText}
        </div>
      </div>

      {/* Chapter previews */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          章节预览
        </div>
        {chapters.map((ch, idx) => (
          <div
            key={idx}
            style={{
              background: '#141416',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              padding: '0.65rem 0.85rem',
            }}
          >
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#e0e0e0',
                marginBottom: '0.25rem',
              }}
            >
              第{idx + 1}章: {ch.title}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: '#999',
                lineHeight: 1.6,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {ch.content}
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          justifyContent: 'flex-end',
          marginTop: '0.5rem',
        }}
      >
        <button
          onClick={onRegenerate}
          disabled={transferring}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.5rem 1rem',
            borderRadius: 6,
            background: 'transparent',
            color: '#a0a0a0',
            border: '1px solid #2a2a2a',
            fontSize: '0.8125rem',
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#555'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a'; }}
        >
          &larr; 重新生成
        </button>
        <button
          onClick={onTransfer}
          disabled={transferring}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.5rem 1.15rem',
            borderRadius: 6,
            background: transferring ? '#666' : '#B7FF00',
            color: '#0a0a0a',
            border: 'none',
            fontSize: '0.8125rem',
            fontWeight: 500,
            fontFamily: 'inherit',
            cursor: transferring ? 'not-allowed' : 'pointer',
            opacity: transferring ? 0.6 : 1,
          }}
        >
          {transferring ? '正在转入...' : '转入正式创作 →'}
        </button>
      </div>
    </div>
  );
}
