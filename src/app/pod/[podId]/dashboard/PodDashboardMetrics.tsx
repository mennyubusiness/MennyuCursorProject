import type { PodAnalytics } from "@/services/pod-analytics.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function podDashboardHasOrderActivity(summary: PodAnalytics["summary"]): boolean {
  return summary.ordersToday > 0 || summary.ordersLast7 > 0;
}

type PodDashboardMetricsProps = {
  summary: PodAnalytics["summary"];
  orderableVendorCount: number;
};

export function PodDashboardMetrics({ summary, orderableVendorCount }: PodDashboardMetricsProps) {
  const hasOrders = podDashboardHasOrderActivity(summary);

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
        Open Order at your pod
      </h2>
      <p className="mt-1 text-sm text-oo-stone-gray">
        Aggregated order activity at your pod through Open Order.
      </p>

      {!hasOrders ? (
        <p className="mt-4 rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-3 text-sm text-oo-charcoal">
          No Open Order sales yet. Share your pod QR code and make sure vendors are orderable to start
          capturing orders.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
          <p className="text-xs font-medium text-oo-stone-gray">Orders today</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">{summary.ordersToday}</p>
        </div>

        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
          <p className="text-xs font-medium text-oo-stone-gray">Orders (last 7 days)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">{summary.ordersLast7}</p>
        </div>

        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
          <p className="text-xs font-medium text-oo-stone-gray">Orderable vendors</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">
            {orderableVendorCount}
          </p>
          <p className="mt-1 text-xs text-oo-stone-gray">
            of {summary.activeVendors} active in pod
          </p>
        </div>

        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-oo-stone-gray">Open Order volume (last 7 days)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">
            {formatMoney(summary.grossSalesLast7Cents)}
          </p>
          <p className="mt-1 text-xs text-oo-stone-gray">Order volume through Open Order at this pod</p>
        </div>

        <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
          <p className="text-xs font-medium text-oo-stone-gray">Average order (last 7 days)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">
            {summary.ordersLast7 > 0 ? formatMoney(summary.avgOrderValueCents) : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}
