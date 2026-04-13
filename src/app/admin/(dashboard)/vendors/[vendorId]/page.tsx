import Link from "next/link";
import { notFound } from "next/navigation";
import { getLatestActionableMenuImportJobForVendor } from "@/lib/admin-menu-import-queries";
import { prisma } from "@/lib/db";
import { AdminVendorToggle } from "../AdminVendorToggle";

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const id = vendorId?.trim();
  if (!id) notFound();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      mennyuOrdersPaused: true,
      posConnectionStatus: true,
      deliverectChannelLinkId: true,
      autoPublishMenus: true,
      updatedAt: true,
      onboardingStatus: true,
      contactEmail: true,
      pods: {
        include: { pod: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
  if (!vendor) notFound();

  const [ordersAllTime, ordersLast30, lastVoActivity, pendingMenuJob] = await Promise.all([
    prisma.vendorOrder.count({ where: { vendorId: id } }),
    prisma.vendorOrder.count({ where: { vendorId: id, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.vendorOrder.aggregate({
      where: { vendorId: id },
      _max: { updatedAt: true },
    }),
    getLatestActionableMenuImportJobForVendor(id),
  ]);

  const lastActivity = lastVoActivity._max.updatedAt;

  return (
    <div className="space-y-10">
      <nav className="text-sm text-stone-500">
        <Link href="/admin/vendors" className="hover:text-stone-800 hover:underline">
          Vendors
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-stone-800">{vendor.name}</span>
      </nav>

      <header className="flex flex-col gap-4 border-b border-stone-200 pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{vendor.name}</h1>
          <p className="mt-1 font-mono text-sm text-stone-600">{vendor.slug}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                vendor.isActive ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-stone-700"
              }`}
            >
              {vendor.isActive ? "Active" : "Paused"}
            </span>
            {vendor.mennyuOrdersPaused && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-950">
                Intake paused
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
              POS: {vendor.posConnectionStatus}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminVendorToggle vendorId={vendor.id} isActive={vendor.isActive} variant="compact" />
        </div>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Performance</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-stone-500">Vendor orders (all time)</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{ordersAllTime}</dd>
          </div>
          <div>
            <dt className="text-sm text-stone-500">Last 30 days</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{ordersLast30}</dd>
          </div>
          <div>
            <dt className="text-sm text-stone-500">Last vendor-order activity</dt>
            <dd className="mt-1 text-sm font-medium text-stone-900">
              {lastActivity
                ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(lastActivity)
                : "—"}
            </dd>
            <p className="mt-0.5 text-xs text-stone-500">Based on latest update to any vendor order slice.</p>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Operational settings</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Mennyu intake</dt>
            <dd className="font-medium text-stone-900">{vendor.mennyuOrdersPaused ? "Paused" : "Open"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Auto-publish menus</dt>
            <dd className="font-medium text-stone-900">{vendor.autoPublishMenus ? "On" : "Off"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Deliverect channel link</dt>
            <dd className="break-all font-mono text-xs text-stone-800">{vendor.deliverectChannelLinkId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Onboarding</dt>
            <dd className="font-medium text-stone-900">{vendor.onboardingStatus}</dd>
          </div>
          {vendor.contactEmail && (
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Contact</dt>
              <dd className="text-stone-900">{vendor.contactEmail}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-stone-500">
          Record updated {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(vendor.updatedAt)}.
        </p>
      </section>

      {pendingMenuJob && (
        <div
          className="rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950"
          role="status"
        >
          <p className="font-medium">Menu update awaiting review</p>
          <p className="mt-1 text-sky-900/90">A draft import is ready — review and publish when appropriate.</p>
          <Link
            href={`/admin/vendors/${vendor.id}/menu-history#vendor-imports`}
            className="mt-2 inline-block font-medium text-sky-900 underline hover:text-sky-950"
          >
            Open menu management →
          </Link>
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Tools &amp; areas</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href={`/admin/vendors/${vendor.id}/menu-history`}
              className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50/80"
            >
              <span className="font-medium text-stone-900">Menu management</span>
              <span className="mt-1 text-sm text-stone-600">
                Deliverect imports, publish/discard, and published snapshots
              </span>
            </Link>
          </li>
          <li>
            <Link
              href={`/admin/vendors/${vendor.id}/deliverect-mapping`}
              className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50/80"
            >
              <span className="font-medium text-stone-900">POS &amp; Deliverect IDs</span>
              <span className="mt-1 text-sm text-stone-600">Channel mapping, product IDs, and POS health</span>
            </Link>
          </li>
          <li>
            <Link
              href={`/vendor/${vendor.id}/orders`}
              className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50/80"
            >
              <span className="font-medium text-stone-900">Vendor area</span>
              <span className="mt-1 text-sm text-stone-600">Restaurant-facing orders dashboard (session required)</span>
            </Link>
          </li>
          <li>
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4">
              <span className="font-medium text-stone-900">Pods</span>
              {vendor.pods.length === 0 ? (
                <p className="mt-1 text-sm text-stone-500">No pod memberships.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {vendor.pods.map((pv) => (
                    <li key={pv.pod.id}>
                      <Link href={`/pod/${pv.pod.id}/dashboard`} className="text-sky-800 underline hover:text-sky-950">
                        {pv.pod.name}
                      </Link>
                      <span className="text-stone-400"> · </span>
                      <span className="font-mono text-xs text-stone-500">{pv.pod.slug}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        </ul>
      </section>
    </div>
  );
}
