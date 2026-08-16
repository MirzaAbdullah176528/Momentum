import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-liquid-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? errorId : hint ? hintId : undefined
          }
          className={cn(
            "w-full rounded-xl border border-liquid-border bg-white/[0.05] px-4 py-2.5 text-liquid-text placeholder:text-liquid-text-subtle",
            "transition-all duration-200 hover:bg-white/[0.07]",
            "focus:border-liquid-accent/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-liquid-accent/25 focus:outline-none",
            error && "border-liquid-danger/50 focus:border-liquid-danger/60 focus:ring-liquid-danger/20",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-liquid-text-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-liquid-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const errorId = `${selectId}-error`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-liquid-text-secondary"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full rounded-xl border border-liquid-border bg-white/[0.05] px-4 py-2.5 text-liquid-text",
            "transition-all duration-200 hover:bg-white/[0.07]",
            "focus:border-liquid-accent/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-liquid-accent/25 focus:outline-none",
            error && "border-liquid-danger/50 focus:border-liquid-danger/60 focus:ring-liquid-danger/20",
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-liquid-bg-elevated text-liquid-text"
            >
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="text-xs text-liquid-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const errorId = `${textareaId}-error`;
    const hintId = `${textareaId}-hint`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-liquid-text-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? errorId : hint ? hintId : undefined
          }
          className={cn(
            "w-full rounded-xl border border-liquid-border bg-white/[0.05] px-4 py-2.5 text-liquid-text placeholder:text-liquid-text-subtle",
            "transition-all duration-200 hover:bg-white/[0.07] resize-none",
            "focus:border-liquid-accent/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-liquid-accent/25 focus:outline-none",
            error && "border-liquid-danger/50 focus:border-liquid-danger/60 focus:ring-liquid-danger/20",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-xs text-liquid-text-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-liquid-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
