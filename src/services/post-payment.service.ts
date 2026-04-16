/**
 * Shared post-payment processing: one idempotent flow for webhook and redirect reconciliation.
 * Records payment, moves order out of pending_payment, submits vendor orders via routing layer
 * (only when pending), updates parent routing status, sends confirmation SMS when this call recorded the payment.
 */
import { prisma } from "@/lib/db";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";
import { recordPaymentAndAllocations } from "@/services/payment.service";
import { setOrderStatus } from "@/services/order.service";
import { submitVendorOrder } from "@/services/routing.service";
import { sendOrderConfirmation } from "@/services/sms.service";
import { deriveParentStatusFromVendorOrders } from "@/services/order-status.service";
import { formatPickupSmsFragment } from "@/lib/pickup-display";
import { resolvePickupTimezone } from "@/lib/pickup-scheduling";

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
    include: { vendorOrders: true, pod: true },
  });
  if (order) {
    for (const vo of order.vendorOrders) {
      if (vo.routingStatus === "pending") {
        await submitVendorOrder(vo.id, {
          customerPhone: order.customerPhone,
          customerEmail: order.customerEmail ?? null,
          preparationTimeMinutes: 15,
        });
      }
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

    if (paymentCreated) {
      const tz = resolvePickupTimezone(order.pod);
      await sendOrderConfirmation(
        order.customerPhone,
        orderId,
        order.totalCents,
        formatPickupSmsFragment({
          requestedPickupAt: order.requestedPickupAt,
          deliverectEstimatedReadyAt: order.deliverectEstimatedReadyAt,
          resolvedPickupTimezone: tz,
        })
      );
    }
  }

  await clearCheckoutSourceCartForOrder(orderId);
}
