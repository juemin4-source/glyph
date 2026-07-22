import { useEffect, useState, useCallback } from "react";
import { Check, X, Info } from 'lucide-react';

type ToastType = "success" | "error" | "info";

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
}

export interface ToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  duration?: number;
}

const typeColors: Record<ToastType, string> = {
  success: "var(--safe, #4CAF50)",
  error: "var(--danger, #f44336)",
  info: "var(--accent, #B7FF00)",
};

const typeIcons = {
  success: <Check size={14} />,
  error: <X size={14} />,
  info: <Info size={14} />,
};

export default function Toast({ toasts, onDismiss, duration = 3000 }: ToastProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2000,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          duration={duration}
        />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
  duration,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
  duration: number;
}) {
  const [exiting, setExiting] = useState(false);
  const color = typeColors[toast.type];

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, dismiss]);

  return (
    <div
      onClick={dismiss}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 18px",
        background: "var(--bg-raised, #1e1e1e)",
        border: `1px solid ${color}`,
        borderRadius: "var(--radius-md, 6px)",
        boxShadow: "var(--shadow-md, 0 2px 8px rgba(0,0,0,0.3))",
        color: "var(--text-primary, #e0e0e0)",
        fontSize: "var(--text-sm, 0.8125rem)",
        cursor: "pointer",
        pointerEvents: "auto",
        opacity: exiting ? 0 : 1,
        transform: exiting ? "translateY(8px)" : "translateY(0)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
        minWidth: 200,
        maxWidth: 400,
      }}
    >
      <span style={{ color, fontWeight: 700, fontSize: "var(--text-base, 0.9375rem)" }}>
        {typeIcons[toast.type]}
      </span>
      <span>{toast.message}</span>
    </div>
  );
}
