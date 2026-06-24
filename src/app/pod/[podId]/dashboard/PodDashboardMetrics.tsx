import type { PodAnalytics } from "@/services/pod-analytics.service";
import {
  DashboardCard,
  DashboardEmptyState,
  DashboardMetricCard,
  DashboardMetricGrid,
} from "@/components/dashboard";

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
    <DashboardCard
      variant="muted"
      title="Open Order at your pod"
      description="Aggregated order activity at your pod through Open Order."
      className="p-3 sm:p-4"
    >
      {!hasOrders ? (
        <DashboardEmptyState
          title="No Open Order sales yet."
          description="Share your pod QR code and make sure vendors are orderable to start capturing orders."
          className="mt-4"
        />
      ) : null}

      <DashboardMetricGrid className="mt-4">
        <DashboardMetricCard label="Orders today" value={summary.ordersToday} />
        <DashboardMetricCard label="Orders (last 7 days)" value={summary.ordersLast7} />
        <DashboardMetricCard
          label="Orderable vendors"
          value={orderableVendorCount}
          helper={`of ${summary.activeVendors} vendors active in your pod`}
          className="col-span-2 sm:col-span-1 lg:col-span-1"
        />
        <DashboardMetricCard
          label="Open Order volume (last 7 days)"
          value={formatMoney(summary.grossSalesLast7Cents)}
          helper="Order volume through Open Order at this pod"
          className="col-span-2 sm:col-span-2 lg:col-span-1"
        />
        <DashboardMetricCard
          label="Average order (last 7 days)"
          value={summary.ordersLast7 > 0 ? formatMoney(summary.avgOrderValueCents) : "—"}
          empty={summary.ordersLast7 === 0}
        />
      </DashboardMetricGrid>
    </DashboardCard>
  );
}
