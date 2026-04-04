import Link from "next/link";
import { Prisma, VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DELIVERECT_RECONCILIATION_STALE_MINUTES,
  ROUTING_STUCK_THRESHOLD_MINUTES,
} from "@/lib/admin-exceptions";

const RECENT_HOURS = 24;

export default async function AdminOverviewPage() {
  const since = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
  const routingStuckBefore = new Date(
    Date.now() - ROUTING_STUCK_THRESHOLD_MINUTES * 60 * 1000
  );
  const reconciliationStaleBefore = new Date(
    Date.now() - DELIVERECT_RECONCILIATION_STALE_MINUTES * 60 * 1000
  );
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const deliverectChannelOr = {
    OR: [{ deliverectChannelLinkId: { not: null } }, { vendor: { deliverectChannelLinkId: { not: null } } }],
  };

  const [
    ordersToday,
    failedRoutingCount,
    stuckRoutingCount,
    cancelledTodayCount,
    activeVendors,
    activePods,
    deliverectAwaitingPos,
    deliverectRecoOverdue,
    deliverectAutoNoMatch24h,
    deliverectAutoAmbiguous24h,
    deliverectManualRecovery24h,
    deliverectRecoLate24h,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.vendorOrder.count({
      where: { routingStatus: VendorRoutingStatus.failed, fulfillmentStatus: VendorFulfillmentStatus.pending },
    }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: VendorRoutingStatus.pending,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        createdAt: { lt: routingStuckBefore },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        fulfillmentStatus: VendorFulfillmentStatus.cancelled,
        updatedAt: { gte: startOfToday },
      },
    }),
    prisma.vendor.count({ where: { isActive: true } }),
    prisma.pod.count({ where: { isActive: true } }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: VendorRoutingStatus.sent,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        lastExternalStatusAt: null,
        manuallyRecoveredAt: null,
        deliverectSubmittedAt: { not: null, gte: reconciliationStaleBefore },
        ...deliverectChannelOr,
      },
    }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: VendorRoutingStatus.sent,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        lastExternalStatusAt: null,
        manuallyRecoveredAt: null,
        deliverectSubmittedAt: { not: null, lt: reconciliationStaleBefore },
        ...deliverectChannelOr,
      },
    }),
    prisma.vendorOrder.count({
      where: {
        deliverectAutoRecheckResult: "no_match",
        updatedAt: { gte: since },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        deliverectAutoRecheckResult: "ambiguous",
        updatedAt: { gte: since },
      },
    }),
    prisma.vendorOrder.count({
      where: { manuallyRecoveredAt: { gte: since, not: null } },
    }),
    prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM "VendorOrder"
        WHERE "lastExternalStatusAt" >= ${since}
          AND "deliverectSubmittedAt" IS NOT NULL
          AND "lastExternalStatusAt" IS NOT NULL
          AND EXTRACT(EPOCH FROM ("lastExternalStatusAt" - "deliverectSubmittedAt")) >= ${DELIVERECT_RECONCILIATION_STALE_MINUTES * 60}
      `
    ),
  ]);

  const needsAttentionCount = failedRoutingCount + stuckRoutingCount;
  const recoLateCount = Number(deliverectRecoLate24h[0]?.c ?? BigInt(0));

  const cards = [
    { label: "Orders today", value: ordersToday, href: "/admin/orders", desc: "Inspect and manage" },
    {
      label: "Needs attention",
      value: needsAttentionCount,
      href: "/admin/exceptions",
      sub:
        needsAttentionCount > 0
          ? `${failedRoutingCount} failed, ${stuckRoutingCount} stuck`
          : undefined,
      desc: "Resolve broken orders",
    },
    {
      label: "Cancelled today",
      value: cancelledTodayCount,
      href: "/admin/orders",
      desc: cancelledTodayCount > 0 ? "Vendor orders · Refund review may be needed" : "Vendor orders",
    },
    { label: "Active vendors", value: activeVendors, href: "/admin/vendors", desc: "Marketplace" },
    { label: "Active pods", value: activePods, href: "/admin/pods", desc: "Marketplace" },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Overview</h1>
      <p className="mt-1 text-sm text-stone-600">
        Counts and shortcuts — open an order only from Orders or Exceptions for full controls.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm hover:border-stone-300"
          >
            <p className="text-sm text-stone-600">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold text-stone-900">{c.value}</p>
            {c.sub && <p className="mt-1 text-xs text-amber-700">{c.sub}</p>}
            {c.desc && <p className="mt-0.5 text-xs text-stone-400">{c.desc}</p>}
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-900">Deliverect triage (last {RECENT_HOURS}h)</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Snapshot counts — same reconciliation window ({DELIVERECT_RECONCILIATION_STALE_MINUTES} min) as ops tooling.
        </p>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5">
            <dt className="text-stone-500">Awaiting POS (in window)</dt>
            <dd className="font-semibold text-stone-900">{deliverectAwaitingPos}</dd>
          </div>
          <div className="rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5">
            <dt className="text-stone-500">Reconciliation overdue</dt>
            <dd className="font-semibold text-amber-900">{deliverectRecoOverdue}</dd>
          </div>
          <div className="rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5">
            <dt className="text-stone-500">Auto re-check · no match</dt>
            <dd className="font-semibold text-stone-900">{deliverectAutoNoMatch24h}</dd>
          </div>
          <div className="rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5">
            <dt className="text-stone-500">Auto re-check · ambiguous</dt>
            <dd className="font-semibold text-stone-900">{deliverectAutoAmbiguous24h}</dd>
          </div>
          <div className="rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5">
            <dt className="text-stone-500">Reconciled late (first signal)</dt>
            <dd className="font-semibold text-stone-900">{recoLateCount}</dd>
          </div>
          <div className="rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5">
            <dt className="text-stone-500">Manual recovery recorded</dt>
            <dd className="font-semibold text-stone-900">{deliverectManualRecovery24h}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[10px] text-stone-400">
          “Reconciled late” = first external status at or after the overdue threshold from submit, updated in the last{" "}
          {RECENT_HOURS}h.
        </p>
      </section>
    </div>
  );
}
