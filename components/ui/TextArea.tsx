import { forwardRef, type TextareaHTMLAttributes } from "react";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ error, className = "", style, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={`input textarea${error ? " input-error" : ""}${className ? " " + className : ""}`}
        style={style}
        {...props}
      />
    );
  }
);

TextArea.displayName = "TextArea";
export default TextArea;
