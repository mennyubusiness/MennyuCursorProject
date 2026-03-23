import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { VendorPauseToggle } from "../dashboard/VendorPauseToggle";
import { VendorPodRequests } from "../dashboard/VendorPodRequests";
import { VendorRecentPodRequests } from "../dashboard/VendorRecentPodRequests";
import { VendorAutoPublishToggle } from "./VendorAutoPublishToggle";
import { VendorDashboardTokenForm } from "./VendorDashboardTokenForm";

export default async function VendorSettingsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const [vendor, pendingRequests, recentRequests, currentPod] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        mennyuOrdersPaused: true,
        autoPublishMenus: true,
        vendorDashboardToken: true,
      },
    }),
    prisma.podMembershipRequest.findMany({
      where: { vendorId, status: "pending" },
      include: { pod: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.podMembershipRequest.findMany({
      where: { vendorId, status: { not: "pending" } },
      include: { pod: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.podVendor.findFirst({
      where: { vendorId },
      include: { pod: { select: { id: true, name: true } } },
    }),
  ]);

  if (!vendor) notFound();

  const pendingRequestsForComponent = pendingRequests.map((r) => ({
    id: r.id,
    podId: r.pod.id,
    podName: r.pod.name,
    createdAt: r.createdAt.toISOString(),
  }));

  const recentRequestsForComponent = recentRequests.map((r) => ({
    id: r.id,
    podId: r.pod.id,
    podName: r.pod.name,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Settings</h2>
        <p className="mt-1 text-sm text-stone-600">
          Vendor info and Mennyu controls. More options coming as we add integrations.
        </p>
      </div>

      {/* Vendor info (read-only) */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Vendor info
        </h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-stone-500">Name</dt>
            <dd className="font-medium text-stone-900">{vendor.name}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Slug</dt>
            <dd className="font-mono text-stone-700">{vendor.slug}</dd>
          </div>
          {vendor.description && (
            <div>
              <dt className="text-stone-500">Description</dt>
              <dd className="text-stone-700">{vendor.description}</dd>
            </div>
          )}
          {vendor.imageUrl && (
            <div>
              <dt className="text-stone-500">Image</dt>
              <dd>
                <img
                  src={vendor.imageUrl}
                  alt=""
                  className="mt-1 h-20 w-20 rounded-lg object-cover"
                />
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-3 text-xs text-stone-400">
          Editing vendor profile is not available yet. You can manage orders and pause state below.
        </p>
      </section>

      {/* Mennyu settings */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Mennyu settings
        </h3>
        <div className="mt-3">
          <VendorPauseToggle vendorId={vendor.id} initialPaused={vendor.mennyuOrdersPaused ?? false} />
        </div>
        <p className="mt-3 text-xs text-stone-400">
          You can also pause or resume Mennyu orders from the{" "}
          <Link href={`/vendor/${vendorId}/orders`} className="underline hover:text-stone-600">
            Orders
          </Link>{" "}
          page.
        </p>
      </section>

      <VendorAutoPublishToggle vendorId={vendor.id} initialAutoPublishMenus={vendor.autoPublishMenus ?? false} />

      {vendor.vendorDashboardToken ? (
        <VendorDashboardTokenForm vendorId={vendor.id} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Dashboard token not configured</p>
          <p className="mt-1">
            Ask your Mennyu admin to run{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs">
              POST /api/admin/vendors/&#123;vendorId&#125;/dashboard-token
            </code>{" "}
            (admin auth) to generate a token, then reload this page.
          </p>
        </div>
      )}

      {/* Integrations placeholder */}
      <section className="rounded-lg border border-stone-200 bg-stone-50/80 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Integrations
        </h3>
        <p className="mt-3 text-sm text-stone-600">
          POS / Deliverect connection coming soon. Your orders are managed in Mennyu until then.
        </p>
      </section>

      {/* Pending pod requests */}
      <VendorPodRequests
        vendorId={vendor.id}
        requests={pendingRequestsForComponent}
        currentPod={currentPod ? { id: currentPod.pod.id, name: currentPod.pod.name } : null}
      />

      {/* Recent pod requests */}
      <VendorRecentPodRequests recentRequests={recentRequestsForComponent} />
    </div>
  );
}
