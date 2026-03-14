/**
 * GET /api/vendor/[vendorId]/orders
 * Returns vendor orders for the given vendor, with order + line items + selections.
 * Used by the vendor dashboard.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ vendorId: string }> }
) {
  const { vendorId } = await context.params;
  if (!vendorId) {
    return NextResponse.json({ error: "Missing vendorId" }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, slug: true },
  });
  if (!vendor) {
    return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
  }

  const vendorOrders = await prisma.vendorOrder.findMany({
    where: { vendorId },
    include: {
      order: {
        select: {
          id: true,
          orderNotes: true,
          customerPhone: true,
          customerEmail: true,
          createdAt: true,
          _count: { select: { vendorOrders: true } },
        },
      },
      lineItems: {
        include: {
          selections: {
            include: {
              modifierOption: { select: { name: true } },
            },
          },
        },
      },
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const multiVendorOrderIds = [
    ...new Set(
      vendorOrders
        .filter((vo) => (vo.order._count?.vendorOrders ?? 1) > 1)
        .map((vo) => vo.orderId)
    ),
  ];

  let siblingFirstReadyByOrder: Map<string, Map<string, Date>> = new Map();
  if (multiVendorOrderIds.length > 0) {
    const readyEntries = await prisma.vendorOrderStatusHistory.findMany({
      where: {
        fulfillmentStatus: "ready",
        vendorOrder: { orderId: { in: multiVendorOrderIds } },
      },
      select: {
        createdAt: true,
        vendorOrderId: true,
        vendorOrder: { select: { orderId: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const firstReadyByVendorOrder = new Map<string, Date>();
    for (const e of readyEntries) {
      if (!firstReadyByVendorOrder.has(e.vendorOrderId)) {
        firstReadyByVendorOrder.set(e.vendorOrderId, e.createdAt);
      }
    }
    // Bulk-load all sibling VendorOrders for multi-vendor orders (avoids N+1)
    const allSiblingVos = await prisma.vendorOrder.findMany({
      where: { orderId: { in: multiVendorOrderIds } },
      select: { id: true, orderId: true },
    });
    const allVoIdsForOrder = new Map<string, string[]>();
    for (const v of allSiblingVos) {
      const ids = allVoIdsForOrder.get(v.orderId) ?? [];
      ids.push(v.id);
      allVoIdsForOrder.set(v.orderId, ids);
    }
    for (const vo of vendorOrders) {
      if ((vo.order._count?.vendorOrders ?? 1) <= 1) continue;
      const siblingVoIds = (allVoIdsForOrder.get(vo.orderId) ?? []).filter((id) => id !== vo.id);
      let earliest: Date | null = null;
      for (const sid of siblingVoIds) {
        const t = firstReadyByVendorOrder.get(sid);
        if (t && (!earliest || t < earliest)) earliest = t;
      }
      if (earliest) {
        let byVo = siblingFirstReadyByOrder.get(vo.orderId);
        if (!byVo) {
          byVo = new Map();
          siblingFirstReadyByOrder.set(vo.orderId, byVo);
        }
        byVo.set(vo.id, earliest);
      }
    }
  }

  const now = Date.now();
  const serialized = vendorOrders.map((vo) => {
    const orderCount = vo.order._count?.vendorOrders ?? 1;
    const isActive = !["ready", "completed", "cancelled"].includes(vo.fulfillmentStatus);
    const siblingFirstReady = orderCount > 1 && isActive
      ? siblingFirstReadyByOrder.get(vo.orderId)?.get(vo.id)
      : undefined;
    const siblingFirstReadyMinutesAgo =
      siblingFirstReady != null
        ? Math.floor((now - siblingFirstReady.getTime()) / (60 * 1000))
        : null;

    return {
      ...vo,
      order: {
        ...vo.order,
        createdAt: vo.order.createdAt.toISOString(),
      },
      statusHistory: vo.statusHistory.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      })),
      siblingFirstReadyMinutesAgo,
    };
  });

  return NextResponse.json({
    vendor: { id: vendor.id, name: vendor.name, slug: vendor.slug },
    vendorOrders: serialized,
  });
}
