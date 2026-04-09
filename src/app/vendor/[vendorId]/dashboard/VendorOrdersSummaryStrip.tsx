"use client";

type Props = {
  ordersToday: number;
  needsAttention: number;
  inProgress: number;
  ready: number;
};

export function VendorOrdersSummaryStrip({ ordersToday, needsAttention, inProgress, ready }: Props) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-stone-200/90 bg-gradient-to-b from-white to-stone-50/90 p-4 shadow-sm sm:grid-cols-4 sm:gap-4">
      <div className="rounded-xl border border-stone-100 bg-white/80 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Orders today</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{ordersToday}</p>
      </div>
      <div
        className={`rounded-xl border px-3 py-3 ${
          needsAttention > 0
            ? "border-mennyu-primary/50 bg-mennyu-primary/10"
            : "border-stone-100 bg-white/80"
        }`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Needs action</p>
        <p
          className={`mt-1 text-2xl font-bold tabular-nums ${
            needsAttention > 0 ? "text-stone-900" : "text-stone-400"
          }`}
        >
          {needsAttention}
        </p>
      </div>
      <div className="rounded-xl border border-stone-100 bg-white/80 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">In progress</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-stone-900">{inProgress}</p>
      </div>
      <div className="rounded-xl border border-stone-100 bg-white/80 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Ready</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">{ready}</p>
      </div>
    </div>
  );
}
