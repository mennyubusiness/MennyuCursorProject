import { prisma } from "@/lib/db";
import { AdminPodsTable, type AdminPodListRow } from "./AdminPodsTable";

export default async function AdminPodsPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const pods = await prisma.pod.findMany({
    include: {
      vendors: {
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const podIds = pods.map((p) => p.id);

  const [ordersTodayRows, lastOrderRows] =
    podIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.order.groupBy({
            by: ["podId"],
            where: { podId: { in: podIds }, createdAt: { gte: startOfToday } },
            _count: { _all: true },
          }),
          prisma.order.groupBy({
            by: ["podId"],
            where: { podId: { in: podIds } },
            _max: { createdAt: true },
          }),
        ]);

  const ordersTodayMap = new Map(ordersTodayRows.map((r) => [r.podId, r._count._all]));
  const lastOrderMap = new Map(
    lastOrderRows.map((r) => [r.podId, r._max.createdAt as Date | null | undefined])
  );

  const rows: AdminPodListRow[] = pods.map((p) => {
    const names = p.vendors.map((pv) => pv.vendor.name);
    return {
      id: p.id,
      name: p.name,
      vendorCount: p.vendors.length,
      vendorNamesForTooltip: names.join(", "),
      isActive: p.isActive,
      ordersToday: ordersTodayMap.get(p.id) ?? 0,
      lastOrderAtIso: lastOrderMap.get(p.id)?.toISOString() ?? null,
    };
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Pods</h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-600">
        Directory of kiosk locations. Open a row or <strong>Manage</strong> for vendors, QR, and pod tools.
      </p>

      <AdminPodsTable rows={rows} />
    </div>
  );
}
