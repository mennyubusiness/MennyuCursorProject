/**
 * POST /api/order/[orderId]/vendor-orders/[vendorOrderId]/cancel
 * Customer-initiated cancellation of a single vendor's portion of an order.
 * Uses existing applyVendorOrderTransition; parent status is recomputed by the service.
 * When eligible, attempts automatic refund for that vendor portion (Phase 2).
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCustomerPhoneFromHeaders } from "@/lib/session";
import { canCustomerCancelVendorOrder } from "@/lib/cancel-eligibility";
import { getRefundDecision } from "@/lib/refund-decision";
import { applyVendorOrderTransition } from "@/services/order-status.service";
import { notifyDeliverectOfCustomerCancellation } from "@/services/deliverect-customer-cancel.service";
import { executeRefund } from "@/services/refund.service";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string; vendorOrderId: string }> }
) {
  const { orderId, vendorOrderId } = await context.params;
  console.info("[TRACE customer cancel] route hit (top)", {
    route: "POST /api/order/[orderId]/vendor-orders/[vendorOrderId]/cancel",
    orderId: orderId ?? null,
    vendorOrderId: vendorOrderId ?? null,
  });
  if (!orderId || !vendorOrderId) {
    console.info("[TRACE customer cancel] early return", {
      reason: "missing orderId or vendorOrderId",
      status: 400,
    });
    return NextResponse.json(
      { error: "Missing orderId or vendorOrderId" },
      { status: 400 }
    );
  }

  const headersList = await headers();
  const customerPhone = getCustomerPhoneFromHeaders(headersList);
  if (!customerPhone?.trim()) {
    console.info("[TRACE customer cancel] early return", {
      reason: "no customer phone in headers / session",
      orderId,
      vendorOrderId,
      status: 401,
    });
    return NextResponse.json(
      {
        error:
          "Customer identity required. Please use the same device you used to place the order.",
      },
      { status: 401 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerPhone: true },
  });
  if (!order) {
    console.info("[TRACE customer cancel] early return", {
      reason: "order not found",
      orderId,
      vendorOrderId,
      status: 404,
    });
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const normalizedPhone = customerPhone.trim();
  if (order.customerPhone !== normalizedPhone) {
    console.info("[TRACE customer cancel] early return", {
      reason: "customer phone mismatch",
      orderId,
      vendorOrderId,
      status: 403,
    });
    return NextResponse.json(
      { error: "This order does not belong to you." },
      { status: 403 }
    );
  }

  const vo = await prisma.vendorOrder.findFirst({
    where: { id: vendorOrderId, orderId },
    select: {
      id: true,
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      manuallyRecoveredAt: true,
      statusHistory: { select: { source: true } },
    },
  });
  if (!vo) {
    console.info("[TRACE customer cancel] early return", {
      reason: "vendor order not found or wrong orderId",
      orderId,
      vendorOrderId,
      status: 404,
    });
    return NextResponse.json(
      { error: "Vendor order not found or does not belong to this order." },
      { status: 404 }
    );
  }

  if (!canCustomerCancelVendorOrder(vo)) {
    console.info("[TRACE customer cancel] early return", {
      reason: "canCustomerCancelVendorOrder false (NOT_ELIGIBLE)",
      orderId,
      vendorOrderId: vo.id,
      status: 400,
    });
    return NextResponse.json(
      {
        error:
          "This vendor's portion can no longer be cancelled because preparation has started.",
        code: "NOT_ELIGIBLE",
      },
      { status: 400 }
    );
  }

  console.info("[TRACE customer cancel] past guards — calling applyVendorOrderTransition", {
    orderId,
    vendorOrderId: vo.id,
  });

  const result = await applyVendorOrderTransition(
    vo.id,
    "cancelled",
    "customer"
  );
  if (!result.success) {
    console.info("[TRACE customer cancel] transition failed — return before notifyDeliverect", {
      route: "POST /api/order/[orderId]/vendor-orders/[vendorOrderId]/cancel",
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
    route: "POST /api/order/[orderId]/vendor-orders/[vendorOrderId]/cancel",
    orderId,
    vendorOrderId: vo.id,
    deliverectOrderId: deliverectOrderIdPreview,
    aboutToCallNotifyDeliverect: true,
    expectsOutboundDeliverectHttp: Boolean(deliverectOrderIdPreview),
  });
  await notifyDeliverectOfCustomerCancellation(vo.id);

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
      trigger: "customer_cancel_vendor_order",
      vendorOrderId: vo.id,
      order: orderForRefund,
    });
    if (decision.required && decision.canAutoRefund) {
      const exec = await executeRefund(decision);
      refundResult = exec.success
        ? { success: true, amountCents: exec.amountCents }
        : { success: false, code: exec.code, message: exec.message, amountCents: exec.amountCents };
    }
  }

  await clearCheckoutSourceCartForOrder(orderId);

  return NextResponse.json({
    ok: true,
    message: "Vendor order cancelled.",
    orderId: order.id,
    vendorOrderId: vo.id,
    fulfillmentStatus: result.fulfillmentStatus,
    routingStatus: result.routingStatus,
    ...(refundResult !== undefined && { refund: refundResult }),
  });
}
