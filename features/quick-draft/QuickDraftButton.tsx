/**
 * QuickDraftButton — 一键速写入口按钮
 *
 * Renders the "一键速写" button that appears in the Bookshelf header
 * area, next to the "新建作品" button.
 *
 * Props:
 * - onClick: handler to open the QuickDraftPanel
 */

interface QuickDraftButtonProps {
  onClick: () => void;
}

export default function QuickDraftButton({ onClick }: QuickDraftButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="一键速写"
      title="写下故事想法，一键生成正文草稿"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.45rem 0.85rem',
        borderRadius: 6,
        background: '#B7FF00',
        color: '#0a0a0a',
        fontSize: '0.8125rem',
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
        transition: 'opacity 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '0.85';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.opacity = '1';
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>&#x26A1;</span>
      一键速写
    </button>
  );
}
