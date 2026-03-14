import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PodDashboardVendors } from "./PodDashboardVendors";
import { PodDashboardAddVendor } from "./PodDashboardAddVendor";
import { PodDashboardPendingRequests } from "./PodDashboardPendingRequests";

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
              isActive: true,
              mennyuOrdersPaused: true,
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!pod) notFound();

  const vendorIdsInPod = pod.vendors.map((pv) => pv.vendor.id);
  const activeOnMennyuCount = pod.vendors.filter(
    (pv) => !(pv.vendor.mennyuOrdersPaused ?? false)
  ).length;
  const [vendorsNotInPod, pendingRequests] = await Promise.all([
    prisma.vendor.findMany({
      where: { id: { notIn: vendorIdsInPod } },
      select: { id: true, name: true, slug: true, isActive: true, mennyuOrdersPaused: true },
      orderBy: { name: "asc" },
    }),
    prisma.podMembershipRequest.findMany({
      where: { podId, status: "pending" },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      {/* Vendor summary overview */}
      <section className="rounded-lg border border-stone-200 bg-stone-50/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Vendor Summary
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs font-medium text-stone-500">Vendors in pod</p>
            <p className="mt-1 text-xl font-semibold text-stone-900">{pod.vendors.length}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs font-medium text-stone-500">Pending requests</p>
            <p className="mt-1 text-xl font-semibold text-stone-900">{pendingRequests.length}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-xs font-medium text-stone-500">Active on Mennyu</p>
            <p className="mt-1 text-xl font-semibold text-stone-900">{activeOnMennyuCount}</p>
          </div>
        </div>

        <h3 className="mt-5 mb-3 text-sm font-medium text-stone-800">Vendors in this pod</h3>
        {pod.vendors.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-500">
            No vendors in this pod yet. Request a vendor to join below.
          </p>
        ) : (
          <PodDashboardVendors
            podId={pod.id}
            vendors={pod.vendors.map((pv) => ({
              id: pv.vendor.id,
              name: pv.vendor.name,
              slug: pv.vendor.slug,
              isActive: pv.vendor.isActive,
              mennyuOrdersPaused: pv.vendor.mennyuOrdersPaused ?? false,
            }))}
          />
        )}
      </section>

      {/* Pending vendor requests */}
      <PodDashboardPendingRequests
        podId={pod.id}
        requests={pendingRequests.map((r) => ({
          id: r.id,
          vendorName: r.vendor.name,
          createdAt: r.createdAt.toISOString(),
        }))}
      />

      {/* Request vendor to join */}
      <section>
        <h2 className="mb-3 font-medium text-stone-800">Request vendor to join</h2>
        <p className="mb-2 text-sm text-stone-600">
          The vendor must approve. If they are in another pod, accepting will move them to this pod.
        </p>
        {vendorsNotInPod.length === 0 ? (
          <p className="text-sm text-stone-500">All vendors are already in this pod.</p>
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
    </div>
  );
}
