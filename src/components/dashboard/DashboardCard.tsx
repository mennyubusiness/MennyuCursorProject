import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  DASHBOARD_CARD_VARIANT_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
  type DashboardCardVariant,
} from "./dashboard-styles";

export type { DashboardCardVariant };

type DashboardCardProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  variant?: DashboardCardVariant;
  className?: string;
  /** Render as semantic section when a title is provided. */
  as?: "div" | "section";
};

export function DashboardCard({
  children,
  title,
  description,
  actions,
  variant = "default",
  className,
  as,
}: DashboardCardProps) {
  const Component = as ?? (title ? "section" : "div");
  const hasHeader = Boolean(title || description || actions);

  return (
    <Component
      className={cn(
        "rounded-xl border p-4 sm:p-5",
        DASHBOARD_CARD_VARIANT_CLASS[variant],
        className
      )}
    >
      {hasHeader ? (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {title ? <h3 className={DASHBOARD_SECTION_TITLE_CLASS}>{title}</h3> : null}
            {description ? (
              <p className={cn("text-sm text-oo-stone-gray", title && "mt-1")}>{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Component>
  );
}
