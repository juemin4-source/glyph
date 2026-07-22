/**
 * Sonner — 轻量通知系统
 * 源自 shadcn/ui sonner
 */
import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id}
            style={{
              padding: '10px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-raised)', border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-md)', color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)', maxWidth: 360,
              borderLeft: `4px solid ${t.variant === 'success' ? '#38a169' : t.variant === 'error' ? '#e53e3e' : t.variant === 'warning' ? '#d69e2e' : 'var(--accent)'}`,
              animation: 'slideIn 0.2s ease',
            }}
          >{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
