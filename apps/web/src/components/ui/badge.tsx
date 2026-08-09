import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral:
          "bg-white/[0.06] text-liquid-text-secondary border-liquid-border",
        accent:
          "bg-liquid-accent-soft text-liquid-accent border-liquid-accent/30",
        success:
          "bg-liquid-success/10 text-liquid-success border-liquid-success/30",
        warning:
          "bg-liquid-warning/10 text-liquid-warning border-liquid-warning/30",
        danger:
          "bg-liquid-danger/10 text-liquid-danger border-liquid-danger/30",
        info: "bg-liquid-info/10 text-liquid-info border-liquid-info/30"
      }
    },
    defaultVariants: {
      tone: "neutral"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  );
}
