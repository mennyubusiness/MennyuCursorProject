import Link from "next/link";
import { VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";
import {
  DashboardCard,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
  DashboardStatusBadge,
} from "@/components/dashboard";
import { prisma } from "@/lib/db";
import { ROUTING_STUCK_THRESHOLD_MINUTES } from "@/lib/admin-exceptions";

const QUICK_LINK_GROUPS = [
  {
    title: "Orders & issues",
    links: [
      { label: "View orders", href: "/admin/orders", hint: "Search and filter" },
      { label: "Order issues", href: "/admin/exceptions", hint: "Routing and fulfillment queue" },
    ],
  },
  {
    title: "Marketplace",
    links: [
      { label: "Vendors", href: "/admin/vendors", hint: "Marketplace setup" },
      { label: "Pods", href: "/admin/pods", hint: "Locations and QR" },
    ],
  },
  {
    title: "Operations",
    links: [
      { label: "System health", href: "/admin/health", hint: "Operational health dashboard" },
      { label: "Incidents", href: "/admin/incidents", hint: "Triage queue" },
      { label: "Notifications", href: "/admin/notifications", hint: "SMS log visibility" },
      { label: "Webhooks", href: "/admin/webhooks", hint: "Stripe & Deliverect health" },
      {
        label: "Vendor transfers",
        href: "/admin/payout-transfers",
        hint: "Connect transfers to vendors",
      },
      { label: "POS sync", href: "/admin/deliverect-webhook-incidents", hint: "Webhook incidents" },
      { label: "POS connections", href: "/admin/deliverect-connections", hint: "Deliverect channel links" },
    ],
  },
  {
    title: "Settings",
    links: [
      { label: "Platform pricing", href: "/admin/pricing", hint: "Fees and platform settings" },
      { label: "Analytics", href: "/admin/analytics", hint: "Platform metrics" },
    ],
  },
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
    <DashboardShell tier="admin" className="space-y-10 lg:space-y-12">
      <DashboardPageHeader
        headingLevel={1}
        title="Admin"
        description="Monitor Open Order operations, marketplace setup, and support workflows."
        status={
          showIssuesAlert ? (
            <DashboardStatusBadge tone="warning">
              {issuesCount} order issue{issuesCount === 1 ? "" : "s"}
            </DashboardStatusBadge>
          ) : undefined
        }
      />

      <DashboardSection title="Today" showHeader>
        <DashboardMetricGrid columns="three">
          <Link href="/admin/orders?today=1" className="block min-w-0">
            <DashboardMetricCard
              label="Orders today"
              value={ordersToday}
              helper="Filter the orders list by today"
            />
          </Link>
          <Link href="/admin/exceptions" className="block min-w-0">
            <DashboardMetricCard
              label="Order issues"
              value={issuesCount}
              helper="Routing failures and stuck orders"
              tone={issuesCount > 0 ? "warning" : "default"}
            />
          </Link>
          <Link href="/admin/vendors" className="block min-w-0">
            <DashboardMetricCard
              label="Active vendors"
              value={activeVendors}
              helper="On the marketplace"
            />
          </Link>
        </DashboardMetricGrid>
      </DashboardSection>

      {showIssuesAlert ? (
        <DashboardCard variant="warning" title="Needs attention">
          <p className="text-sm text-amber-950">
            {issuesCount} order{issuesCount === 1 ? "" : "s"} need attention in the order issues queue.
          </p>
          <p className="mt-2 text-sm text-amber-900/90">
            <Link
              href="/admin/exceptions"
              className="font-medium underline underline-offset-2 hover:text-amber-950"
            >
              Open order issues
            </Link>{" "}
            to resolve routing failures and stuck vendor orders.
          </p>
        </DashboardCard>
      ) : null}

      {QUICK_LINK_GROUPS.map((group) => (
        <DashboardSection key={group.title} title={group.title}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="block h-full">
                  <DashboardCard className="h-full transition-colors hover:border-oo-light-stone hover:bg-oo-cream/80">
                    <p className="font-medium text-oo-charcoal">{link.label}</p>
                    <p className="mt-1 flex items-center justify-between text-xs text-oo-stone-gray">
                      {link.hint}
                      <span aria-hidden>→</span>
                    </p>
                  </DashboardCard>
                </Link>
              </li>
            ))}
          </ul>
        </DashboardSection>
      ))}
    </DashboardShell>
  );
}
