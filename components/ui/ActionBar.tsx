import type { ReactNode } from "react";

export interface ActionBarProps {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  style?: React.CSSProperties;
}

export default function ActionBar({ children, align = "left", className = "", style }: ActionBarProps) {
  const alignClass = align === "center" ? "action-bar-center" : align === "right" ? "action-bar-right" : "action-bar-left";
  return (
    <div className={`action-bar ${alignClass}${className ? " " + className : ""}`} style={style}>
      {children}
    </div>
  );
}
