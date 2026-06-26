import Link from "next/link";

import { DashboardCard, DashboardMetricCard, DashboardMetricGrid } from "@/components/dashboard";
import type { PodAnalyticsRange } from "@/services/pod-analytics.service";
import type { getPodAnalyticsExtended } from "@/services/pod-analytics.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

const RANGE_LABELS: Record<PodAnalyticsRange, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

export function PodAnalyticsView({
  podId,
  range,
  analytics,
}: {
  podId: string;
  range: PodAnalyticsRange;
  analytics: NonNullable<Awaited<ReturnType<typeof getPodAnalyticsExtended>>>;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {(["today", "7d", "30d"] as const).map((value) => (
          <Link
            key={value}
            href={`/pod/${podId}/analytics?range=${value}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              range === value
                ? "bg-oo-charcoal text-oo-warm-white"
                : "bg-oo-cream text-oo-charcoal hover:bg-oo-warm-white"
            }`}
          >
            {RANGE_LABELS[value]}
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-oo-charcoal">Overview</h2>
        <DashboardMetricGrid>
          <DashboardMetricCard label="Total orders" value={analytics.ordersInRange} />
          <DashboardMetricCard label="Total sales" value={formatMoney(analytics.salesInRangeCents)} />
          <DashboardMetricCard
            label="Average order value"
            value={
              analytics.ordersInRange > 0
                ? formatMoney(analytics.avgOrderValueInRangeCents)
                : "—"
            }
          />
          <DashboardMetricCard
            label="Vendors with sales"
            value={analytics.vendorBreakdown.length}
          />
          <DashboardMetricCard
            label="Orderable vendors"
            value={analytics.participation.vendorsInPod}
          />
        </DashboardMetricGrid>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-oo-charcoal">Trends</h2>
        <DashboardCard title="Orders and sales by day" description="Aggregated pod activity only.">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-oo-light-stone text-oo-stone-gray">
                  <th className="px-3 py-2 font-medium">Day</th>
                  <th className="px-3 py-2 font-medium">Orders</th>
                  <th className="px-3 py-2 font-medium">Sales</th>
                </tr>
              </thead>
              <tbody>
                {analytics.trends.map((day) => (
                  <tr key={day.date} className="border-b border-oo-light-stone/70">
                    <td className="px-3 py-2 text-oo-charcoal">{day.label}</td>
                    <td className="px-3 py-2 text-oo-charcoal">{day.orderCount}</td>
                    <td className="px-3 py-2 text-oo-charcoal">{formatMoney(day.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-oo-charcoal">Vendor breakdown</h2>
        <DashboardCard description="Aggregated by vendor — no customer or order-level details.">
          {analytics.vendorBreakdown.length === 0 ? (
            <p className="text-sm text-oo-stone-gray">No vendor sales in this period yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-oo-light-stone text-oo-stone-gray">
                    <th className="px-3 py-2 font-medium">Vendor</th>
                    <th className="px-3 py-2 font-medium">Orders</th>
                    <th className="px-3 py-2 font-medium">Sales</th>
                    <th className="px-3 py-2 font-medium">Share</th>
                    <th className="px-3 py-2 font-medium">AOV</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.vendorBreakdown.map((row) => (
                    <tr key={row.vendorId} className="border-b border-oo-light-stone/70">
                      <td className="px-3 py-2 font-medium text-oo-charcoal">{row.vendorName}</td>
                      <td className="px-3 py-2 text-oo-charcoal">{row.orderCount}</td>
                      <td className="px-3 py-2 text-oo-charcoal">{formatMoney(row.salesCents)}</td>
                      <td className="px-3 py-2 text-oo-charcoal">{row.sharePercent}%</td>
                      <td className="px-3 py-2 text-oo-charcoal">
                        {row.orderCount > 0 ? formatMoney(row.avgOrderValueCents) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>
      </section>
    </div>
  );
}
