import type { AdminOrderTimelineEntry } from "@/lib/admin-order-timeline";
import { ADMIN_DETAILS_SECTION, formatAdminOrderDate } from "@/lib/admin-order-detail-ui";

export function AdminOrderTimelineSection({ timeline }: { timeline: AdminOrderTimelineEntry[] }) {
  if (timeline.length === 0) return null;

  const latest = timeline[timeline.length - 1]!;
  const defaultOpen = timeline.length <= 4;

  return (
    <details className={`${ADMIN_DETAILS_SECTION} px-5 py-4`} open={defaultOpen ? true : undefined}>
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-oo-charcoal">Order timeline</h2>
          {!defaultOpen && (
            <span className="text-xs text-oo-stone-gray">
              Latest: {latest.title} · {formatAdminOrderDate(latest.at)}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-oo-stone-gray">
          {timeline.length} event{timeline.length === 1 ? "" : "s"} — parent, vendors, issues, refunds
        </p>
      </summary>
      <ul className="mt-4 space-y-3 border-t border-oo-light-stone pt-4">
        {timeline.map((e) => {
          const isManualRecovery = e.title.toLowerCase().includes("manual");
          return (
            <li
              key={e.id}
              className={`flex flex-col gap-0.5 border-b border-oo-light-stone pb-3 text-sm last:border-0 last:pb-0 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3 ${
                isManualRecovery ? "rounded-md border-emerald-200 bg-emerald-50/50 px-2 py-2" : ""
              }`}
            >
              <span className="shrink-0 text-xs tabular-nums text-oo-stone-gray">
                {formatAdminOrderDate(e.at)}
              </span>
              <span className="font-medium text-oo-charcoal">{e.title}</span>
              <span className="text-xs text-oo-stone-gray">{e.sourceLabel}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
