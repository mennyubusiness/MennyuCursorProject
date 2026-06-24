import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DASHBOARD_TIER_CLASS, type DashboardShellTier } from "./dashboard-styles";

export type { DashboardShellTier };

type DashboardShellProps = {
  children: ReactNode;
  tier?: DashboardShellTier;
  /** When true, wraps children in a sidebar + main flex row on large screens. */
  withSidebar?: boolean;
  className?: string;
};

/**
 * Content shell for role dashboards (width + padding). Does not include global oo-dash titlebar.
 * Prefer React primitives under src/components/dashboard/ for new dashboard work.
 */
export function DashboardShell({
  children,
  tier = "command",
  withSidebar = false,
  className,
}: DashboardShellProps) {
  return (
    <div className={cn(DASHBOARD_TIER_CLASS[tier], className)}>
      {withSidebar ? (
        <div className="lg:flex lg:items-start lg:gap-8">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

/** Main column when using DashboardShell with withSidebar. */
export function DashboardShellMain({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 flex-1", className)}>{children}</div>;
}
