import { type ReactNode } from "react";

export interface InspectorSection {
  label: string;
  content: ReactNode;
}

export interface InspectorProps {
  title?: string;
  sections: InspectorSection[];
  emptyMessage?: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function Inspector({
  title,
  sections,
  emptyMessage = "No selection",
  style,
  className,
}: InspectorProps) {
  const panelStyle: React.CSSProperties = {
    width: 260,
    minWidth: 260,
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface, #141416)",
    borderLeft: "1px solid var(--border-default, #2a2a2a)",
    overflow: "hidden",
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    padding: "12px 14px",
    borderBottom: "1px solid var(--border-default, #2a2a2a)",
    fontSize: "var(--text-sm, 0.8125rem)",
    fontWeight: 600,
    color: "var(--text-heading, #f0f0f0)",
    flexShrink: 0,
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: 0,
  };

  const sectionStyle: React.CSSProperties = {
    padding: "10px 14px",
    borderBottom: "1px solid var(--border-light, #1e1e1e)",
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: "var(--text-xs, 0.75rem)",
    fontWeight: 600,
    color: "var(--text-muted, #666)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 6,
  };

  const sectionContentStyle: React.CSSProperties = {
    fontSize: "var(--text-sm, 0.8125rem)",
    color: "var(--text-primary, #e0e0e0)",
    lineHeight: 1.5,
  };

  const emptyStyle: React.CSSProperties = {
    padding: "20px 14px",
    color: "var(--text-muted, #666)",
    fontSize: "var(--text-sm, 0.8125rem)",
    textAlign: "center" as const,
  };

  if (sections.length === 0) {
    return (
      <div className={className} style={panelStyle}>
        {title && <div style={headerStyle}>{title}</div>}
        <div style={emptyStyle}>{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className={className} style={panelStyle}>
      {title && <div style={headerStyle}>{title}</div>}
      <div style={bodyStyle}>
        {sections.map((section, idx) => (
          <div key={idx} style={sectionStyle}>
            <div style={sectionLabelStyle}>{section.label}</div>
            <div style={sectionContentStyle}>{section.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
