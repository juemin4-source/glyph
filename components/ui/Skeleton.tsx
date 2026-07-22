/**
 * Skeleton — 骨架屏加载占位
 * 源自 shadcn/ui skeleton pattern
 */
interface SkeletonProps {
  className?: string;
  /** 'text' | 'circle' | 'card' */
  variant?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = '', variant = 'text', width, height }: SkeletonProps) {
  const baseStyle: React.CSSProperties = {
    background: 'var(--bg-raised)',
    borderRadius: 'var(--radius-sm)',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  };
  const variants: Record<string, React.CSSProperties> = {
    text: { height: '1em', width: width || '100%' },
    circle: { width: width || 40, height: height || 40, borderRadius: '50%' },
    card: { height: height || 120, width: width || '100%', borderRadius: 'var(--radius-md)' },
  };
  return <div className={className} style={{ ...baseStyle, ...variants[variant] || variants.text }} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
      <Skeleton variant="circle" width={40} height={40} />
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="40%" />
    </div>
  );
}
