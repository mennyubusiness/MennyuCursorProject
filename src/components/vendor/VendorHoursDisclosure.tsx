"use client";

import { useId, useState } from "react";
import type { VendorHoursDisplayModel } from "@/lib/vendor-hours-display";
import { cn } from "@/lib/cn";

type VendorHoursDisclosureProps = {
  display: VendorHoursDisplayModel;
  className?: string;
  /** Smaller padding/text for dense vendor cards. */
  compact?: boolean;
};

/** Collapsible today + weekly vendor hours for customer-facing surfaces. */
export function VendorHoursDisclosure({ display, className, compact }: VendorHoursDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const canExpand = display.hasHours && display.weeklyDisplayRows.length > 0;

  if (!canExpand) {
    return (
      <p
        className={cn(
          "text-oo-stone-gray",
          compact ? "text-xs leading-snug" : "text-sm",
          className
        )}
      >
        {display.todayCollapsedLabel}
      </p>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setExpanded((value) => !value);
        }}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn(
          "flex w-full min-h-11 items-center justify-between gap-2 rounded-lg border border-oo-light-stone/90 bg-oo-cream/60 text-left transition-colors",
          "hover:border-brand/25 hover:bg-oo-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          compact ? "px-2.5 py-2 text-xs" : "px-3 py-2.5 text-sm"
        )}
      >
        <span className="min-w-0 font-medium text-oo-charcoal">{display.todayCollapsedLabel}</span>
        <span className="flex shrink-0 items-center gap-1 text-oo-stone-gray">
          <span className={cn("font-medium", compact ? "text-[10px]" : "text-xs")}>
            {expanded ? "Hide hours" : "View full hours"}
          </span>
          <span aria-hidden className={compact ? "text-[10px]" : "text-xs"}>
            {expanded ? "▴" : "▾"}
          </span>
        </span>
      </button>

      {expanded ? (
        <ul
          id={panelId}
          className={cn(
            "mt-2 space-y-1 rounded-lg border border-oo-light-stone/80 bg-oo-warm-white/80",
            compact ? "px-2.5 py-2" : "px-3 py-2.5"
          )}
        >
          {display.weeklyDisplayRows.map((row) => (
            <li
              key={row.dayKey}
              className={cn(
                "flex items-baseline justify-between gap-3",
                compact ? "text-xs" : "text-sm",
                row.isToday && "rounded-md bg-brand/5 px-1.5 py-0.5 -mx-0.5"
              )}
            >
              <span
                className={cn(
                  "shrink-0 font-medium",
                  row.isToday ? "text-oo-charcoal" : "text-oo-stone-gray"
                )}
              >
                {row.dayLabel}
                {row.isToday ? (
                  <span className="sr-only"> (today)</span>
                ) : null}
              </span>
              <span
                className={cn(
                  "text-right",
                  row.isClosed ? "text-oo-stone-gray" : "text-oo-charcoal"
                )}
              >
                {row.displayText}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
