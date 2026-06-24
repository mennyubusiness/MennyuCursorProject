import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type DashboardPageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  status?: ReactNode;
  actions?: ReactNode;
  /** Semantic heading level for the page/section title. */
  headingLevel?: 1 | 2;
  className?: string;
};

export function DashboardPageHeader({
  title,
  eyebrow,
  description,
  status,
  actions,
  headingLevel = 2,
  className,
}: DashboardPageHeaderProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const titleClass =
    headingLevel === 1
      ? "text-2xl font-semibold tracking-tight text-oo-charcoal"
      : "text-lg font-semibold text-oo-charcoal";

  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-oo-stone-gray">{eyebrow}</p>
        ) : null}
        <div className={cn("flex flex-wrap items-center gap-2", eyebrow && "mt-1")}>
          <Heading className={titleClass}>{title}</Heading>
          {status}
        </div>
        {description ? <p className="mt-1 text-sm text-oo-stone-gray">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
