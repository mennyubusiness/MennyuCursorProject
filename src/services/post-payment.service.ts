/**
 * Shared post-payment processing: one idempotent flow for webhook and redirect reconciliation.
 * Records payment, moves order out of pending_payment, submits to Deliverect (only when pending),
 * updates parent routing status, sends confirmation SMS only when this call recorded the payment.
 */
import { prisma } from "@/lib/db";
import { recordPaymentAndAllocations } from "@/services/payment.service";
import { setOrderStatus } from "@/services/order.service";
import { submitVendorOrderToDeliverect } from "@/services/deliverect.service";
import { sendOrderConfirmation } from "@/services/sms.service";
import { deriveParentRoutingStatusFromAttempts } from "@/domain/order-state";

/**
 * Run full post-payment flow: record payment (or skip if already recorded), set status,
 * submit vendor orders to Deliverect only when still pending, derive routing status, send SMS once.
 * Safe to call from both Stripe webhook and redirect reconciliation; duplicate calls are idempotent.
 */
export async function processSuccessfulPayment(params: {
  orderId: string;
  paymentIntentId: string;
  idempotencyKey: string;
}): Promise<void> {
  const { orderId, paymentIntentId, idempotencyKey } = params;

  let paymentCreated: boolean;
  try {
    const result = await recordPaymentAndAllocations(orderId, paymentIntentId, idempotencyKey);
    paymentCreated = result.created;
  } catch (recordErr: unknown) {
    const isP2002 =
      recordErr &&
      typeof recordErr === "object" &&
      "code" in recordErr &&
      (recordErr as { code: string }).code === "P2002";
    if (isP2002) {
      paymentCreated = false;
    } else {
      throw recordErr;
    }
  }

  await setOrderStatus(orderId, "paid", "stripe");
  await setOrderStatus(orderId, "routing", "system");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { vendorOrders: true },
  });
  if (order) {
    for (const vo of order.vendorOrders) {
      if (vo.routingStatus === "pending") {
        await submitVendorOrderToDeliverect(
          vo.id,
          order.customerPhone,
          order.customerEmail,
          15
        );
      }
    }
    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: { vendorOrders: { select: { routingStatus: true } } },
    });
    const routingStatus = deriveParentRoutingStatusFromAttempts(
      (updatedOrder?.vendorOrders ?? []).map((vo) => vo.routingStatus as "pending" | "sent" | "confirmed" | "failed")
    );
    await setOrderStatus(orderId, routingStatus, "system");

    if (paymentCreated) {
      await sendOrderConfirmation(order.customerPhone, orderId, order.totalCents);
    }
  }
}
