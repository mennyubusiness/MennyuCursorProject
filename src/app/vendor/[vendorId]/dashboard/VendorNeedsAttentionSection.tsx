import Link from "next/link";

import type { VendorAttentionItem } from "@/lib/vendor-dashboard-attention";

export function VendorNeedsAttentionSection({
  items,
}: {
  vendorId: string;
  items: VendorAttentionItem[];
  setupComplete: boolean;
}) {
  if (items.length === 0) {
    return null;
  }

  const summaryItems = items.filter((item) => item.kind === "summary");
  const actionItems = items.filter((item) => item.kind !== "summary");

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Needs attention</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">Fix these before customers run into problems.</p>
      </div>
      {summaryItems.length > 0 ? (
        <ul className="space-y-2">
          {summaryItems.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1">{item.description}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {actionItems.length > 0 ? (
        <ul className="space-y-2">
          {actionItems.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border px-4 py-3 text-sm ${
                item.severity === "warning"
                  ? "border-amber-200 bg-amber-50/70 text-amber-950"
                  : "border-oo-light-stone bg-oo-cream/60 text-oo-charcoal"
              }`}
            >
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1">{item.description}</p>
              {item.actionHref && item.actionLabel ? (
                <Link href={item.actionHref} className="mt-2 inline-block font-medium underline">
                  {item.actionLabel}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
