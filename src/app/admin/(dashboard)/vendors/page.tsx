import { prisma } from "@/lib/db";
import { AdminVendorsTable, type AdminVendorListRow } from "./AdminVendorsTable";

export default async function AdminVendorsPage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [vendors, podsForFilter] = await Promise.all([
    prisma.vendor.findMany({
      include: {
        pods: { include: { pod: { select: { id: true, name: true } } } },
        _count: { select: { vendorOrders: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.pod.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const vendorIds = vendors.map((v) => v.id);

  const [activityRows, orders30dRows] =
    vendorIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.vendorOrder.groupBy({
            by: ["vendorId"],
            where: { vendorId: { in: vendorIds } },
            _max: { updatedAt: true },
          }),
          prisma.vendorOrder.groupBy({
            by: ["vendorId"],
            where: { vendorId: { in: vendorIds }, createdAt: { gte: thirtyDaysAgo } },
            _count: { _all: true },
          }),
        ]);

  const lastActive = new Map(
    activityRows.map((r) => [r.vendorId, r._max.updatedAt as Date | null | undefined])
  );
  const orders30d = new Map(orders30dRows.map((r) => [r.vendorId, r._count._all]));

  const rows: AdminVendorListRow[] = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    isActive: v.isActive,
    pods: v.pods.map((pv) => ({ podId: pv.pod.id, podName: pv.pod.name })),
    ordersAllTime: v._count.vendorOrders,
    ordersLast30Days: orders30d.get(v.id) ?? 0,
    lastActiveAtIso: lastActive.get(v.id)?.toISOString() ?? null,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Vendors</h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-600">
        Browse and filter vendors. Open a row or choose <strong>Manage</strong> for menu history, POS mapping, and
        vendor tools.
      </p>

      <AdminVendorsTable rows={rows} podOptions={podsForFilter} />
    </div>
  );
}
