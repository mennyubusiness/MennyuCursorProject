import Link from "next/link";
import { VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ROUTING_STUCK_THRESHOLD_MINUTES } from "@/lib/admin-exceptions";

const quickActions = [
  { label: "View orders", href: "/admin/orders", hint: "Search and filter" },
  { label: "Issues", href: "/admin/exceptions", hint: "Routing and fulfillment queue" },
  { label: "Vendors", href: "/admin/vendors", hint: "Marketplace" },
  { label: "Pods", href: "/admin/pods", hint: "Locations" },
  { label: "Vendor Transfers", href: "/admin/payout-transfers", hint: "Connect transfers to vendors" },
] as const;

export default async function AdminDashboardPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const routingStuckBefore = new Date(Date.now() - ROUTING_STUCK_THRESHOLD_MINUTES * 60 * 1000);

  const [ordersToday, failedRoutingCount, stuckRoutingCount, activeVendors] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
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
    prisma.vendor.count({ where: { isActive: true } }),
  ]);

  const issuesCount = failedRoutingCount + stuckRoutingCount;
  const showIssuesAlert = issuesCount > 0;

  return (
    <div className="space-y-12">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">Dashboard</h1>
        <p className="mt-2 text-sm leading-relaxed text-oo-stone-gray">
          Jump to the area you need — detailed metrics and debugging tools live under Operations and Settings.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-oo-stone-gray">Quick actions</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="flex min-h-[4.5rem] flex-col justify-between rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm transition-colors hover:border-oo-light-stone hover:bg-oo-cream/80"
              >
                <span className="font-medium text-oo-charcoal">{a.label}</span>
                <span className="mt-1 flex items-center justify-between text-xs text-oo-stone-gray">
                  {a.hint}
                  <span aria-hidden className="text-oo-stone-gray">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {showIssuesAlert && (
        <section
          className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">
            {issuesCount} order{issuesCount === 1 ? "" : "s"} need attention in the issues queue.
          </p>
          <p className="mt-1 text-amber-900/90">
            <Link href="/admin/exceptions" className="font-medium underline underline-offset-2 hover:text-amber-950">
              Open issues
            </Link>{" "}
            to resolve routing failures and stuck vendor orders.
          </p>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-oo-stone-gray">Today</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/admin/orders?today=1"
            className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm transition-colors hover:border-oo-light-stone hover:bg-oo-cream/80"
          >
            <p className="text-sm text-oo-stone-gray">Orders today</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-oo-charcoal">{ordersToday}</p>
            <p className="mt-3 text-xs text-oo-stone-gray">Tap to filter the orders list by today</p>
          </Link>
          <Link
            href="/admin/exceptions"
            className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm transition-colors hover:border-oo-light-stone hover:bg-oo-cream/80"
          >
            <p className="text-sm text-oo-stone-gray">Issues</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-oo-charcoal">{issuesCount}</p>
            <p className="mt-3 text-xs text-oo-stone-gray">Failed routing + stuck pending</p>
          </Link>
          <Link
            href="/admin/vendors"
            className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm transition-colors hover:border-oo-light-stone hover:bg-oo-cream/80"
          >
            <p className="text-sm text-oo-stone-gray">Active vendors</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-oo-charcoal">{activeVendors}</p>
            <p className="mt-3 text-xs text-oo-stone-gray">Marketplace</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
