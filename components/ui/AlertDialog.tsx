/**
 * AlertDialog — 确认对话框
 * 源自 shadcn/ui AlertDialog + sonner toast
 */
import { useEffect, useRef, type ReactNode } from 'react';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

export function AlertDialog({
  open, onOpenChange, title, description, children,
  confirmLabel = '确认', cancelLabel = '取消',
  variant = 'default', onConfirm, onCancel, loading,
}: AlertDialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
      }}
      onClick={() => onOpenChange(false)}
    >
      <div ref={ref} onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)', maxWidth: 420, width: '90%',
          padding: 'var(--space-6)',
        }}
      >
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</h2>
        {description && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 16 }}>{description}</p>}
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={() => { onCancel?.(); onOpenChange(false); }}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--text-sm)',
            }}
          >{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-md)', border: 'none',
              background: variant === 'destructive' ? '#e53e3e' : 'var(--accent)',
              color: variant === 'destructive' ? '#fff' : 'var(--text-inverse)',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
              fontSize: 'var(--text-sm)', fontWeight: 500,
            }}
          >{loading ? '处理中...' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
