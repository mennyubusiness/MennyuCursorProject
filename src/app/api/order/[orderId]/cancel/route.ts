/**
 * POST /api/order/[orderId]/cancel
 * Customer-initiated order cancellation. Cancels all vendor orders via existing transition logic.
 * Requires customer phone cookie to match order; validates eligibility server-side.
 * When eligible, attempts automatic refund via shared refund layer (Phase 2).
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCustomerPhoneFromHeaders } from "@/lib/session";
import { canCustomerCancelOrder } from "@/lib/cancel-eligibility";
import { getRefundDecision } from "@/lib/refund-decision";
import { applyVendorOrderTransition } from "@/services/order-status.service";
import { notifyDeliverectOfCustomerCancellation } from "@/services/deliverect-customer-cancel.service";
import { executeRefund } from "@/services/refund.service";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  console.info("[TRACE customer cancel] route hit (top)", {
    route: "POST /api/order/[orderId]/cancel",
    orderId: orderId ?? null,
    vendorOrderId: null,
  });
  if (!orderId) {
    console.info("[TRACE customer cancel] early return", { reason: "missing orderId", status: 400 });
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const headersList = await headers();
  const customerPhone = getCustomerPhoneFromHeaders(headersList);
  if (!customerPhone?.trim()) {
    console.info("[TRACE customer cancel] early return", {
      reason: "no customer phone in headers / session",
      orderId,
      status: 401,
    });
    return NextResponse.json(
      { error: "Customer identity required. Please use the same device you used to place the order." },
      { status: 401 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerPhone: true,
      status: true,
      vendorOrders: {
        select: {
          id: true,
          routingStatus: true,
          fulfillmentStatus: true,
          manuallyRecoveredAt: true,
          statusHistory: { select: { source: true } },
        },
      },
    },
  });

  if (!order) {
    console.info("[TRACE customer cancel] early return", { reason: "order not found", orderId, status: 404 });
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const normalizedPhone = customerPhone.trim();
  if (order.customerPhone !== normalizedPhone) {
    console.info("[TRACE customer cancel] early return", {
      reason: "customer phone mismatch",
      orderId,
      status: 403,
    });
    return NextResponse.json(
      { error: "This order does not belong to you." },
      { status: 403 }
    );
  }

  if (!canCustomerCancelOrder(order)) {
    console.info("[TRACE customer cancel] early return", {
      reason: "canCustomerCancelOrder false (NOT_ELIGIBLE)",
      orderId,
      status: 400,
    });
    return NextResponse.json(
      {
        error: "This order can no longer be cancelled because preparation has started.",
        code: "NOT_ELIGIBLE",
      },
      { status: 400 }
    );
  }

  console.info("[TRACE customer cancel] past guards — entering cancel loop", {
    orderId,
    vendorOrderCount: order.vendorOrders.length,
    vendorOrderIds: order.vendorOrders.map((v) => v.id),
  });

  const CUSTOMER_SOURCE = "customer";
  for (const vo of order.vendorOrders) {
    if (vo.fulfillmentStatus === "cancelled") {
      console.info("[TRACE customer cancel] skip vendor order (already cancelled)", {
        route: "POST /api/order/[orderId]/cancel",
        orderId,
        vendorOrderId: vo.id,
      });
      continue;
    }
    const result = await applyVendorOrderTransition(
      vo.id,
      "cancelled",
      CUSTOMER_SOURCE
    );
    if (!result.success) {
      console.info("[TRACE customer cancel] transition failed — return before notifyDeliverect", {
        route: "POST /api/order/[orderId]/cancel",
        orderId,
        vendorOrderId: vo.id,
        error: result.error,
        code: result.code,
      });
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 400 }
      );
    }

    const voForNotify = await prisma.vendorOrder.findUnique({
      where: { id: vo.id },
      select: { deliverectOrderId: true },
    });
    const deliverectOrderIdPreview = voForNotify?.deliverectOrderId?.trim() ?? null;
    console.info("[TRACE customer cancel] pre-notifyDeliverect", {
      route: "POST /api/order/[orderId]/cancel",
      orderId,
      vendorOrderId: vo.id,
      deliverectOrderId: deliverectOrderIdPreview,
      aboutToCallNotifyDeliverect: true,
      expectsOutboundDeliverectHttp: Boolean(deliverectOrderIdPreview),
    });
    await notifyDeliverectOfCustomerCancellation(vo.id);
  }

  console.info("[TRACE customer cancel] cancel loop finished — refund/clear cart next", { orderId });

  let refundResult: { success: boolean; code?: string; message?: string; amountCents?: number } | undefined;
  const orderForRefund = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      totalCents: true,
      vendorOrders: {
        select: { id: true, totalCents: true, routingStatus: true, fulfillmentStatus: true },
      },
    },
  });
  if (orderForRefund) {
    const decision = getRefundDecision({
      orderId: orderForRefund.id,
      trigger: "customer_cancel_full",
      order: orderForRefund,
    });
    if (decision.required && decision.canAutoRefund) {
      const result = await executeRefund(decision);
      refundResult = result.success
        ? { success: true, amountCents: result.amountCents }
        : { success: false, code: result.code, message: result.message, amountCents: result.amountCents };
    }
  }

  await clearCheckoutSourceCartForOrder(orderId);

  return NextResponse.json({
    ok: true,
    message: "Order cancelled.",
    orderId: order.id,
    status: "cancelled",
    ...(refundResult !== undefined && { refund: refundResult }),
  });
}
