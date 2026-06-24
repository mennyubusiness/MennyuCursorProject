import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DASHBOARD_SECTION_SCROLL_CLASS } from "./dashboard-styles";
import { DashboardPageHeader } from "./DashboardPageHeader";

type DashboardSectionProps = {
  id?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** When false, only renders children inside the section wrapper (no header). */
  showHeader?: boolean;
};

export function DashboardSection({
  id,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  showHeader = true,
}: DashboardSectionProps) {
  const hasHeader = showHeader && Boolean(title);

  return (
    <section id={id} className={cn(DASHBOARD_SECTION_SCROLL_CLASS, className)}>
      {hasHeader ? (
        <DashboardPageHeader title={title!} description={description} actions={actions} />
      ) : null}
      <div className={cn(hasHeader && "mt-6 space-y-6", contentClassName)}>{children}</div>
    </section>
  );
}
