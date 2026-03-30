import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PodDashboardAddVendor } from "./PodDashboardAddVendor";
import { PodDashboardPendingRequests } from "./PodDashboardPendingRequests";
import { PodVendorRosterPanel } from "./PodVendorRosterPanel";

export default async function PodDashboardPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    include: {
      vendors: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              imageUrl: true,
              isActive: true,
              mennyuOrdersPaused: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { vendorId: "asc" }],
      },
    },
  });
  if (!pod) notFound();

  const vendorIdsInPod = pod.vendors.map((pv) => pv.vendor.id);
  const [vendorsNotInPod, pendingRequests] = await Promise.all([
    prisma.vendor.findMany({
      where: { id: { notIn: vendorIdsInPod } },
      select: { id: true, name: true, slug: true, isActive: true, mennyuOrdersPaused: true },
      orderBy: { name: "asc" },
    }),
    prisma.podMembershipRequest.findMany({
      where: { podId, status: "pending" },
      include: {
        vendor: {
          select: { id: true, name: true, description: true, imageUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rosterRows = pod.vendors.map((pv) => ({
    vendorId: pv.vendor.id,
    name: pv.vendor.name,
    description: pv.vendor.description,
    imageUrl: pv.vendor.imageUrl,
    isFeatured: pv.isFeatured,
    isActive: pv.vendor.isActive,
    mennyuOrdersPaused: pv.vendor.mennyuOrdersPaused ?? false,
  }));

  const pendingForUi = pendingRequests.map((r) => ({
    id: r.id,
    vendorId: r.vendor.id,
    vendorName: r.vendor.name,
    vendorDescription: r.vendor.description,
    vendorImageUrl: r.vendor.imageUrl,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Overview</h1>
        <p className="mt-1 text-sm text-stone-600">
          Invite vendors, track responses, and curate your roster — order and featured flags update the
          public pod page.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-medium text-stone-800">Request vendor to join</h2>
        <p className="mb-2 text-sm text-stone-600">
          We&apos;ll notify the vendor. They choose whether to accept or decline. If they&apos;re already
          in another pod, accepting your invitation moves them here.
        </p>
        {vendorsNotInPod.length === 0 ? (
          <p className="text-sm text-stone-500">All vendors are already in this pod or have pending requests.</p>
        ) : (
          <PodDashboardAddVendor
            podId={pod.id}
            eligibleVendors={vendorsNotInPod.map((v) => ({
              id: v.id,
              name: v.name,
              slug: v.slug,
              isActive: v.isActive,
              mennyuOrdersPaused: v.mennyuOrdersPaused ?? false,
            }))}
          />
        )}
      </section>

      <PodDashboardPendingRequests podId={pod.id} requests={pendingForUi} />

      <section>
        <h2 className="mb-3 text-base font-semibold text-stone-900">Vendor roster</h2>
        <p className="mb-3 text-sm text-stone-600">
          Drag to reorder. Featured shows a badge only — it does not change sort order.
        </p>
        <PodVendorRosterPanel podId={pod.id} initialRows={rosterRows} />
      </section>
    </div>
  );
}
