/**
 * Safe admin health / recovery actions — audit logged on success only.
 */
import "server-only";

import { prisma } from "@/lib/db";
import {
  ADMIN_AUDIT_ACTION,
  ADMIN_AUDIT_TARGET,
  requireAdminReason,
} from "@/lib/admin-audit-log";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";
import { validatePaymentIntentForOrderProcessing } from "@/services/payment.service";

type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function adminRerunPaymentValidation(input: {
  orderId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, stripePaymentIntentId: true, status: true },
  });
  if (!order) return { ok: false, error: "Order not found." };
  if (!order.stripePaymentIntentId) {
    return { ok: false, error: "Order has no PaymentIntent ID to validate." };
  }

  const result = await validatePaymentIntentForOrderProcessing({
    orderId: order.id,
    paymentIntentId: order.stripePaymentIntentId,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: `${result.code}: ${result.message}`,
    };
  }

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.PAYMENT_VALIDATION_RERUN,
    targetType: ADMIN_AUDIT_TARGET.order,
    targetId: order.id,
    reason: reasonCheck.reason,
    oldValue: { status: order.status },
    newValue: { validation: "ok" },
    metadata: { paymentIntentId: order.stripePaymentIntentId },
  });

  return { ok: true, message: "Payment validation passed for this order." };
}

export async function adminRecheckOrderHealth(input: {
  orderId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      vendorOrders: {
        select: { id: true, routingStatus: true, fulfillmentStatus: true },
      },
    },
  });
  if (!order) return { ok: false, error: "Order not found." };

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.ORDER_HEALTH_RECHECKED,
    targetType: ADMIN_AUDIT_TARGET.order,
    targetId: order.id,
    reason: reasonCheck.reason,
    oldValue: { status: order.status },
    newValue: {
      vendorOrderCount: order.vendorOrders.length,
      vendorOrders: order.vendorOrders.map((vo) => ({
        id: vo.id,
        routing: vo.routingStatus,
        fulfillment: vo.fulfillmentStatus,
      })),
    },
  });

  return {
    ok: true,
    message: `Recorded health recheck for order (${order.vendorOrders.length} vendor order(s)). See /admin/incidents for derived flags.`,
  };
}

export function adminActionAvailability() {
  return {
    paymentValidationRerun: true,
    orderHealthRecheck: true,
    receiptResend: false,
    orderStatusLinkResend: false,
    transactionalSmsResend: false,
    webhookReplay: false,
    vendorTransferRetry: false,
  };
}

export function disabledActionExplanation(action: keyof ReturnType<typeof adminActionAvailability>): string {
  switch (action) {
    case "receiptResend":
      return "Receipt resend is not configured in admin yet.";
    case "orderStatusLinkResend":
      return "Order status link resend is not configured in admin yet.";
    case "transactionalSmsResend":
      return "Transactional SMS resend requires a safe resend helper (not wired in admin).";
    case "webhookReplay":
      return "Webhook replay is not configured — inspect logs manually.";
    case "vendorTransferRetry":
      return "Use Vendor Transfers page for eligible transfer reconciliation.";
    default:
      return "Action not available.";
  }
}
