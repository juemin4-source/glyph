import { useState, type ReactNode } from "react";

export interface SidebarProps {
  header?: ReactNode;
  children?: ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  width?: number;
  minWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}

export default function Sidebar({
  header,
  children,
  collapsible = true,
  defaultCollapsed = false,
  width = 220,
  minWidth = 32,
  style,
  className,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const sidebarStyle: React.CSSProperties = {
    width: collapsed ? minWidth : width,
    minWidth: collapsed ? minWidth : width,
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface, #141416)",
    borderRight: "1px solid var(--border-default, #2a2a2a)",
    transition: "width var(--transition-normal, 0.25s ease)",
    overflow: "hidden",
    ...style,
  };

  const toggleBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 28,
    background: "none",
    border: "none",
    color: "var(--text-muted, #666)",
    cursor: "pointer",
    fontSize: "var(--text-xs, 0.75rem)",
    padding: 0,
    flexShrink: 0,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: collapsed ? "0" : "10px 14px",
    borderBottom: collapsed ? "none" : "1px solid var(--border-light, #1e1e1e)",
    fontSize: "var(--text-sm, 0.8125rem)",
    fontWeight: 600,
    color: "var(--text-secondary, #a0a0a0)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    flexShrink: 0,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    opacity: collapsed ? 0 : 1,
    transition: "opacity var(--transition-fast, 0.15s ease)",
    padding: collapsed ? 0 : "8px 0",
  };

  return (
    <div className={className} style={sidebarStyle}>
      {collapsible && (
        <button
          style={toggleBtnStyle}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-secondary, #a0a0a0)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted, #666)"; }}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      )}
      {!collapsed && (
        <>
          {header && <div style={headerStyle}>{header}</div>}
          <div style={contentStyle}>{children}</div>
        </>
      )}
    </div>
  );
}
