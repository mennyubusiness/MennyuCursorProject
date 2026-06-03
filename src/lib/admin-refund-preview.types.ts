/** JSON shape from POST /api/admin/orders/[orderId]/refunds/preview (client-safe). */
export type AdminRefundPreviewPayload = {
  orderId: string;
  vendorOrderId: string | null;
  refundScope: string;
  customerRefundAmountCents: number;
  remainingOrderRefundableCents: number;
  remainingVendorOrderRefundableCents: number | null;
  paymentAllocations: Array<{
    paymentAllocationId: string;
    paymentId: string;
    vendorOrderId: string;
    grossVendorPayableCents: number;
    allocatedProcessingFeeCents: number;
    netVendorTransferCents: number;
  }>;
  vendorPayoutTransfers: Array<{
    vendorPayoutTransferId: string | null;
    paymentAllocationId: string;
    vendorOrderId: string;
    amountCents: number;
    netVendorTransferCents: number;
    transferStatus: string;
    stripeTransferId: string | null;
    reversalRequired: boolean;
    reversalPossible: boolean;
    estimatedReversalAmountCents: number;
  }>;
  transferReversalRequired: boolean;
  transferReversalPossible: boolean;
  estimatedTransferReversalAmountCents: number;
  platformWouldAbsorbRefund: boolean;
  platformAbsorptionPermanent: boolean;
  warnings: string[];
  blockingReasons: string[];
  idempotencyKey: string;
  hasPendingRefund: boolean;
  inFlightRefundReservedCents: number;
  staleBlockingRefundAttempts: Array<{
    id: string;
    amountCents: number;
    status: string;
    stripeRefundId: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    createdAt: string;
    dismissible: boolean;
    dismissBlockReason: string | null;
  }>;
  lineItem?: {
    orderLineItemId: string;
    itemName: string;
    purchasedQuantity: number;
    alreadyRefundedQuantity: number;
    refundableQuantity: number;
    requestedQuantity: number;
    subtotalRefundedCents: number;
    taxRefundedCents: number;
    tipRefundedCents: number;
    serviceFeeRefundedCents: number;
  };
};
