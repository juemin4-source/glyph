export type IndicatorStatus = "saved" | "saving" | "unsaved" | "offline" | "failed";

export interface SaveIndicatorProps {
  status: IndicatorStatus;
  onRetry?: () => void;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const STATUS_CONFIG: Record<IndicatorStatus, { label: string; color: string }> = {
  saved:   { label: "Saved",    color: "var(--safe, #4CAF50)" },
  saving:  { label: "Saving...", color: "var(--warning, #FF9800)" },
  unsaved: { label: "Unsaved",  color: "var(--warning, #FF9800)" },
  offline: { label: "Offline",  color: "var(--text-muted, #666)" },
  failed:  { label: "Failed",   color: "var(--danger, #f44336)" },
};

export default function SaveIndicator({
  status,
  onRetry,
  onClick,
  style,
  className,
}: SaveIndicatorProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.saved;
  const isClickable = status === "failed" || status === "unsaved";

  const handleClick = () => {
    if (status === "failed" && onRetry) onRetry();
    if (onClick) onClick();
  };

  return (
    <span
      className={className}
      onClick={handleClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "1px 6px",
        borderRadius: "var(--radius-sm, 4px)",
        cursor: isClickable ? "pointer" : "default",
        color: config.color,
        fontSize: "var(--text-xs, 0.75rem)",
        fontWeight: 500,
        transition: "background var(--transition-instant, 0.08s ease)",
        ...style,
      }}
      title={status === "offline" ? "Offline mode, data stored locally" : status === "failed" ? "Click to retry save" : ""}
      onMouseEnter={(e) => {
        if (isClickable) e.currentTarget.style.background = "var(--bg-raised, #1e1e1e)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: config.color,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}
