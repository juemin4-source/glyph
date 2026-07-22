import { useState, type ReactNode } from "react";

export interface CardProps {
  gradient: [string, string];
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export default function Card({
  gradient,
  title,
  subtitle,
  children,
  onClick,
  style,
  className,
}: CardProps) {
  const [hovered, setHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    position: "relative",
    borderRadius: "var(--radius-lg, 8px)",
    overflow: "hidden",
    cursor: onClick ? "pointer" : "default",
    background: "var(--bg-surface, #141416)",
    border: `1px solid ${hovered ? "var(--border-hover, #444)" : "var(--border-default, #2a2a2a)"}`,
    transition: "all var(--transition-normal, 0.25s ease)",
    transform: hovered ? "translateY(-2px)" : "translateY(0)",
    boxShadow: hovered
      ? "var(--shadow-md, 0 2px 8px rgba(0,0,0,0.3))"
      : "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.4))",
    ...style,
  };

  const coverStyle: React.CSSProperties = {
    height: 80,
    background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
    display: "flex",
    alignItems: "flex-end",
    padding: "12px 16px",
  };

  const titleStyle: React.CSSProperties = {
    color: "#fff",
    fontSize: "var(--text-base, 0.9375rem)",
    fontWeight: 600,
    textShadow: "0 1px 3px rgba(0,0,0,0.3)",
  };

  const bodyStyle: React.CSSProperties = {
    padding: "12px 16px",
    color: "var(--text-secondary, #a0a0a0)",
    fontSize: "var(--text-sm, 0.8125rem)",
  };

  return (
    <div
      className={className}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={coverStyle}>
        <span style={titleStyle}>{title}</span>
      </div>
      <div style={bodyStyle}>
        {subtitle && (
          <div style={{ marginBottom: 8, color: "var(--text-muted, #666)", fontSize: "var(--text-xs, 0.75rem)" }}>
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
