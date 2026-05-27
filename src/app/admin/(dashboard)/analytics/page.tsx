import Link from "next/link";
import {
  getAdminAnalytics,
  type AdminAnalyticsRange,
} from "@/services/admin-analytics.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function RangeLink({
  current,
  value,
  label,
}: {
  current: AdminAnalyticsRange;
  value: AdminAnalyticsRange;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={`/admin/analytics?range=${value}`}
      className={
        active
          ? "rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
          : "rounded border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm text-oo-charcoal hover:bg-oo-cream"
      }
    >
      {label}
    </Link>
  );
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const raw = params.range ?? "7d";
  const range: AdminAnalyticsRange =
    raw === "today" || raw === "7d" || raw === "30d" ? raw : "7d";

  const data = await getAdminAnalytics(range);
  const { summary, trends, topVendors, topPods, topItems, health } = data;
  const hasAnyData =
    summary.totalOrders > 0 ||
    health.openOrderIssues > 0 ||
    health.openVendorOrderIssues > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">Analytics</h1>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Platform-wide order and operations overview
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
          Date range
        </span>
        <RangeLink current={range} value="today" label="Today" />
        <RangeLink current={range} value="7d" label="Last 7 days" />
        <RangeLink current={range} value="30d" label="Last 30 days" />
      </div>

      {!hasAnyData && summary.totalOrders === 0 ? (
        <div className="rounded-xl border border-oo-light-stone bg-oo-cream/50 px-6 py-10 text-center">
          <p className="font-medium text-oo-charcoal">No analytics available for this range yet</p>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Orders and operations in the selected period will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <section className="rounded-lg border border-oo-light-stone bg-oo-cream/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
              Summary
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
                <p className="text-2xl font-semibold text-oo-charcoal">{summary.totalOrders}</p>
                <p className="text-sm text-oo-stone-gray">Total orders</p>
              </div>
              <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
                <p className="text-2xl font-semibold text-oo-charcoal">
                  {formatMoney(summary.grossSalesCents)}
                </p>
                <p className="text-sm text-oo-stone-gray">Gross sales</p>
              </div>
              <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
                <p className="text-2xl font-semibold text-oo-charcoal">
                  {formatMoney(summary.mennyuRevenueCents)}
                </p>
                <p className="text-sm text-oo-stone-gray">Open Order service fee revenue</p>
              </div>
              <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
                <p className="text-2xl font-semibold text-oo-charcoal">{summary.activeVendors}</p>
                <p className="text-sm text-oo-stone-gray">Active vendors</p>
              </div>
              <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
                <p className="text-2xl font-semibold text-oo-charcoal">{summary.activePods}</p>
                <p className="text-sm text-oo-stone-gray">Active pods</p>
              </div>
              <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
                <p className="text-2xl font-semibold text-oo-charcoal">
                  {formatMoney(summary.averageOrderValueCents)}
                </p>
                <p className="text-sm text-oo-stone-gray">Avg order value</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-oo-light-stone bg-oo-warm-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Revenue breakdown
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-lg font-medium text-oo-charcoal">
                    {formatMoney(summary.serviceFeeRevenueCents)}
                  </p>
                  <p className="text-xs text-oo-stone-gray">Customer service fee (configurable)</p>
                </div>
                <div>
                  <p className="text-lg font-medium text-oo-charcoal">
                    {formatMoney(summary.vendorProcessingRecoveryTotalCents)}
                  </p>
                  <p className="text-xs text-oo-stone-gray">
                    Vendor processing recovery (food subtotal; tips not reduced)
                  </p>
                </div>
                <div>
                  <p className="text-lg font-medium text-oo-charcoal">
                    {formatMoney(summary.revenuePerOrderCents)}
                  </p>
                  <p className="text-xs text-oo-stone-gray">Revenue per order</p>
                </div>
              </div>
            </div>
          </section>

          {/* Volume trends */}
          <section className="rounded-lg border border-oo-light-stone bg-oo-cream/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
              Order volume
            </h2>
            {trends.length === 0 ? (
              <p className="mt-3 text-sm text-oo-stone-gray">No order data in this range.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {trends.map((day) => (
                  <li
                    key={day.date}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-oo-charcoal">{day.label}</span>
                    <span className="text-oo-stone-gray">
                      {day.orderCount} orders · {formatMoney(day.grossSalesCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Top lists */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-oo-light-stone bg-oo-cream/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
                Top vendors
              </h2>
              {topVendors.length === 0 ? (
                <p className="mt-3 text-sm text-oo-stone-gray">No vendor orders in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topVendors.slice(0, 5).map((v) => (
                    <li
                      key={v.vendorId}
                      className="flex justify-between gap-2 rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
                    >
                      <span className="truncate text-oo-charcoal">{v.vendorName}</span>
                      <span className="shrink-0 font-medium tabular-nums text-oo-charcoal">
                        {v.orderCount} orders
                        {v.revenueCents > 0 && ` · ${formatMoney(v.revenueCents)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-lg border border-oo-light-stone bg-oo-cream/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
                Top pods
              </h2>
              {topPods.length === 0 ? (
                <p className="mt-3 text-sm text-oo-stone-gray">No orders in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topPods.slice(0, 5).map((p) => (
                    <li
                      key={p.podId}
                      className="flex justify-between gap-2 rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
                    >
                      <span className="truncate text-oo-charcoal">{p.podName}</span>
                      <span className="shrink-0 font-medium tabular-nums text-oo-charcoal">
                        {p.orderCount} orders
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-lg border border-oo-light-stone bg-oo-cream/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
                Top items
              </h2>
              {topItems.length === 0 ? (
                <p className="mt-3 text-sm text-oo-stone-gray">No line items in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topItems.slice(0, 5).map((item, i) => (
                    <li
                      key={`${item.name}-${i}`}
                      className="flex justify-between gap-2 rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
                    >
                      <span className="truncate text-oo-charcoal">{item.name}</span>
                      <span className="shrink-0 font-medium tabular-nums text-oo-charcoal">
                        {item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Operations health */}
          <section className="rounded-lg border border-oo-light-stone bg-oo-cream/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
              Operations health
            </h2>
            <p className="mt-1 text-xs text-oo-stone-gray">
              Reliability and operational indicators for the selected range (except open issues).
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex justify-between rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm">
                <span className="text-oo-charcoal">Routing failures</span>
                <span className="font-medium tabular-nums text-oo-charcoal">
                  {health.routingFailures}
                </span>
              </li>
              <li className="flex justify-between rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm">
                <span className="text-oo-charcoal">Manual recoveries</span>
                <span className="font-medium tabular-nums text-oo-charcoal">
                  {health.manualRecoveries}
                </span>
              </li>
              <li className="flex justify-between rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm">
                <span className="text-oo-charcoal">Cancelled vendor orders</span>
                <span className="font-medium tabular-nums text-oo-charcoal">
                  {health.cancelledVendorOrders}
                </span>
              </li>
              <li className="flex justify-between rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm">
                <span className="text-oo-charcoal">Open order issues</span>
                <span className="font-medium tabular-nums text-oo-charcoal">
                  {health.openOrderIssues}
                </span>
              </li>
              <li className="flex justify-between rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm">
                <span className="text-oo-charcoal">Open vendor order issues</span>
                <span className="font-medium tabular-nums text-oo-charcoal">
                  {health.openVendorOrderIssues}
                </span>
              </li>
              <li className="flex justify-between rounded border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm">
                <span className="text-oo-charcoal">Completion rate</span>
                <span className="font-medium tabular-nums text-oo-charcoal">
                  {health.completionRatePercent}%
                </span>
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
