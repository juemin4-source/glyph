/**
 * LoadingState — 统一加载/错误/空三态
 * 替代各组件自己写 isLoading/error/empty 判断
 */
import { Skeleton, SkeletonCard } from './Skeleton';

interface LoadingStateProps {
  /** 'spinner' | 'skeleton' | 'skeleton-card' */
  variant?: string;
  message?: string;
}

export function LoadingState({ variant = 'spinner', message }: LoadingStateProps) {
  if (variant === 'skeleton') return <><Skeleton variant="text" /><Skeleton variant="text" width="80%" /><Skeleton variant="text" width="60%" /></>;
  if (variant === 'skeleton-card') return <SkeletonCard />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-10)', gap: 12 }}>
      <div style={{ width: 24, height: 24, border: '2px solid var(--border-default)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      {message && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{message}</span>}
    </div>
  );
}

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({ message, onRetry, onDismiss }: ErrorDisplayProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 'var(--space-6)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(229,62,62,0.3)' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: '#e53e3e', textAlign: 'center' }}>{message}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {onRetry && <button onClick={onRetry} style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'var(--bg-raised)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>重试</button>}
        {onDismiss && <button onClick={onDismiss} style={{ padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-xs)' }}>关闭</button>}
      </div>
    </div>
  );
}
