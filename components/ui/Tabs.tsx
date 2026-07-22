export interface Tab {
  id: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function Tabs({ tabs, activeTab, onChange, style, className }: TabsProps) {
  const containerStyle: React.CSSProperties = {
    display: "flex",
    borderBottom: "1px solid var(--border-default, #2a2a2a)",
    background: "var(--bg-header, #0e0e0e)",
    ...style,
  };

  const tabStyle = (tab: Tab): React.CSSProperties => {
    const isActive = activeTab === tab.id;
    return {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 16px",
      background: "none",
      border: "none",
      color: isActive ? "var(--accent, #B7FF00)" : "var(--text-secondary, #a0a0a0)",
      cursor: tab.disabled ? "not-allowed" : "pointer",
      fontSize: "var(--text-sm, 0.8125rem)",
      fontWeight: isActive ? 600 : 400,
      opacity: tab.disabled ? 0.4 : 1,
      transition: "color var(--transition-fast, 0.15s ease)",
      whiteSpace: "nowrap",
    };
  };

  const indicatorStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: "60%",
    height: 2,
    background: "var(--accent, #B7FF00)",
    borderRadius: "1px 1px 0 0",
  };

  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 16,
    height: 16,
    padding: "0 4px",
    borderRadius: "var(--radius-full, 9999px)",
    background: "var(--bg-raised, #1e1e1e)",
    color: "var(--text-muted, #666)",
    fontSize: "10px",
    fontWeight: 600,
    lineHeight: 1,
  };

  return (
    <div className={className} style={containerStyle} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          style={tabStyle(tab)}
          onClick={() => {
            if (!tab.disabled) onChange(tab.id);
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id && !tab.disabled)
              e.currentTarget.style.color = "var(--text-primary, #e0e0e0)";
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id)
              e.currentTarget.style.color = "var(--text-secondary, #a0a0a0)";
          }}
        >
          {tab.label}
          {tab.badge !== undefined && <span style={badgeStyle}>{tab.badge}</span>}
          {activeTab === tab.id && <div style={indicatorStyle} />}
        </button>
      ))}
    </div>
  );
}
