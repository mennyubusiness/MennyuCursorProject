import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";
import { recordPaymentAndAllocations } from "@/services/payment.service";
import { setOrderStatus } from "@/services/order.service";
import { submitVendorOrder } from "@/services/routing.service";
import { sendOrderConfirmation } from "@/services/sms.service";
import { buildIdempotencyKey } from "@/lib/idempotency";
import { deriveParentStatusFromVendorOrders } from "@/services/order-status.service";

const bodySchema = z.object({
  orderId: z.string(),
  paymentIntentId: z.string(),
  idempotencyKey: z.string().min(1),
});

/**
 * Called after Stripe payment succeeds (e.g. from Stripe webhook or client).
 * Idempotent: record payment, update order to paid, route each vendor order to Deliverect, send SMS.
 * Accepts dev_bypass_* paymentIntentId in development for testing without Stripe.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { orderId, paymentIntentId, idempotencyKey } = parsed.data;

    const key = buildIdempotencyKey("order_confirm", idempotencyKey);
    const existing = await prisma.order.findFirst({
      where: { id: orderId, status: { not: "pending_payment" } },
    });
    if (existing) {
      await clearCheckoutSourceCartForOrder(orderId);
      return NextResponse.json({ orderId: existing.id, status: existing.status });
    }

    await recordPaymentAndAllocations(orderId, paymentIntentId, idempotencyKey);
    await setOrderStatus(orderId, "paid", "system");
    await setOrderStatus(orderId, "routing", "system");

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { vendorOrders: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    for (const vo of order.vendorOrders) {
      await submitVendorOrder(vo.id, {
        customerPhone: order.customerPhone,
        customerEmail: order.customerEmail ?? null,
        preparationTimeMinutes: 15,
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        vendorOrders: {
          select: {
            routingStatus: true,
            fulfillmentStatus: true,
            statusHistory: { select: { source: true } },
          },
        },
      },
    });
    const parentStatus = deriveParentStatusFromVendorOrders(
      updatedOrder?.vendorOrders ?? []
    );
    await setOrderStatus(orderId, parentStatus, "system");
    await sendOrderConfirmation(order.customerPhone, orderId, order.totalCents);

    const final = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    await clearCheckoutSourceCartForOrder(orderId);
    return NextResponse.json({ orderId: final!.id, status: final!.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order confirmation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
