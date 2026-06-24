import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DASHBOARD_METRIC_TONE_CLASS, type DashboardMetricTone } from "./dashboard-styles";

export type { DashboardMetricTone };

type DashboardMetricCardProps = {
  label: string;
  value: ReactNode;
  helper?: string;
  tone?: DashboardMetricTone;
  empty?: boolean;
  className?: string;
};

export function DashboardMetricCard({
  label,
  value,
  helper,
  tone = "default",
  empty = false,
  className,
}: DashboardMetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 sm:p-4",
        DASHBOARD_METRIC_TONE_CLASS[tone],
        empty && "opacity-90",
        className
      )}
    >
      <p className="text-xs font-medium text-oo-stone-gray">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal",
          empty && "text-oo-stone-gray"
        )}
      >
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs text-oo-stone-gray">{helper}</p> : null}
    </div>
  );
}
