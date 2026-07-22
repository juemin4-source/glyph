import { forwardRef, type SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, style, ...props }, ref) => {
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

    const selectStyle: React.CSSProperties = {
      height: 36,
      padding: "0 32px 0 12px",
      background: "var(--bg-input, #0a0a0a)",
      border: `1px solid ${error ? "var(--danger, #f44336)" : "var(--border-default, #2a2a2a)"}`,
      borderRadius: "var(--radius-md, 6px)",
      color: "var(--text-primary, #e0e0e0)",
      fontSize: "var(--text-sm, 0.8125rem)",
      fontFamily: "var(--font-body, sans-serif)",
      outline: "none",
      cursor: "pointer",
      appearance: "none",
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0a0a0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 10px center",
      transition: "border-color var(--transition-fast, 0.15s ease), box-shadow var(--transition-fast, 0.15s ease)",
      width: "100%",
      boxSizing: "border-box",
      ...style,
    };

    const errStyle: React.CSSProperties = {
      fontSize: "var(--text-xs, 0.75rem)",
      color: "var(--danger, #f44336)",
    };

    const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = "var(--border-focus, #B7FF00)";
      e.currentTarget.style.boxShadow = "0 0 0 2px rgba(183, 255, 0, 0.15)";
    };

    const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = error
        ? "var(--danger, #f44336)"
        : "var(--border-default, #2a2a2a)";
      e.currentTarget.style.boxShadow = "none";
    };

    return (
      <div style={containerStyle}>
        {label && <label style={labelStyle}>{label}</label>}
        <select
          ref={ref}
          style={selectStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span style={errStyle}>{error}</span>}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
