import Link from "next/link";
import { prisma } from "@/lib/db";
import { ROUTING_STUCK_THRESHOLD_MINUTES } from "@/lib/admin-exceptions";

const RECENT_HOURS = 24;

export default async function AdminOverviewPage() {
  const since = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
  const routingStuckBefore = new Date(
    Date.now() - ROUTING_STUCK_THRESHOLD_MINUTES * 60 * 1000
  );
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    ordersToday,
    failedRoutingCount,
    stuckRoutingCount,
    cancelledTodayCount,
    activeVendors,
    activePods,
    vendorOrdersNeedingAttention,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.vendorOrder.count({
      where: { routingStatus: "failed", fulfillmentStatus: "pending" },
    }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: "pending",
        fulfillmentStatus: "pending",
        createdAt: { lt: routingStuckBefore },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        fulfillmentStatus: "cancelled",
        updatedAt: { gte: startOfToday },
      },
    }),
    prisma.vendor.count({ where: { isActive: true } }),
    prisma.pod.count({ where: { isActive: true } }),
    prisma.vendorOrder.findMany({
      where: {
        fulfillmentStatus: "pending",
        OR: [
          { routingStatus: "failed" },
          {
            routingStatus: "pending",
            createdAt: { lt: routingStuckBefore },
          },
        ],
      },
      select: { vendorId: true, vendor: { select: { name: true } } },
      take: 500,
    }),
  ]);

  const needsAttentionCount = failedRoutingCount + stuckRoutingCount;
  const vendorIssueCounts = vendorOrdersNeedingAttention.reduce(
    (acc, vo) => {
      acc[vo.vendorId] = { name: vo.vendor.name, count: (acc[vo.vendorId]?.count ?? 0) + 1 };
      return acc;
    },
    {} as Record<string, { name: string; count: number }>
  );
  const vendorsWithIssues = Object.entries(vendorIssueCounts).map(([id, v]) => ({ vendorId: id, ...v }));

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
      <h1 className="text-xl font-semibold text-stone-900">What needs attention now?</h1>
      <p className="mt-1 text-sm text-stone-600">
        Triage board — use the links below to jump to the right workspace.
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

      {vendorsWithIssues.length > 0 && (
        <section className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-medium text-stone-700">Vendors with active issues</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            {vendorsWithIssues.length} vendor{vendorsWithIssues.length !== 1 ? "s" : ""} with orders in Needs Attention
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {vendorsWithIssues.map((v) => (
              <li key={v.vendorId} className="flex justify-between">
                <span className="text-stone-800">{v.name}</span>
                <span className="font-medium text-amber-700">{v.count}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/exceptions" className="mt-2 inline-block text-xs text-stone-600 hover:underline">
            View Needs Attention →
          </Link>
        </section>
      )}
    </div>
  );
}
