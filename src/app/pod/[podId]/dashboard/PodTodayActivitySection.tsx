import Link from "next/link";

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
  podMenuOnly = false,
  listedVendorCount = 0,
  activeVendorCount = 0,
  promoteHref,
}: {
  summary: PodAnalytics["summary"];
  participation: PodAnalytics["participation"];
  orderableVendorCount: number;
  /** Pod-wide ordering is off: commerce metrics are replaced, not shown as zeroes. */
  podMenuOnly?: boolean;
  listedVendorCount?: number;
  activeVendorCount?: number;
  promoteHref?: string;
}) {
  if (podMenuOnly) {
    return (
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-oo-charcoal">Your pod page</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            What customers can browse right now.
          </p>
        </div>
        <DashboardMetricGrid>
          <DashboardMetricCard label="Vendors in pod" value={activeVendorCount} />
          <DashboardMetricCard label="Menus live" value={listedVendorCount} />
        </DashboardMetricGrid>
        {promoteHref ? (
          <Link
            href={promoteHref}
            className="inline-flex items-center text-sm font-semibold text-oo-charcoal hover:underline"
          >
            Share your pod page and QR
          </Link>
        ) : null}
      </section>
    );
  }

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
