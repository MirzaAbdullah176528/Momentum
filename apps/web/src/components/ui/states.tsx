import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./button";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. Please try again.",
  onRetry
}: ErrorStateProps) {
  return (
    <div
      className="liquid-glass p-8 flex flex-col items-center gap-4 text-center"
      role="alert"
    >
      <div className="w-12 h-12 rounded-full bg-liquid-danger/15 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-liquid-danger" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-liquid-text">{title}</h3>
        <p className="text-sm text-liquid-text-muted max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <Button variant="glass" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon,
  title,
  message,
  action
}: EmptyStateProps) {
  return (
    <div className="liquid-glass p-8 flex flex-col items-center gap-4 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-liquid-accent-soft flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-liquid-text">{title}</h3>
        {message && (
          <p className="text-sm text-liquid-text-muted max-w-sm">{message}</p>
        )}
      </div>
      {action && (
        <Button variant="primary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
