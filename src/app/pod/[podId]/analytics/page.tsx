import { notFound } from "next/navigation";
import { getPodAnalytics } from "@/services/pod-analytics.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function PodAnalyticsPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  const data = await getPodAnalytics(podId);
  if (!data) notFound();

  const { podName, summary, trends, participation, health } = data;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <h1 className="text-xl font-semibold text-stone-900">Pod analytics</h1>
      <p className="text-stone-600">{podName}</p>
      <p className="text-xs text-stone-500">
        This page shows pod-level aggregates and health indicators. Vendor financial details are not shown.
      </p>

      {/* Pod Summary */}
      <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Pod summary
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold text-stone-900">{summary.activeVendors}</p>
            <p className="text-sm text-stone-600">Active vendors</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold text-stone-900">{summary.ordersToday}</p>
            <p className="text-sm text-stone-600">Orders today</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold text-stone-900">{summary.ordersLast7}</p>
            <p className="text-sm text-stone-600">Orders last 7 days</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold text-stone-900">
              {formatMoney(summary.grossSalesTodayCents)}
            </p>
            <p className="text-sm text-stone-600">Sales today</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold text-stone-900">
              {formatMoney(summary.grossSalesLast7Cents)}
            </p>
            <p className="text-sm text-stone-600">Sales last 7 days</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <p className="text-2xl font-semibold text-stone-900">
              {formatMoney(summary.avgOrderValueCents)}
            </p>
            <p className="text-sm text-stone-600">Avg order</p>
          </div>
        </div>
      </section>

      {/* Activity / Trends */}
      <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Activity (last 7 days)
        </h2>
        <p className="mt-1 text-xs text-stone-500">Aggregated pod-level metrics only.</p>
        <ul className="mt-3 space-y-2">
          {trends.map((day) => (
            <li
              key={day.date}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-100 bg-white px-3 py-2 text-sm"
            >
              <span className="font-medium text-stone-700">{day.label}</span>
              <span className="text-stone-600">
                {day.orderCount} orders · {formatMoney(day.revenueCents)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Vendor Participation Overview */}
      <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Vendor participation overview
        </h2>
        <p className="mt-1 text-xs text-stone-500">Counts only; no per-vendor performance.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-lg font-semibold text-stone-900">{participation.vendorsInPod}</p>
            <p className="text-xs text-stone-600">Vendors in pod</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-lg font-semibold text-stone-900">
              {participation.vendorsWithOrderToday}
            </p>
            <p className="text-xs text-stone-600">Vendors with orders today</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-lg font-semibold text-stone-900">
              {participation.vendorsWithOrderLast7}
            </p>
            <p className="text-xs text-stone-600">Vendors with orders (last 7 days)</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-lg font-semibold text-stone-900">{participation.vendorsActiveMennyu}</p>
            <p className="text-xs text-stone-600">Active on Mennyu</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-lg font-semibold text-stone-900">{participation.vendorsPausedMennyu}</p>
            <p className="text-xs text-stone-600">Paused (Mennyu)</p>
          </div>
        </div>
      </section>

      {/* Pod Health */}
      <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Pod health
        </h2>
        <p className="mt-1 text-xs text-stone-500">Operational indicators; no detailed incident data.</p>
        <ul className="mt-4 space-y-2">
          <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
            <span className="text-stone-700">Needs attention</span>
            <span className="font-medium tabular-nums">{health.needsAttentionCount}</span>
          </li>
          <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
            <span className="text-stone-700">Routing issues today</span>
            <span className="font-medium tabular-nums">{health.routingIssuesToday}</span>
          </li>
          <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
            <span className="text-stone-700">Manual recoveries today</span>
            <span className="font-medium tabular-nums">{health.manualRecoveriesToday}</span>
          </li>
          <li className="flex justify-between rounded border border-stone-100 bg-white px-3 py-2 text-sm">
            <span className="text-stone-700">Cancelled vendor orders today</span>
            <span className="font-medium tabular-nums">{health.cancelledToday}</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
