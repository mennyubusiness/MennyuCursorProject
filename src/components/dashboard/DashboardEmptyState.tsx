import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type DashboardEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
};

export function DashboardEmptyState({
  title,
  description,
  action,
  compact = false,
  className,
}: DashboardEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-oo-light-stone bg-oo-warm-white text-sm text-oo-charcoal",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        action && !compact ? "space-y-3" : undefined,
        className
      )}
      role="status"
    >
      <p className={cn("font-medium text-oo-charcoal", compact && "text-sm")}>{title}</p>
      {description ? (
        <p className={cn("text-oo-stone-gray", compact ? "mt-1 text-sm" : "mt-1")}>{description}</p>
      ) : null}
      {action ? <div className={compact ? "mt-2" : undefined}>{action}</div> : null}
    </div>
  );
}
