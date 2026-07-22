import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { ToastConfig } from '../types/toast';
import { DEFAULT_TOAST_CONFIG } from '../types/toast';
import { Check, X, RefreshCw, Info } from 'lucide-react';

// ===== Types =====
type ToastType = 'info' | 'success' | 'error' | 'loading';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

// ===== Context =====
const ToastContext = createContext<ToastContextValue | null>(null);

let _toastId = 0;

// ===== Provider =====
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const dismissAll = useCallback(() => {
    for (const timer of timersRef.current.values()) clearTimeout(timer);
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration?: number): string => {
    const id = `toast_${++_toastId}`;
    const item: ToastItem = { id, message, type, createdAt: Date.now() };
    setToasts(prev => [...prev.slice(-4), item]); // max 5 visible

    // Auto-dismiss for non-loading toasts
    if (type !== 'loading') {
      const ms = duration ?? DEFAULT_TOAST_CONFIG.duration ?? 2000;
      const timer = setTimeout(() => dismissToast(id), ms);
      timersRef.current.set(id, timer);
    }
    return id;
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, dismissAll }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item toast-${t.type}`} onClick={() => dismissToast(t.id)}>
            <span className="toast-icon">
              {t.type === 'success' ? <Check size={14} /> : t.type === 'error' ? <X size={14} /> : t.type === 'loading' ? <RefreshCw size={14} /> : <Info size={14} />}
            </span>
            <span className="toast-message">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ===== Hook =====
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
