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
          ? "rounded bg-[#FFBD59] px-3 py-1.5 text-sm font-medium text-black"
          : "rounded border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
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
        <h1 className="text-xl font-semibold text-stone-900">Analytics</h1>
        <p className="mt-1 text-sm text-stone-500">
          Platform-wide order and operations overview
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Date range
        </span>
        <RangeLink current={range} value="today" label="Today" />
        <RangeLink current={range} value="7d" label="Last 7 days" />
        <RangeLink current={range} value="30d" label="Last 30 days" />
      </div>

      {!hasAnyData && summary.totalOrders === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50/50 px-6 py-10 text-center">
          <p className="font-medium text-stone-700">No analytics available for this range yet</p>
          <p className="mt-1 text-sm text-stone-500">
            Orders and operations in the selected period will appear here.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
              Summary
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-2xl font-semibold text-stone-900">{summary.totalOrders}</p>
                <p className="text-sm text-stone-600">Total orders</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-2xl font-semibold text-stone-900">
                  {formatMoney(summary.grossSalesCents)}
                </p>
                <p className="text-sm text-stone-600">Gross sales</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-2xl font-semibold text-stone-900">
                  {formatMoney(summary.mennyuRevenueCents)}
                </p>
                <p className="text-sm text-stone-600">Mennyu service fee revenue</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-2xl font-semibold text-stone-900">{summary.activeVendors}</p>
                <p className="text-sm text-stone-600">Active vendors</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-2xl font-semibold text-stone-900">{summary.activePods}</p>
                <p className="text-sm text-stone-600">Active pods</p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-4">
                <p className="text-2xl font-semibold text-stone-900">
                  {formatMoney(summary.averageOrderValueCents)}
                </p>
                <p className="text-sm text-stone-600">Avg order value</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Revenue breakdown
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-lg font-medium text-stone-900">
                    {formatMoney(summary.serviceFeeRevenueCents)}
                  </p>
                  <p className="text-xs text-stone-600">Customer service fee (configurable)</p>
                </div>
                <div>
                  <p className="text-lg font-medium text-stone-900">
                    {formatMoney(summary.vendorProcessingRecoveryTotalCents)}
                  </p>
                  <p className="text-xs text-stone-600">
                    Vendor processing recovery (food subtotal; tips not reduced)
                  </p>
                </div>
                <div>
                  <p className="text-lg font-medium text-stone-900">
                    {formatMoney(summary.revenuePerOrderCents)}
                  </p>
                  <p className="text-xs text-stone-600">Revenue per order</p>
                </div>
              </div>
            </div>
          </section>

          {/* Volume trends */}
          <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
              Order volume
            </h2>
            {trends.length === 0 ? (
              <p className="mt-3 text-sm text-stone-500">No order data in this range.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {trends.map((day) => (
                  <li
                    key={day.date}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-100 bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-stone-700">{day.label}</span>
                    <span className="text-stone-600">
                      {day.orderCount} orders · {formatMoney(day.grossSalesCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Top lists */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                Top vendors
              </h2>
              {topVendors.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">No vendor orders in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topVendors.slice(0, 5).map((v) => (
                    <li
                      key={v.vendorId}
                      className="flex justify-between gap-2 rounded border border-stone-100 bg-white px-3 py-2 text-sm"
                    >
                      <span className="truncate text-stone-800">{v.vendorName}</span>
                      <span className="shrink-0 font-medium tabular-nums text-stone-700">
                        {v.orderCount} orders
                        {v.revenueCents > 0 && ` · ${formatMoney(v.revenueCents)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                Top pods
              </h2>
              {topPods.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">No orders in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topPods.slice(0, 5).map((p) => (
                    <li
                      key={p.podId}
                      className="flex justify-between gap-2 rounded border border-stone-100 bg-white px-3 py-2 text-sm"
                    >
                      <span className="truncate text-stone-800">{p.podName}</span>
                      <span className="shrink-0 font-medium tabular-nums text-stone-700">
                        {p.orderCount} orders
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
                Top items
              </h2>
              {topItems.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">No line items in this range.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {topItems.slice(0, 5).map((item, i) => (
                    <li
                      key={`${item.name}-${i}`}
                      className="flex justify-between gap-2 rounded border border-stone-100 bg-white px-3 py-2 text-sm"
                    >
                      <span className="truncate text-stone-800">{item.name}</span>
                      <span className="shrink-0 font-medium tabular-nums text-stone-700">
                        {item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Operations health */}
          <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
              Operations health
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Reliability and operational indicators for the selected range (except open issues).
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
                <span className="text-stone-700">Routing failures</span>
                <span className="font-medium tabular-nums text-stone-900">
                  {health.routingFailures}
                </span>
              </li>
              <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
                <span className="text-stone-700">Manual recoveries</span>
                <span className="font-medium tabular-nums text-stone-900">
                  {health.manualRecoveries}
                </span>
              </li>
              <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
                <span className="text-stone-700">Cancelled vendor orders</span>
                <span className="font-medium tabular-nums text-stone-900">
                  {health.cancelledVendorOrders}
                </span>
              </li>
              <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
                <span className="text-stone-700">Open order issues</span>
                <span className="font-medium tabular-nums text-stone-900">
                  {health.openOrderIssues}
                </span>
              </li>
              <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
                <span className="text-stone-700">Open vendor order issues</span>
                <span className="font-medium tabular-nums text-stone-900">
                  {health.openVendorOrderIssues}
                </span>
              </li>
              <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
                <span className="text-stone-700">Completion rate</span>
                <span className="font-medium tabular-nums text-stone-900">
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
