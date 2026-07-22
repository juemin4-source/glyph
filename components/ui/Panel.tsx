import type { ReactNode } from "react";

export interface PanelProps {
  title?: string;
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  actions?: React.ReactNode;
}

export default function Panel({ title, children, className = "", style, actions }: PanelProps) {
  return (
    <div className={`panel${className ? " " + className : ""}`} style={style}>
      {title !== undefined && (
        <div className="panel-header">
          <span className="panel-title">{title}</span>
          {actions && <div className="panel-header-actions">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className="panel-body">{children}</div>}
    </div>
  );
}
