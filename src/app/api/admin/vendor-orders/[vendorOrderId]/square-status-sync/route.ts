/**
 * POST: Manual Square status sync for a vendor order (admin debug).
 */
import { NextRequest, NextResponse } from "next/server";

import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { isSquareRoutedVendorOrder } from "@/lib/admin-order-detail-ui";
import { applySquareOrderStatusSync } from "@/services/square-status-sync.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json({ ok: false, error: "Missing vendorOrderId" }, { status: 400 });
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      id: true,
      squareOrderId: true,
      vendor: { select: { orderRoutingMode: true } },
    },
  });

  if (!vo) {
    return NextResponse.json({ ok: false, error: "Vendor order not found" }, { status: 404 });
  }

  if (
    !isSquareRoutedVendorOrder({
      squareOrderId: vo.squareOrderId,
      vendor: { orderRoutingMode: vo.vendor.orderRoutingMode },
    })
  ) {
    return NextResponse.json({
      ok: false,
      result: "not_eligible",
      message: "Vendor order is not Square-routed",
    });
  }

  if (!vo.squareOrderId?.trim()) {
    return NextResponse.json({
      ok: false,
      result: "not_eligible",
      message: "Vendor order has no squareOrderId",
    });
  }

  const result = await applySquareOrderStatusSync({
    vendorOrderId: vo.id,
    squareOrderId: vo.squareOrderId,
    applySource: "admin_manual",
  });

  return NextResponse.json({
    ok: result.outcome === "applied" || result.outcome === "noop_same_status",
    result: result.outcome,
    message: result.detail ?? result.outcome,
    updatedVendorOrderState: result.updatedVendorOrderState,
    vendorOrderId: result.vendorOrderId,
    orderId: result.orderId,
  });
}
