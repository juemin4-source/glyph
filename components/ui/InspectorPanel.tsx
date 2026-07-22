import type { ReactNode } from "react";

export interface InspectorPanelProps {
  title?: string;
  children?: ReactNode;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function InspectorPanel({ title, children, onClose, className = "", style }: InspectorPanelProps) {
  return (
    <div className={`inspector-panel${className ? " " + className : ""}`} style={style}>
      {(title || onClose) && (
        <div className="inspector-panel-header">
          {title && <span className="inspector-panel-title">{title}</span>}
          {onClose && (
            <button className="inspector-panel-close" onClick={onClose} title="关闭">
              ✕
            </button>
          )}
        </div>
      )}
      <div className="inspector-panel-body">{children}</div>
    </div>
  );
}
