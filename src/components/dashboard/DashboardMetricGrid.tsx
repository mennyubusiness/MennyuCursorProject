import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type DashboardMetricGridProps = {
  children: ReactNode;
  className?: string;
  columns?: "auto" | "three";
};

export function DashboardMetricGrid({
  children,
  className,
  columns = "auto",
}: DashboardMetricGridProps) {
  return (
    <div
      className={cn(
        "grid gap-2 sm:gap-3",
        columns === "three"
          ? "grid-cols-2 lg:grid-cols-3"
          : "grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}
