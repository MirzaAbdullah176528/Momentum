import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-liquid-accent focus-visible:ring-offset-2 focus-visible:ring-offset-liquid-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-liquid-accent text-white shadow-lg shadow-liquid-accent/30 hover:bg-liquid-accent/90 active:scale-[0.98]",
        glass:
          "liquid-glass text-liquid-text hover:bg-white/[0.08] active:scale-[0.98]",
        ghost:
          "text-liquid-text-muted hover:text-liquid-text hover:bg-white/[0.04]",
        danger:
          "bg-liquid-danger/15 text-liquid-danger border border-liquid-danger/30 hover:bg-liquid-danger/25"
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "glass",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
