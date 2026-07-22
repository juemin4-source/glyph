import { useState, useEffect, useRef, forwardRef, type InputHTMLAttributes } from "react";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  debounceMs?: number;
  icon?: boolean;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value = "", onChange, debounceMs = 300, icon = true, placeholder = "Search...", style, ...props }, ref) => {
    const [localValue, setLocalValue] = useState(value);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isFirstRender = useRef(true);

    useEffect(() => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }
      setLocalValue(value);
    }, [value]);

    useEffect(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (onChange && localValue !== value) onChange(localValue);
      }, debounceMs);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }, [localValue, debounceMs, onChange, value]);

    const containerStyle: React.CSSProperties = {
      position: "relative",
      display: "flex",
      alignItems: "center",
    };

    const inputStyle: React.CSSProperties = {
      height: 32,
      width: "100%",
      padding: icon ? "0 32px 0 10px" : "0 10px",
      background: "var(--bg-input, #0a0a0a)",
      border: "1px solid var(--border-default, #2a2a2a)",
      borderRadius: "var(--radius-md, 6px)",
      color: "var(--text-primary, #e0e0e0)",
      fontSize: "var(--text-sm, 0.8125rem)",
      fontFamily: "var(--font-body, sans-serif)",
      outline: "none",
      transition: "border-color var(--transition-fast, 0.15s ease)",
      boxSizing: "border-box",
      ...style,
    };

    const iconStyle: React.CSSProperties = {
      position: "absolute",
      right: 10,
      color: "var(--text-muted, #666)",
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = "var(--border-focus, #B7FF00)";
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = "var(--border-default, #2a2a2a)";
    };

    return (
      <div style={containerStyle}>
        <input
          ref={ref}
          type="text"
          value={localValue}
          placeholder={placeholder}
          style={inputStyle}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        {icon && (
          <span style={iconStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
export default SearchInput;
