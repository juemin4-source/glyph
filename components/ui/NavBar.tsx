import { type ReactNode } from "react";

export interface NavTab {
  id: string;
  label: string;
}

export interface NavBarProps {
  logo?: ReactNode;
  title?: string;
  tabs: NavTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  rightActions?: ReactNode;
  onBack?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function NavBar({
  logo,
  title,
  tabs,
  activeTab,
  onTabChange,
  rightActions,
  onBack,
  style,
  className,
}: NavBarProps) {
  const navStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    height: "var(--header-height, 44px)",
    padding: "0 14px",
    background: "var(--bg-header, #0e0e0e)",
    borderBottom: "1px solid var(--border-default, #2a2a2a)",
    gap: 12,
    userSelect: "none",
    flexShrink: 0,
    ...style,
  };

  const backBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    color: "var(--text-secondary, #a0a0a0)",
    cursor: "pointer",
    fontSize: "var(--text-sm, 0.8125rem)",
    padding: "4px 8px",
    borderRadius: "var(--radius-sm, 4px)",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: "var(--text-base, 0.9375rem)",
    fontWeight: 600,
    color: "var(--text-heading, #f0f0f0)",
    marginRight: 8,
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    background: "none",
    border: "none",
    color: isActive ? "var(--accent, #B7FF00)" : "var(--text-secondary, #a0a0a0)",
    cursor: "pointer",
    fontSize: "var(--text-sm, 0.8125rem)",
    padding: "6px 12px",
    borderRadius: "var(--radius-sm, 4px)",
    position: "relative",
    fontWeight: isActive ? 600 : 400,
    transition: "color var(--transition-fast, 0.15s ease)",
  });

  const activeIndicatorStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "60%",
    height: 2,
    background: "var(--accent, #B7FF00)",
    borderRadius: "1px 1px 0 0",
  };

  return (
    <nav className={className} style={navStyle}>
      {onBack && (
        <button style={backBtnStyle} onClick={onBack} title="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      )}
      {logo && <span style={{ display: "flex", alignItems: "center" }}>{logo}</span>}
      {title && <span style={titleStyle}>{title}</span>}
      {tabs.map((tab) => (
        <button
          key={tab.id}
          style={tabStyle(activeTab === tab.id)}
          onClick={() => onTabChange(tab.id)}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) e.currentTarget.style.color = "var(--text-primary, #e0e0e0)";
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) e.currentTarget.style.color = "var(--text-secondary, #a0a0a0)";
          }}
        >
          {tab.label}
          {activeTab === tab.id && <div style={activeIndicatorStyle} />}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {rightActions}
    </nav>
  );
}
