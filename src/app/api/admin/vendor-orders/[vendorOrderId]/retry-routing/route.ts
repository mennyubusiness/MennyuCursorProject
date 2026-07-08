/**
 * POST: Retry routing for a vendor order via the routing service.
 * Returns ok: false with unavailable: true when routing is not configured (e.g. ROUTING_MODE=mock).
 */
import { NextResponse } from "next/server";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";
import { canRetryRouting, isOrderPaidForAdminRecovery, isSquarePermissionsRetryBlocked } from "@/lib/admin-needs-attention-actions";
import { isRoutingRetryAvailable, getRoutingUnavailableReason } from "@/lib/routing-availability";
import { retryVendorOrderRouting } from "@/services/routing.service";
import { recomputeAndPersistParentStatus } from "@/services/order-status.service";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  context: { params: Promise<{ vendorOrderId: string }> }
) {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { vendorOrderId } = await context.params;
  if (!vendorOrderId) {
    return NextResponse.json(
      { ok: false, error: "Missing vendorOrderId" },
      { status: 400 }
    );
  }

  if (!isRoutingRetryAvailable()) {
    return NextResponse.json({
      ok: false,
      error: getRoutingUnavailableReason(),
      unavailable: true,
    });
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      routingStatus: true,
      fulfillmentStatus: true,
      deliverectOrderId: true,
      manuallyRecoveredAt: true,
      squareLastError: true,
      order: { select: { status: true } },
      vendor: { select: { orderRoutingMode: true } },
    },
  });
  if (!vo) {
    return NextResponse.json({ ok: false, error: "Vendor order not found" }, { status: 404 });
  }

  const orderSnap = { status: vo.order.status };
  if (!isOrderPaidForAdminRecovery(orderSnap)) {
    return NextResponse.json({
      ok: false,
      error: "Routing retry requires a paid order.",
      code: "ORDER_UNPAID",
    });
  }

  const voSnap = {
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    deliverectOrderId: vo.deliverectOrderId,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
    squareLastError: vo.squareLastError,
  };
  if (
    isSquarePermissionsRetryBlocked(vo.squareLastError, vo.vendor.orderRoutingMode) ||
    !canRetryRouting(voSnap, orderSnap, vo.vendor.orderRoutingMode)
  ) {
    const permissionsBlocked = isSquarePermissionsRetryBlocked(
      vo.squareLastError,
      vo.vendor.orderRoutingMode
    );
    return NextResponse.json({
      ok: false,
      error: permissionsBlocked
        ? "Square permissions are missing. Reconnect Square and approve ORDERS_WRITE/PAYMENTS_WRITE before retrying routing."
        : "Routing retry is not safe for this vendor order (already sent to POS, terminal state, or manually recovered). Use manual recovery or view the order.",
      code: permissionsBlocked ? "SQUARE_INSUFFICIENT_PERMISSIONS" : "NOT_ELIGIBLE",
    });
  }

  const result = await retryVendorOrderRouting(vendorOrderId);

  if (result.skipped) {
    return NextResponse.json({
      ok: false,
      error: "Routing retry is unavailable in this environment (submission skipped).",
      unavailable: true,
    });
  }
  if (result.success) {
    const voAfter = await prisma.vendorOrder.findUnique({
      where: { id: vendorOrderId },
      select: { orderId: true },
    });
    if (voAfter) {
      await recomputeAndPersistParentStatus(voAfter.orderId, "admin_retry_routing");
    }
    return NextResponse.json({
      ok: true,
      action: "retry-routing",
      message: "Routing submitted",
      deliverectOrderId: result.externalOrderId,
    });
  }
  return NextResponse.json({
    ok: false,
    error: result.error ?? "Submission failed",
    code: result.code,
  });
}
