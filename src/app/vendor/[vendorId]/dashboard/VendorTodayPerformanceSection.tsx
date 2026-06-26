function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type TodayStats = {
  orders: number;
  salesCents: number;
  tipsCents: number;
  avgOrderCents: number;
  failedOrCancelled: number;
};

export function VendorTodayPerformanceSection({ stats }: { stats: TodayStats }) {
  const cards = [
    { label: "Orders today", value: String(stats.orders) },
    { label: "Sales today", value: formatMoney(stats.salesCents) },
    { label: "Tips today", value: formatMoney(stats.tipsCents) },
    { label: "Average order", value: stats.orders > 0 ? formatMoney(stats.avgOrderCents) : "—" },
    {
      label: "Failed or cancelled",
      value: String(stats.failedOrCancelled),
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Today&apos;s performance</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">Completed orders only. Operations come first.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium text-oo-stone-gray">{card.label}</p>
            <p className="mt-1 text-xl font-bold text-oo-charcoal">{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
