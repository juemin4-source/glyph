import type { ReactNode } from "react";

type BadgeVariant = "default" | "genre" | "status" | "canon";

export interface BadgeProps {
  variant?: BadgeVariant;
  color?: string;
  children?: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

const baseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px",
  borderRadius: "var(--radius-full, 9999px)",
  fontSize: "var(--text-xs, 0.75rem)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  lineHeight: "1.4",
};

const variantDefaults: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: "var(--bg-raised, #1e1e1e)",
    color: "var(--text-secondary, #a0a0a0)",
    border: "1px solid var(--border-default, #2a2a2a)",
  },
  genre: {
    background: "rgba(144, 202, 249, 0.15)",
    color: "var(--canon-project, #90CAF9)",
    border: "1px solid rgba(144, 202, 249, 0.3)",
  },
  status: {
    background: "rgba(183, 255, 0, 0.1)",
    color: "var(--accent, #B7FF00)",
    border: "1px solid rgba(183, 255, 0, 0.25)",
  },
  canon: {
    background: "rgba(255, 183, 77, 0.15)",
    color: "var(--canon-core, #FFB74D)",
    border: "1px solid rgba(255, 183, 77, 0.3)",
  },
};

export default function Badge({
  variant = "default",
  color,
  children,
  style,
  className,
}: BadgeProps) {
  const mergedStyle: React.CSSProperties = {
    ...baseStyle,
    ...variantDefaults[variant],
    ...(color ? { color, borderColor: color } : {}),
    ...style,
  };

  return (
    <span className={className} style={mergedStyle}>
      {children}
    </span>
  );
}
