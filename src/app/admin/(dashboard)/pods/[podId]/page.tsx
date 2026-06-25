import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import {
  adminPodReadinessLabel,
  adminPodVendorStatusLabel,
  deriveAdminPodDetailLayout,
} from "@/lib/admin-pod-detail-layout";
import { listRecentPodPayoutAllocationsForAdmin } from "@/services/pod-payout-allocation.service";
import { getPodPayoutRecipientConnectStatusForPod } from "@/services/pod-payout-connect.service";
import {
  getPodPayoutAllocationSummary,
  getPodPayoutRecipientOptions,
  getPodPayoutSettingsForAdmin,
} from "@/services/pod-payout-settings.service";
import {
  getPodPayoutTransferAdminSummary,
  listRecentPodPayoutTransfersForAdmin,
} from "@/services/pod-payout-transfer.service";
import { AdminPodToggle } from "../AdminPodToggle";
import { AdminPodPayoutSection } from "./AdminPodPayoutSection";

export default async function AdminPodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ podId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { podId } = await params;
  const { section } = await searchParams;
  const id = podId?.trim();
  if (!id) notFound();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const pod = await prisma.pod.findUnique({
    where: { id },
    include: {
      vendors: {
        include: {
          vendor: { select: { id: true, name: true, slug: true, isActive: true } },
        },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!pod) notFound();

  const [ordersAllTime, ordersToday, lastOrderAgg, payoutSettings, allocationSummary, recipientOptions, allocations, recipientConnect, transferSummary, transfers] =
    await Promise.all([
      prisma.order.count({ where: { podId: id } }),
      prisma.order.count({ where: { podId: id, createdAt: { gte: startOfToday } } }),
      prisma.order.aggregate({
        where: { podId: id },
        _max: { createdAt: true },
      }),
      getPodPayoutSettingsForAdmin(id),
      getPodPayoutAllocationSummary(id),
      getPodPayoutRecipientOptions(id),
      listRecentPodPayoutAllocationsForAdmin(id),
      getPodPayoutRecipientConnectStatusForPod(id),
      getPodPayoutTransferAdminSummary(id),
      listRecentPodPayoutTransfersForAdmin(id),
    ]);

  const lastOrderAt = lastOrderAgg._max.createdAt;
  const activeVendorCount = pod.vendors.filter((pv) => pv.isActive && pv.vendor.isActive).length;
  const needsReviewCount = allocationSummary.blocked.count + allocationSummary.blockedPartialRefundReview.count;
  const failedTransferCount = transfers.filter((row) => row.status === "failed").length;
  const payoutLayout = deriveAdminPodDetailLayout({
    podPayoutsEnabled: payoutSettings?.podPayoutsEnabled ?? false,
    podPayoutRecipientUserId: payoutSettings?.podPayoutRecipientUserId ?? null,
    recipientConnectStatus: recipientConnect,
    allocationSummary,
    transferSummary,
    allocationCount: allocations.length,
    transferCount: transfers.length,
    failedTransferCount,
    expandedByDefault: section === "payouts",
  });

  const readinessLabel = adminPodReadinessLabel(pod.onboardingStatus, pod.isActive);
  const publicPodPath = buildPodCustomerPath(pod.slug);

  return (
    <div className="space-y-8">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/pods" className="hover:text-oo-charcoal hover:underline">
          Pods
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">{pod.name}</span>
      </nav>

      <header className="flex flex-col gap-4 border-b border-oo-light-stone pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">{pod.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                pod.isActive ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-oo-charcoal"
              }`}
            >
              {pod.isActive ? "Active" : "Inactive"}
            </span>
            {readinessLabel !== "Ready" || !pod.isActive ? (
              <span className="inline-flex items-center rounded-full bg-oo-cream px-2.5 py-0.5 text-xs font-medium text-oo-charcoal">
                {readinessLabel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminPodToggle podId={pod.id} isActive={pod.isActive} variant="compact" />
        </div>
      </header>

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-oo-charcoal">Activity</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-sm text-oo-stone-gray">Orders today</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">{ordersToday}</dd>
          </div>
          <div>
            <dt className="text-sm text-oo-stone-gray">Orders all time</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">{ordersAllTime}</dd>
          </div>
          <div>
            <dt className="text-sm text-oo-stone-gray">Last order</dt>
            <dd className="mt-1 text-sm font-medium text-oo-charcoal">
              {lastOrderAt
                ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(lastOrderAt)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-oo-stone-gray">Active vendors</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">{activeVendorCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-oo-stone-gray">Needs review</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">{needsReviewCount}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-oo-stone-gray">Orders today use the server&apos;s local calendar day.</p>
      </section>

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-oo-charcoal">Admin actions</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <Link
              href={`/pod/${pod.id}/dashboard`}
              className="flex flex-col rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">Pod dashboard</span>
              <span className="mt-1 text-sm text-oo-stone-gray">Operator tools for this pod</span>
            </Link>
          </li>
          <li>
            <Link
              href={publicPodPath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">Operator view</span>
              <span className="mt-1 text-sm text-oo-stone-gray">Public kiosk ordering page</span>
            </Link>
          </li>
          <li>
            <Link
              href={`/admin/pods/${pod.id}/qr`}
              className="flex flex-col rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">QR code</span>
              <span className="mt-1 text-sm text-oo-stone-gray">On-site ordering QR setup</span>
            </Link>
          </li>
          <li>
            <Link
              href={`/admin/orders?pod=${encodeURIComponent(pod.id)}`}
              className="flex flex-col rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">Vendor orders</span>
              <span className="mt-1 text-sm text-oo-stone-gray">Orders for this pod</span>
            </Link>
          </li>
          <li>
            <Link
              href={`/pod/${pod.id}/settings`}
              className="flex flex-col rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">Edit pod settings</span>
              <span className="mt-1 text-sm text-oo-stone-gray">Profile, hours, and payout setup</span>
            </Link>
          </li>
          <li>
            <Link
              href={publicPodPath}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">Public pod page</span>
              <span className="mt-1 text-sm text-oo-stone-gray">Customer-facing pod URL</span>
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-oo-charcoal">Vendors</h2>
        {pod.vendors.length === 0 ? (
          <p className="mt-3 text-sm text-oo-stone-gray">No vendors linked to this pod.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-oo-light-stone bg-oo-cream text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Vendor</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Readiness</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pod.vendors.map((pv) => {
                  const statusLabel = adminPodVendorStatusLabel({
                    vendorGloballyActive: pv.vendor.isActive,
                    podVendorActive: pv.isActive,
                  });
                  const readinessLabel =
                    statusLabel === "Active"
                      ? pv.isFeatured
                        ? "Featured"
                        : "Active"
                      : statusLabel === "Paused in pod"
                        ? "Paused in pod"
                        : "Not orderable";

                  return (
                    <tr key={pv.id} className="border-b border-oo-light-stone last:border-b-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/vendors/${pv.vendor.id}`}
                          className="font-medium text-sky-800 hover:underline"
                        >
                          {pv.vendor.name}
                        </Link>
                        <p className="font-mono text-xs text-oo-stone-gray">{pv.vendor.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-oo-charcoal">{statusLabel}</td>
                      <td className="px-4 py-3 text-oo-charcoal">{readinessLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-3">
                          <Link
                            href={`/vendor/${pv.vendor.id}/orders`}
                            className="text-sm text-oo-charcoal underline hover:text-oo-charcoal"
                          >
                            Vendor orders
                          </Link>
                          <Link
                            href={`/admin/vendors/${pv.vendor.id}`}
                            className="text-sm text-oo-charcoal underline hover:text-oo-charcoal"
                          >
                            View vendor
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(pod.address || pod.pickupTimezone) && (
        <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-5">
          <h2 className="text-sm font-semibold text-oo-charcoal">Location &amp; schedule</h2>
          <dl className="mt-3 space-y-2 text-sm text-oo-charcoal">
            {pod.address && (
              <div>
                <dt className="text-oo-stone-gray">Address</dt>
                <dd>{pod.address}</dd>
              </div>
            )}
            {pod.pickupTimezone && (
              <div>
                <dt className="text-oo-stone-gray">Pickup timezone</dt>
                <dd className="font-mono text-xs">{pod.pickupTimezone}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <AdminPodPayoutSection
        podId={id}
        layout={payoutLayout}
        settings={payoutSettings}
        recipientOptions={recipientOptions}
        allocationSummary={allocationSummary}
        recipientConnectStatus={recipientConnect}
        transferSummary={transferSummary}
        transfers={transfers}
        allocations={allocations}
      />
    </div>
  );
}
