import Link from "next/link";

import { DashboardCard } from "@/components/dashboard";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

export function PodReadinessPodSection({ items }: { items: ReadinessChecklistItem[] }) {
  return (
    <DashboardCard
      title="Pod readiness"
      description="Required pod-level checks before customers can order."
      as="section"
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-2 rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2.5 text-sm"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                item.complete ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
              }`}
              aria-hidden
            >
              {item.complete ? "✓" : "·"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-oo-charcoal">{item.label}</p>
              {!item.complete && item.actionHref && item.actionLabel ? (
                <Link href={item.actionHref} className="mt-1 inline-block text-xs font-medium underline">
                  {item.actionLabel}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
