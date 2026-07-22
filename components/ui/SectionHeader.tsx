import type { ReactNode } from "react";

export interface SectionHeaderProps {
  title: string;
  count?: number;
  actions?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function SectionHeader({ title, count, actions, className = "", style }: SectionHeaderProps) {
  return (
    <div className={`section-header${className ? " " + className : ""}`} style={style}>
      <span className="section-header-title">
        {title}
        {count !== undefined && <span className="section-header-count"> ({count})</span>}
      </span>
      {actions && <div className="section-header-actions">{actions}</div>}
    </div>
  );
}
