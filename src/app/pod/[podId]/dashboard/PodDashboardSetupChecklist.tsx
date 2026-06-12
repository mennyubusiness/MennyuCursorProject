import Link from "next/link";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

export function PodDashboardSetupChecklist({ items }: { items: ReadinessChecklistItem[] }) {
  const completeCount = items.filter((i) => i.complete).length;

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-oo-charcoal">Pod setup</h2>
        <p className="text-xs text-oo-stone-gray">
          {completeCount} of {items.length} complete
        </p>
      </div>
      <p className="mt-1 text-sm text-oo-stone-gray">
        Finish these steps so customers can find and order from your pod.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.key} className="flex gap-3 rounded-lg border border-oo-light-stone bg-oo-warm-white p-3">
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
              {item.description ? <p className="mt-0.5 text-sm text-oo-stone-gray">{item.description}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-oo-cream px-1.5 py-0.5 text-oo-stone-gray">
                  {item.owner === "open_order" ? "Open Order" : "You"}
                </span>
                {item.actionHref && item.actionLabel && item.owner !== "open_order" ? (
                  <Link href={item.actionHref} className="font-medium text-oo-charcoal hover:underline">
                    {item.actionLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
