"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  className
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    const focusTimer = setTimeout(() => {
      const firstFocusable = sheetRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      clearTimeout(focusTimer);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "sheet-title" : undefined}
      aria-describedby={description ? "sheet-desc" : undefined}
    >
      <div
        className="absolute inset-0 bg-black/60 animate-backdrop-fade"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className={cn(
          "relative w-full sm:max-w-lg liquid-glass-strong rounded-t-3xl sm:rounded-3xl",
          "max-h-[90vh] overflow-y-auto scrollbar-thin",
          "animate-sheet-enter",
          className
        )}
        tabIndex={-1}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 pb-4 border-b border-liquid-border bg-inherit">
          <div className="space-y-1">
            {title && (
              <h2 id="sheet-title" className="text-xl font-semibold text-liquid-text">
                {title}
              </h2>
            )}
            {description && (
              <p id="sheet-desc" className="text-sm text-liquid-text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="focus-ring rounded-lg p-2 -mr-2 -mt-1 text-liquid-text-muted hover:text-liquid-text hover:bg-white/[0.06] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-6 pt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
