import type { VendorAnalytics } from "@/services/vendor-analytics.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function VendorAnalyticsSection({ data }: { data: VendorAnalytics }) {
  const { today, last7, topItems } = data;

  return (
    <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-600">
        Analytics
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium text-stone-500">Today</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{today.orders}</p>
          <p className="text-sm text-stone-600">Orders</p>
          <p className="mt-2 text-lg font-medium text-stone-800">
            {formatMoney(today.revenueCents)}
          </p>
          <p className="text-sm text-stone-600">Revenue</p>
          <p className="mt-1 text-sm text-stone-700">
            {today.orders > 0 ? formatMoney(today.avgOrderCents) : "—"} avg order
          </p>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs font-medium text-stone-500">Last 7 days</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{last7.orders}</p>
          <p className="text-sm text-stone-600">Orders</p>
          <p className="mt-2 text-lg font-medium text-stone-800">
            {formatMoney(last7.revenueCents)}
          </p>
          <p className="text-sm text-stone-600">Revenue</p>
          <p className="mt-1 text-sm text-stone-700">
            {last7.orders > 0 ? formatMoney(last7.avgOrderCents) : "—"} avg order
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-stone-500">Top items (last 7 days)</p>
        {topItems.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No completed orders in this period.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {topItems.map((item, i) => (
              <li
                key={`${item.name}-${i}`}
                className="flex justify-between text-sm text-stone-700"
              >
                <span className="truncate">{item.name}</span>
                <span className="ml-2 font-medium tabular-nums">{item.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
