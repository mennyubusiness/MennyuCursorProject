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
import { executeRefund } from "@/services/refund.service";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
  }

  const headersList = await headers();
  const customerPhone = getCustomerPhoneFromHeaders(headersList);
  if (!customerPhone?.trim()) {
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
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const normalizedPhone = customerPhone.trim();
  if (order.customerPhone !== normalizedPhone) {
    return NextResponse.json(
      { error: "This order does not belong to you." },
      { status: 403 }
    );
  }

  if (!canCustomerCancelOrder(order)) {
    return NextResponse.json(
      {
        error: "This order can no longer be cancelled because preparation has started.",
        code: "NOT_ELIGIBLE",
      },
      { status: 400 }
    );
  }

  const CUSTOMER_SOURCE = "customer";
  for (const vo of order.vendorOrders) {
    if (vo.fulfillmentStatus === "cancelled") continue;
    const result = await applyVendorOrderTransition(
      vo.id,
      "cancelled",
      CUSTOMER_SOURCE
    );
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: 400 }
      );
    }
  }

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
