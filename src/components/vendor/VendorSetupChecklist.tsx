import Link from "next/link";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

function ownerLabel(owner: ReadinessChecklistItem["owner"]): string {
  if (owner === "pod_owner") return "Pod owner";
  if (owner === "open_order") return "Open Order";
  return "Vendor";
}

export function vendorSetupItemStatusLabel(item: ReadinessChecklistItem): string {
  if (item.complete) return "Ready";
  if (item.key === "pod_invite" && item.description?.includes("pending invitation")) {
    return "Waiting for vendor acceptance";
  }
  if (item.key === "pod_invite" && !item.complete) {
    return "Waiting for pod approval";
  }
  return "Needs attention";
}

export function VendorSetupChecklist({
  items,
  title = "Getting started",
  emptyCompleteCopy,
}: {
  items: ReadinessChecklistItem[];
  title?: string;
  emptyCompleteCopy?: string;
}) {
  if (items.length === 0 && emptyCompleteCopy) {
    return (
      <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 px-4 py-6 text-sm text-oo-stone-gray">
        <p>{emptyCompleteCopy}</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/80 p-4 text-sm text-oo-charcoal">
      <h3 className="font-semibold text-oo-charcoal">{title}</h3>
      <ol className="mt-3 space-y-3">
        {items.map((item, index) => {
          const statusLabel = vendorSetupItemStatusLabel(item);
          return (
            <li key={item.key} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  item.complete ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                }`}
                aria-hidden
              >
                {item.complete ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium text-oo-charcoal">{item.label}</span>
                  <span
                    className={`text-xs ${
                      item.complete ? "text-emerald-800" : "text-amber-900"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                {item.description ? <p className="mt-0.5 text-oo-stone-gray">{item.description}</p> : null}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-oo-warm-white px-1.5 py-0.5 text-oo-stone-gray">
                    {ownerLabel(item.owner)}
                  </span>
                  {item.actionHref && item.actionLabel ? (
                    <Link href={item.actionHref} className="font-medium text-oo-charcoal hover:underline">
                      {item.actionLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
