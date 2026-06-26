import type { PodAnalytics } from "@/services/pod-analytics.service";
import { DashboardMetricCard, DashboardMetricGrid } from "@/components/dashboard";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function PodTodayActivitySection({
  summary,
  participation,
  orderableVendorCount,
}: {
  summary: PodAnalytics["summary"];
  participation: PodAnalytics["participation"];
  orderableVendorCount: number;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Today&apos;s activity</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">Aggregated pod performance through Open Order.</p>
      </div>
      <DashboardMetricGrid>
        <DashboardMetricCard label="Orders today" value={summary.ordersToday} />
        <DashboardMetricCard label="Sales today" value={formatMoney(summary.grossSalesTodayCents)} />
        <DashboardMetricCard label="Orderable vendors" value={orderableVendorCount} />
        <DashboardMetricCard
          label="Vendors with orders today"
          value={participation.vendorsWithOrderToday}
        />
        <DashboardMetricCard
          label="Average order value"
          value={summary.ordersLast7 > 0 ? formatMoney(summary.avgOrderValueCents) : "—"}
          empty={summary.ordersLast7 === 0}
        />
        <DashboardMetricCard label="Orders last 7 days" value={summary.ordersLast7} />
      </DashboardMetricGrid>
    </section>
  );
}
