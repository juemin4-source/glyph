import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function EmptyState({ title, description, action, icon, className = "", style }: EmptyStateProps) {
  return (
    <div className={`empty-state${className ? " " + className : ""}`} style={style}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-title">{title}</div>
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div>{action}</div>}
    </div>
  );
}
