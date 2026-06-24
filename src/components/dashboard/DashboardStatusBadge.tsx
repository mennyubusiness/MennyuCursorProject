import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DASHBOARD_STATUS_TONE_CLASS, type DashboardStatusTone } from "./dashboard-styles";

export type { DashboardStatusTone };

type DashboardStatusBadgeProps = {
  tone: DashboardStatusTone;
  children: ReactNode;
  className?: string;
};

export function DashboardStatusBadge({ tone, children, className }: DashboardStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        DASHBOARD_STATUS_TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
