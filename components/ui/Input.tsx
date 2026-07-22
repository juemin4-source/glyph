import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, style, ...props }, ref) => {
    const containerStyle: React.CSSProperties = {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    };

    const labelStyle: React.CSSProperties = {
      fontSize: "var(--text-sm, 0.8125rem)",
      color: "var(--text-secondary, #a0a0a0)",
      fontWeight: 500,
    };

    const inputStyle: React.CSSProperties = {
      height: 36,
      padding: "0 12px",
      background: "var(--bg-input, #0a0a0a)",
      border: `1px solid ${error ? "var(--danger, #f44336)" : "var(--border-default, #2a2a2a)"}`,
      borderRadius: "var(--radius-md, 6px)",
      color: "var(--text-primary, #e0e0e0)",
      fontSize: "var(--text-sm, 0.8125rem)",
      fontFamily: "var(--font-body, sans-serif)",
      outline: "none",
      transition: "border-color var(--transition-fast, 0.15s ease), box-shadow var(--transition-fast, 0.15s ease)",
      width: "100%",
      boxSizing: "border-box",
      ...style,
    };

    const errStyle: React.CSSProperties = {
      fontSize: "var(--text-xs, 0.75rem)",
      color: "var(--danger, #f44336)",
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = "var(--border-focus, #B7FF00)";
      e.currentTarget.style.boxShadow = "0 0 0 2px rgba(183, 255, 0, 0.15)";
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = error
        ? "var(--danger, #f44336)"
        : "var(--border-default, #2a2a2a)";
      e.currentTarget.style.boxShadow = "none";
    };

    return (
      <div style={containerStyle}>
        {label && <label style={labelStyle}>{label}</label>}
        <input
          ref={ref}
          style={inputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {error && <span style={errStyle}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
