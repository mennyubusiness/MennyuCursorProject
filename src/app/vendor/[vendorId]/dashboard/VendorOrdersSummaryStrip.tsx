"use client";

type Props = {
  needsAttention: number;
  preparing: number;
  ready: number;
  completedToday: number;
};

export function VendorOrdersSummaryStrip({ needsAttention, preparing, ready, completedToday }: Props) {
  const cell = (label: string, value: number, highlight: boolean) => (
    <div
      className={`min-w-0 flex-1 rounded-lg px-3 py-3 sm:px-4 ${
        highlight ? "bg-brand-muted ring-1 ring-brand/35" : "bg-oo-cream/80"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-oo-stone-gray">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          highlight && value > 0 ? "text-oo-charcoal" : "text-oo-charcoal"
        }`}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {cell("Needs action", needsAttention, needsAttention > 0)}
      {cell("Preparing", preparing, false)}
      {cell("Ready", ready, false)}
      {cell("Completed today", completedToday, false)}
    </div>
  );
}
