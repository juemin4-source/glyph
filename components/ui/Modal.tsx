import { useEffect, useCallback, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  header?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export default function Modal({ open, onClose, header, children, footer, width = 480 }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
  };

  const cardStyle: React.CSSProperties = {
    width,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100vh - 64px)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface, #141416)",
    border: "1px solid var(--border-default, #2a2a2a)",
    borderRadius: "var(--radius-lg, 8px)",
    boxShadow: "var(--shadow-lg, 0 4px 16px rgba(0,0,0,0.35))",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--border-default, #2a2a2a)",
    fontSize: "var(--text-base, 0.9375rem)",
    fontWeight: 600,
    color: "var(--text-heading, #f0f0f0)",
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    color: "var(--text-primary, #e0e0e0)",
    fontSize: "var(--text-sm, 0.8125rem)",
    lineHeight: 1.6,
  };

  const footerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    padding: "12px 20px",
    borderTop: "1px solid var(--border-default, #2a2a2a)",
  };

  const closeBtnStyle: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "var(--text-muted, #666)",
    cursor: "pointer",
    padding: 4,
    borderRadius: "var(--radius-sm, 4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    lineHeight: 1,
  };

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={cardStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {header ? (
          <div style={headerStyle}>
            <span>{header}</span>
            <button style={closeBtnStyle} onClick={onClose} title="Close">
              &#x2715;
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 12px 0" }}>
            <button style={closeBtnStyle} onClick={onClose} title="Close">
              &#x2715;
            </button>
          </div>
        )}
        <div style={bodyStyle}>{children}</div>
        {footer && <div style={footerStyle}>{footer}</div>}
      </div>
    </div>
  );
}
