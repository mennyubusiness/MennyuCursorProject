import { cn } from "@/lib/cn";

const MOCK_VENDORS = ["Ramen House", "Taco Stand", "Coffee Cart"] as const;

const MOCK_STATUSES = [
  { vendor: "Ramen House", label: "Preparing", tone: "amber" as const },
  { vendor: "Taco Stand", label: "Ready", tone: "emerald" as const },
] as const;

type HomeProductPreviewProps = {
  className?: string;
};

/** Stylized static preview of the pod ordering experience for marketing. */
export function HomeProductPreview({ className }: HomeProductPreviewProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-oo-light-stone/20 bg-oo-warm-white text-oo-charcoal shadow-2xl",
        className
      )}
      aria-hidden
    >
      <div className="border-b border-oo-light-stone bg-oo-cream/80 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Example pod</p>
        <p className="mt-1 text-lg font-black tracking-tight">Willamette Garage</p>
        <p className="mt-1 text-sm text-oo-stone-gray">3 vendors · One checkout</p>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Vendors</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {MOCK_VENDORS.map((name) => (
              <li
                key={name}
                className="rounded-full border border-oo-light-stone bg-oo-cream/70 px-3 py-1 text-xs font-medium text-oo-charcoal"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/50 px-4 py-3">
          <p className="text-sm font-semibold text-oo-charcoal">Shared cart</p>
          <p className="mt-0.5 text-sm text-oo-stone-gray">4 items from 2 vendors</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Order status
          </p>
          <ul className="mt-2 space-y-2">
            {MOCK_STATUSES.map((row) => (
              <li
                key={row.vendor}
                className="flex items-center justify-between gap-3 rounded-lg border border-oo-light-stone bg-white px-3 py-2.5"
              >
                <span className="truncate text-sm font-medium text-oo-charcoal">{row.vendor}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    row.tone === "emerald"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900"
                  )}
                >
                  {row.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-oo-light-stone bg-brand/10 px-5 py-3">
        <p className="text-center text-sm font-semibold text-oo-charcoal">One checkout across the pod</p>
      </div>
    </div>
  );
}
