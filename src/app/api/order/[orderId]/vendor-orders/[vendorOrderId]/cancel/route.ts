/**
 * POST /api/order/[orderId]/vendor-orders/[vendorOrderId]/cancel
 * Customer-initiated cancellation of a single vendor's portion of an order.
 * Uses existing applyVendorOrderTransition; parent status is recomputed by the service.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCustomerPhoneFromHeaders } from "@/lib/session";
import { canCustomerCancelVendorOrder } from "@/lib/cancel-eligibility";
import { applyVendorOrderTransition } from "@/services/order-status.service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ orderId: string; vendorOrderId: string }> }
) {
  const { orderId, vendorOrderId } = await context.params;
  if (!orderId || !vendorOrderId) {
    return NextResponse.json(
      { error: "Missing orderId or vendorOrderId" },
      { status: 400 }
    );
  }

  const headersList = await headers();
  const customerPhone = getCustomerPhoneFromHeaders(headersList);
  if (!customerPhone?.trim()) {
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
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const normalizedPhone = customerPhone.trim();
  if (order.customerPhone !== normalizedPhone) {
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
    return NextResponse.json(
      { error: "Vendor order not found or does not belong to this order." },
      { status: 404 }
    );
  }

  if (!canCustomerCancelVendorOrder(vo)) {
    return NextResponse.json(
      {
        error:
          "This vendor's portion can no longer be cancelled because preparation has started.",
        code: "NOT_ELIGIBLE",
      },
      { status: 400 }
    );
  }

  const result = await applyVendorOrderTransition(
    vo.id,
    "cancelled",
    "customer"
  );
  if (!result.success) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Vendor order cancelled.",
    orderId: order.id,
    vendorOrderId: vo.id,
  });
}
