import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--accent, #B7FF00)",
    color: "var(--text-inverse, #0a0a0a)",
    border: "1px solid var(--accent, #B7FF00)",
  },
  secondary: {
    background: "var(--bg-raised, #1e1e1e)",
    color: "var(--text-primary, #e0e0e0)",
    border: "1px solid var(--border-default, #2a2a2a)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary, #a0a0a0)",
    border: "1px solid transparent",
  },
  danger: {
    background: "transparent",
    color: "var(--danger, #f44336)",
    border: "1px solid var(--danger, #f44336)",
  },
  link: {
    background: "transparent",
    color: "var(--accent, #B7FF00)",
    border: "none",
    padding: 0,
    textDecoration: "underline",
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 28, fontSize: "var(--text-xs, 0.75rem)", padding: "0 10px", gap: 4 },
  md: { height: 34, fontSize: "var(--text-sm, 0.8125rem)", padding: "0 14px", gap: 6 },
  lg: { height: 40, fontSize: "var(--text-base, 0.9375rem)", padding: "0 20px", gap: 8 },
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, icon, children, style, disabled, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--radius-md, 6px)",
      fontWeight: 500,
      cursor: disabled || loading ? "not-allowed" : "pointer",
      opacity: disabled || loading ? 0.5 : 1,
      transition: "all var(--transition-fast, 0.15s ease)",
      fontFamily: "var(--font-body, sans-serif)",
      whiteSpace: "nowrap",
      userSelect: "none",
      textDecoration: variant === "link" ? "underline" : "none",
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...style,
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;
      const target = e.currentTarget;
      switch (variant) {
        case "primary":
          target.style.setProperty("background", "var(--accent-hover, #c8ff33)");
          target.style.setProperty("border-color", "var(--accent-hover, #c8ff33)");
          break;
        case "secondary":
          target.style.setProperty("background", "var(--bg-hover, #1a1a1a)");
          target.style.setProperty("border-color", "var(--border-hover, #444)");
          break;
        case "ghost":
          target.style.setProperty("color", "var(--text-primary, #e0e0e0)");
          break;
        case "danger":
          target.style.setProperty("background", "rgba(244, 67, 54, 0.1)");
          break;
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;
      const target = e.currentTarget;
      const v = variantStyles[variant];
      if (v.background) target.style.setProperty("background", v.background as string);
      if (v.border) target.style.setProperty("border-color", v.border as string);
      if (v.color) target.style.setProperty("color", v.color as string);
    };

    return (
      <button
        ref={ref}
        style={baseStyle}
        disabled={disabled || loading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {loading && (
          <span style={{ display: "inline-block", animation: "spin 0.8s linear infinite", fontSize: "1em" }}>
            &#x27F3;
          </span>
        )}
        {!loading && icon && <span style={{ display: "inline-flex", alignItems: "center" }}>{icon}</span>}
        {children && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
