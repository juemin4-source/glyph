import { type ReactNode } from "react";

export type SaveStatus = "saved" | "saving" | "unsaved" | "offline" | "failed";

export interface StatusBarProps {
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export default function StatusBar({ leftSlot, rightSlot, style, className }: StatusBarProps) {
  const barStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    height: 28,
    padding: "0 14px",
    background: "var(--bg-header, #0e0e0e)",
    borderTop: "1px solid var(--border-default, #2a2a2a)",
    fontSize: "var(--text-xs, 0.75rem)",
    color: "var(--text-muted, #666)",
    userSelect: "none",
    flexShrink: 0,
    gap: 12,
    ...style,
  };

  return (
    <div className={className} style={barStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{leftSlot}</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{rightSlot}</div>
    </div>
  );
}
