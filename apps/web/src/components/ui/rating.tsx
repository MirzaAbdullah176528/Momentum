import { cn } from "@/lib/utils";

export function ratingTier(rating: number): string {
  if (rating >= 9) return "s";
  if (rating >= 8) return "a";
  if (rating >= 6) return "b";
  if (rating >= 4) return "c";
  if (rating >= 1) return "d";
  return "f";
}

export function ratingColor(rating: number): string {
  const tier = ratingTier(rating);
  return `var(--color-rating-tier-${tier})`;
}

export function ratingLabel(rating: number): string {
  const tier = ratingTier(rating);
  const labels: Record<string, string> = {
    s: "exceptional",
    a: "excellent",
    b: "good",
    c: "fair",
    d: "below average",
    f: "needs improvement"
  };
  return labels[tier] ?? "unknown";
}

interface RatingBadgeProps {
  rating: number;
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-6xl",
  xl: "text-7xl"
} as const;

const suffixSizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl"
} as const;

export function RatingBadge({
  rating,
  size = "md",
  showLabel = false,
  className
}: RatingBadgeProps) {
  const tier = ratingTier(rating);
  const formatted = rating.toFixed(1);
  const label = ratingLabel(rating);

  return (
    <div
      className={cn("flex items-baseline gap-1", className)}
      role="img"
      aria-label={`Daily rating: ${formatted} out of 10. ${label}.`}
    >
      <span
        className={cn(
          "font-bold tabular-nums leading-none",
          sizeClasses[size],
          `rating-tier-${tier}`
        )}
        aria-hidden="true"
      >
        {formatted}
      </span>
      <span
        className={cn(
          "font-medium text-liquid-text-subtle leading-none",
          suffixSizeClasses[size]
        )}
        aria-hidden="true"
      >
        /10
      </span>
      {showLabel && (
        <span
          className={cn(
            "ml-2 text-xs uppercase tracking-wide font-medium",
            `rating-tier-${tier}`
          )}
          aria-hidden="true"
        >
          {label}
        </span>
      )}
    </div>
  );
}

interface RatingDotProps {
  rating: number;
  className?: string;
}

export function RatingDot({ rating, className }: RatingDotProps) {
  const tier = ratingTier(rating);
  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full",
        `rating-tier-${tier}`,
        className
      )}
      aria-hidden="true"
    />
  );
}

interface RatingCellProps {
  rating: number;
  date?: string;
  className?: string;
}

export function RatingCell({ rating, date, className }: RatingCellProps) {
  const tier = ratingTier(rating);
  const display = rating > 0 ? rating.toFixed(1) : "—";
  return (
    <div
      className={cn(
        "aspect-square rounded-lg border flex flex-col items-center justify-center text-xs font-medium transition-colors",
        `rating-bg-${tier}`,
        rating === 0 && "bg-white/[0.02] border-liquid-border text-liquid-text-subtle",
        className
      )}
      role="img"
      aria-label={date ? `${date}: rating ${rating > 0 ? rating.toFixed(1) : "no rating"}` : `rating ${rating > 0 ? rating.toFixed(1) : "no rating"}`}
    >
      <span className={rating > 0 ? `rating-tier-${tier}` : ""} aria-hidden="true">
        {display}
      </span>
    </div>
  );
}
