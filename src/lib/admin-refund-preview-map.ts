import type { AdminRefundPreviewPayload } from "@/lib/admin-refund-preview.types";
import type { RefundExecutionPlan } from "@/services/refund-calculation.service";

export function toAdminRefundPreviewPayload(
  plan: RefundExecutionPlan
): AdminRefundPreviewPayload {
  const base: AdminRefundPreviewPayload = {
    orderId: plan.orderId,
    vendorOrderId: plan.vendorOrderId,
    refundScope: plan.refundScope,
    customerRefundAmountCents: plan.customerRefundAmountCents,
    remainingOrderRefundableCents: plan.remainingOrderRefundableCents,
    remainingVendorOrderRefundableCents: plan.remainingVendorOrderRefundableCents,
    paymentAllocations: plan.paymentAllocations,
    vendorPayoutTransfers: plan.vendorPayoutTransfers,
    transferReversalRequired: plan.transferReversalRequired,
    transferReversalPossible: plan.transferReversalPossible,
    estimatedTransferReversalAmountCents: plan.estimatedTransferReversalAmountCents,
    platformWouldAbsorbRefund: plan.platformWouldAbsorbRefund,
    platformAbsorptionPermanent: plan.platformAbsorptionPermanent,
    warnings: plan.warnings,
    blockingReasons: plan.blockingReasons,
    idempotencyKey: plan.idempotencyKey,
    hasPendingRefund: plan.hasPendingRefund,
    inFlightRefundReservedCents: plan.inFlightRefundReservedCents,
    staleBlockingRefundAttempts: plan.staleBlockingRefundAttempts,
    inFlightRefundBlockers: plan.inFlightRefundBlockers,
  };
  if (plan.lineItem) {
    base.lineItem = {
      orderLineItemId: plan.lineItem.orderLineItemId,
      itemName: plan.lineItem.itemName,
      purchasedQuantity: plan.lineItem.purchasedQuantity,
      alreadyRefundedQuantity: plan.lineItem.alreadyRefundedQuantity,
      refundableQuantity: plan.lineItem.refundableQuantity,
      requestedQuantity: plan.lineItem.requestedQuantity,
      subtotalRefundedCents: plan.lineItem.subtotalRefundedCents,
      taxRefundedCents: plan.lineItem.taxRefundedCents,
      tipRefundedCents: plan.lineItem.tipRefundedCents,
      serviceFeeRefundedCents: plan.lineItem.serviceFeeRefundedCents,
    };
  }
  return base;
}
