import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { listRecentPodPayoutAllocationsForAdmin } from "@/services/pod-payout-allocation.service";
import { getPodPayoutRecipientConnectStatusForPod } from "@/services/pod-payout-connect.service";
import {
  getPodPayoutAllocationSummary,
  getPodPayoutRecipientOptions,
  getPodPayoutSettingsForAdmin,
} from "@/services/pod-payout-settings.service";
import { AdminPodToggle } from "../AdminPodToggle";
import { PodPayoutAllocationsCard } from "./PodPayoutAllocationsCard";
import { PodPayoutSettingsCard } from "./PodPayoutSettingsCard";

export default async function AdminPodDetailPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
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

  const [ordersAllTime, ordersToday, lastOrderAgg, payoutSettings, allocationSummary, recipientOptions, allocations, recipientConnect] =
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
    ]);

  const lastOrderAt = lastOrderAgg._max.createdAt;

  return (
    <div className="space-y-10">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/pods" className="hover:text-oo-charcoal hover:underline">
          Pods
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">{pod.name}</span>
      </nav>

      <header className="flex flex-col gap-4 border-b border-oo-light-stone pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">{pod.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                pod.isActive ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-oo-charcoal"
              }`}
            >
              {pod.isActive ? "Active" : "Paused"}
            </span>
            <span className="inline-flex items-center rounded-full bg-oo-cream px-2.5 py-0.5 text-xs font-medium text-oo-charcoal">
              {pod.onboardingStatus}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminPodToggle podId={pod.id} isActive={pod.isActive} variant="compact" />
        </div>
      </header>

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Activity</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-oo-stone-gray">Orders today</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-oo-charcoal">{ordersToday}</dd>
            <p className="mt-0.5 text-xs text-oo-stone-gray">Local calendar day (server timezone).</p>
          </div>
          <div>
            <dt className="text-sm text-oo-stone-gray">Orders (all time)</dt>
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
        </dl>
      </section>

      <PodPayoutSettingsCard
        podId={id}
        settings={payoutSettings}
        recipientOptions={recipientOptions}
        allocationSummary={allocationSummary}
        recipientConnectStatus={recipientConnect}
      />

      <PodPayoutAllocationsCard podId={id} allocations={allocations} />

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Quick links</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href={`/pod/${pod.id}/dashboard`}
              className="flex flex-col rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4 transition-colors hover:border-oo-light-stone hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">Pod dashboard</span>
              <span className="mt-1 text-sm text-oo-stone-gray">Operator view for this kiosk</span>
            </Link>
          </li>
          <li>
            <Link
              href={`/admin/pods/${pod.id}/qr`}
              className="flex flex-col rounded-lg border border-oo-light-stone bg-oo-cream/80 p-4 transition-colors hover:border-oo-light-stone hover:bg-oo-cream"
            >
              <span className="font-medium text-oo-charcoal">QR code</span>
              <span className="mt-1 text-sm text-oo-stone-gray">On-site ordering QR setup</span>
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Vendors</h2>
        {pod.vendors.length === 0 ? (
          <p className="mt-3 text-sm text-oo-stone-gray">No vendors linked to this pod.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-oo-light-stone bg-oo-cream text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Vendor</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">In pod</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pod.vendors.map((pv) => (
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
                    <td className="px-4 py-3 text-oo-charcoal">
                      {pv.vendor.isActive ? (
                        <span className="text-emerald-800">Active</span>
                      ) : (
                        <span className="text-oo-stone-gray">Paused</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-oo-charcoal">
                      {pv.isFeatured ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          Featured
                        </span>
                      ) : (
                        <span className="text-oo-stone-gray">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/vendor/${pv.vendor.id}/orders`}
                        className="text-sm text-oo-charcoal underline hover:text-oo-charcoal"
                      >
                        Vendor orders
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(pod.address || pod.pickupTimezone) && (
        <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Location &amp; schedule</h2>
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
    </div>
  );
}
