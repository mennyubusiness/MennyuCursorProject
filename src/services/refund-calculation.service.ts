/**
 * Admin refund previews and execution plans (no Stripe / DB mutations).
 */
import type { OrderRefundScope } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  buildAdminRefundIdempotencyKey,
  type AdminRefundScopeKey,
} from "@/lib/admin-refund-idempotency";
import {
  getRemainingOrderRefundableCents,
  getRemainingVendorOrderRefundableCents,
} from "@/services/refund-ledger.service";
import {
  getVendorTransferReversalAmountCents,
} from "@/services/vendor-payout-transfer-reversal.service";
import { VENDOR_PAYOUT_TRANSFER_STATUS } from "@/services/vendor-payout-transfer.service";

export type VendorTransferStatusLabel =
  | "pending"
  | "blocked"
  | "submitted"
  | "paid"
  | "failed"
  | "missing";

export type PaymentAllocationPreviewRow = {
  paymentAllocationId: string;
  paymentId: string;
  vendorOrderId: string;
  grossVendorPayableCents: number;
  allocatedProcessingFeeCents: number;
  netVendorTransferCents: number;
};

export type VendorPayoutTransferPreviewRow = {
  vendorPayoutTransferId: string | null;
  paymentAllocationId: string;
  vendorOrderId: string;
  amountCents: number;
  netVendorTransferCents: number;
  transferStatus: VendorTransferStatusLabel;
  stripeTransferId: string | null;
  reversalRequired: boolean;
  reversalPossible: boolean;
  estimatedReversalAmountCents: number;
};

export type RefundCalculationPreview = {
  orderId: string;
  vendorOrderId: string | null;
  refundScope: OrderRefundScope;
  customerRefundAmountCents: number;
  remainingOrderRefundableCents: number;
  remainingVendorOrderRefundableCents: number | null;
  paymentAllocations: PaymentAllocationPreviewRow[];
  vendorPayoutTransfers: VendorPayoutTransferPreviewRow[];
  transferReversalRequired: boolean;
  transferReversalPossible: boolean;
  estimatedTransferReversalAmountCents: number;
  platformWouldAbsorbRefund: boolean;
  platformAbsorptionPermanent: boolean;
  warnings: string[];
  blockingReasons: string[];
  idempotencyKey: string;
};

export type AssertRefundAllowedInput = {
  scope: AdminRefundScopeKey;
  orderId: string;
  vendorOrderId?: string | null;
  amountCents?: number | null;
  reason: string;
  adminNote?: string | null;
  platformAbsorbsRefund?: boolean;
};

export type RefundExecutionPlan = RefundCalculationPreview & {
  stripePaymentIntentId: string | null;
  paymentId: string | null;
  stripeChargeId: string | null;
};

async function loadOrderFinancialContext(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalCents: true,
      stripePaymentIntentId: true,
      vendorOrders: { select: { id: true, totalCents: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          stripePaymentIntentId: true,
          stripeChargeId: true,
          allocations: {
            select: {
              id: true,
              paymentId: true,
              vendorOrderId: true,
              grossVendorPayableCents: true,
              allocatedProcessingFeeCents: true,
              netVendorTransferCents: true,
              payoutTransfer: {
                select: {
                  id: true,
                  vendorOrderId: true,
                  amountCents: true,
                  status: true,
                  stripeTransferId: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return order;
}

function mapTransferStatus(
  vpt: { status: string; stripeTransferId: string | null } | null | undefined
): VendorTransferStatusLabel {
  if (!vpt) return "missing";
  const s = vpt.status;
  if (s === VENDOR_PAYOUT_TRANSFER_STATUS.pending) return "pending";
  if (s === VENDOR_PAYOUT_TRANSFER_STATUS.blocked) return "blocked";
  if (s === VENDOR_PAYOUT_TRANSFER_STATUS.submitted) return "submitted";
  if (s === VENDOR_PAYOUT_TRANSFER_STATUS.paid) return "paid";
  if (s === VENDOR_PAYOUT_TRANSFER_STATUS.failed) return "failed";
  return "missing";
}

function scopeToOrderRefundScope(scope: AdminRefundScopeKey): OrderRefundScope {
  switch (scope) {
    case "full_order":
      return "full_order";
    case "full_vendor_order":
      return "full_vendor_order";
    case "custom_vendor_partial":
      return "custom_vendor_partial";
  }
}

function filterAllocationsForScope(
  allocations: NonNullable<Awaited<ReturnType<typeof loadOrderFinancialContext>>>["payments"][0]["allocations"],
  scope: AdminRefundScopeKey,
  vendorOrderId: string | null
) {
  if (scope === "full_order") return allocations;
  return allocations.filter((a) => a.vendorOrderId === vendorOrderId);
}

function buildTransferRows(
  allocations: ReturnType<typeof filterAllocationsForScope>,
  fullRefundForReversal: boolean
): VendorPayoutTransferPreviewRow[] {
  return allocations.map((a) => {
    const vpt = a.payoutTransfer;
    const status = mapTransferStatus(vpt);
    const reversalPossible =
      Boolean(vpt?.stripeTransferId?.trim()) &&
      vpt != null &&
      getVendorTransferReversalAmountCents(vpt) > 0;
    const reversalRequired =
      fullRefundForReversal &&
      status === "paid" &&
      reversalPossible;
    return {
      vendorPayoutTransferId: vpt?.id ?? null,
      paymentAllocationId: a.id,
      vendorOrderId: a.vendorOrderId,
      amountCents: vpt?.amountCents ?? a.netVendorTransferCents,
      netVendorTransferCents: a.netVendorTransferCents,
      transferStatus: status,
      stripeTransferId: vpt?.stripeTransferId ?? null,
      reversalRequired,
      reversalPossible,
      estimatedReversalAmountCents: vpt
        ? getVendorTransferReversalAmountCents(vpt)
        : 0,
    };
  });
}

async function buildPreviewBase(input: {
  scope: AdminRefundScopeKey;
  orderId: string;
  vendorOrderId: string | null;
  amountCents: number;
  reason?: string;
  platformAbsorbsRefund?: boolean;
  adminNote?: string | null;
}): Promise<RefundCalculationPreview | null> {
  const order = await loadOrderFinancialContext(input.orderId);
  if (!order) return null;

  const payment = order.payments[0] ?? null;
  const remainingOrder = await getRemainingOrderRefundableCents(input.orderId);
  const remainingVendor =
    input.vendorOrderId != null
      ? await getRemainingVendorOrderRefundableCents(input.vendorOrderId)
      : null;

  const refundScope = scopeToOrderRefundScope(input.scope);
  const idempotencyKey = buildAdminRefundIdempotencyKey({
    scope: input.scope,
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId,
    amountCents: input.amountCents,
  });

  const vendorOrder =
    input.vendorOrderId != null
      ? order.vendorOrders.find((v) => v.id === input.vendorOrderId)
      : null;

  const fullRefundForReversal =
    input.scope === "full_order"
      ? input.amountCents === order.totalCents
      : input.scope === "full_vendor_order" && vendorOrder != null
        ? input.amountCents === vendorOrder.totalCents
        : false;

  const allocations = payment
    ? filterAllocationsForScope(
        payment.allocations,
        input.scope,
        input.vendorOrderId
      )
    : [];

  const vendorPayoutTransfers = buildTransferRows(allocations, fullRefundForReversal);

  const warnings: string[] = [];
  const blockingReasons: string[] = [];

  if (!payment) {
    blockingReasons.push("payment_not_recorded");
  }
  if (!order.stripePaymentIntentId?.trim()) {
    blockingReasons.push("no_payment_intent");
  }

  const paidTransfers = vendorPayoutTransfers.filter((t) => t.transferStatus === "paid");
  const submittedTransfers = vendorPayoutTransfers.filter(
    (t) => t.transferStatus === "submitted"
  );

  const transferReversalRequired = vendorPayoutTransfers.some((t) => t.reversalRequired);
  const transferReversalPossible = vendorPayoutTransfers.some(
    (t) => t.reversalRequired && t.reversalPossible
  );
  const estimatedTransferReversalAmountCents = vendorPayoutTransfers.reduce(
    (s, t) => s + (t.reversalRequired && t.reversalPossible ? t.estimatedReversalAmountCents : 0),
    0
  );

  if (input.scope !== "full_order" && !input.vendorOrderId) {
    blockingReasons.push("vendor_order_id_required");
  }
  if (input.scope !== "full_order" && input.vendorOrderId && !vendorOrder) {
    blockingReasons.push("vendor_order_not_found");
  }

  if (input.amountCents <= 0) {
    blockingReasons.push("amount_must_be_positive");
  }

  if (input.amountCents > remainingOrder) {
    blockingReasons.push(
      `refund_exceeds_order_remaining: remaining=${remainingOrder}, requested=${input.amountCents}`
    );
  }
  if (
    remainingVendor != null &&
    input.vendorOrderId &&
    input.amountCents > remainingVendor
  ) {
    blockingReasons.push(
      `refund_exceeds_vendor_order_remaining: remaining=${remainingVendor}, requested=${input.amountCents}`
    );
  }

  if (input.scope === "full_order" && input.amountCents !== remainingOrder) {
    blockingReasons.push(
      `full_order_refund_must_equal_remaining: remaining=${remainingOrder}, requested=${input.amountCents}`
    );
  }
  if (
    input.scope === "full_vendor_order" &&
    remainingVendor != null &&
    input.amountCents !== remainingVendor
  ) {
    blockingReasons.push(
      `full_vendor_order_refund_must_equal_remaining: remaining=${remainingVendor}, requested=${input.amountCents}`
    );
  }

  if (input.reason !== undefined && !input.reason.trim()) {
    blockingReasons.push("reason_required");
  }

  if (input.scope === "custom_vendor_partial") {
    if (!Number.isInteger(input.amountCents)) {
      blockingReasons.push("amount_must_be_integer_cents");
    }
    if (!input.adminNote?.trim()) {
      blockingReasons.push("admin_note_required_for_custom_partial");
    }
    const paidOrSubmitted = vendorPayoutTransfers.some(
      (t) => t.transferStatus === "paid" || t.transferStatus === "submitted"
    );
    if (paidOrSubmitted && !input.platformAbsorbsRefund) {
      blockingReasons.push(
        "vendor_transfer_already_sent: set platformAbsorbsRefund=true with admin note to refund customer while platform bears cost"
      );
    }
  }

  const platformAbsorptionPermanent =
    Boolean(input.platformAbsorbsRefund) &&
    paidTransfers.length > 0 &&
    input.scope === "custom_vendor_partial";

  const platformWouldAbsorbRefund =
    platformAbsorptionPermanent ||
    (paidTransfers.length > 0 &&
      transferReversalRequired &&
      !transferReversalPossible &&
      Boolean(input.platformAbsorbsRefund));

  if (paidTransfers.length > 0 && transferReversalRequired && !transferReversalPossible) {
    if (!input.platformAbsorbsRefund) {
      blockingReasons.push(
        "vendor_transfer_paid_reversal_unavailable: cannot reverse paid transfer automatically"
      );
    }
  }

  if (
    (platformWouldAbsorbRefund || platformAbsorptionPermanent) &&
    !input.adminNote?.trim()
  ) {
    blockingReasons.push("admin_note_required_when_platform_absorbs");
  }

  if (!fullRefundForReversal && paidTransfers.length > 0 && input.scope !== "custom_vendor_partial") {
    warnings.push(
      "prior_refunds_reduce_scope: transfer reversal only runs for full original order/vendor totals; remaining balance refund will not auto-reverse paid transfers"
    );
  }

  if (submittedTransfers.length > 0) {
    warnings.push(
      "vendor_transfer_submitted: transfer may be in flight; reversal not available until paid"
    );
  }

  if (vendorPayoutTransfers.some((t) => t.transferStatus === "pending")) {
    warnings.push("vendor_transfer_pending: no Stripe reversal needed until transfer is paid");
  }

  if (vendorPayoutTransfers.some((t) => t.transferStatus === "blocked")) {
    warnings.push("vendor_transfer_blocked: vendor was not paid out via Connect");
  }

  return {
    orderId: input.orderId,
    vendorOrderId: input.vendorOrderId,
    refundScope,
    customerRefundAmountCents: input.amountCents,
    remainingOrderRefundableCents: remainingOrder,
    remainingVendorOrderRefundableCents: remainingVendor,
    paymentAllocations: allocations.map((a) => ({
      paymentAllocationId: a.id,
      paymentId: a.paymentId,
      vendorOrderId: a.vendorOrderId,
      grossVendorPayableCents: a.grossVendorPayableCents,
      allocatedProcessingFeeCents: a.allocatedProcessingFeeCents,
      netVendorTransferCents: a.netVendorTransferCents,
    })),
    vendorPayoutTransfers,
    transferReversalRequired,
    transferReversalPossible,
    estimatedTransferReversalAmountCents,
    platformWouldAbsorbRefund,
    platformAbsorptionPermanent,
    warnings,
    blockingReasons,
    idempotencyKey,
  };
}

export async function previewFullOrderRefund(
  orderId: string,
  opts?: { reason?: string }
): Promise<RefundCalculationPreview | null> {
  const remaining = await getRemainingOrderRefundableCents(orderId);
  return buildPreviewBase({
    scope: "full_order",
    orderId,
    vendorOrderId: null,
    amountCents: remaining,
    reason: opts?.reason,
  });
}

export async function previewFullVendorOrderRefund(
  orderId: string,
  vendorOrderId: string,
  opts?: { reason?: string }
): Promise<RefundCalculationPreview | null> {
  const remaining = await getRemainingVendorOrderRefundableCents(vendorOrderId);
  return buildPreviewBase({
    scope: "full_vendor_order",
    orderId,
    vendorOrderId,
    amountCents: remaining,
    reason: opts?.reason,
  });
}

export async function previewCustomVendorOrderRefund(
  orderId: string,
  vendorOrderId: string,
  amountCents: number,
  opts?: { platformAbsorbsRefund?: boolean; adminNote?: string | null; reason?: string }
): Promise<RefundCalculationPreview | null> {
  return buildPreviewBase({
    scope: "custom_vendor_partial",
    orderId,
    vendorOrderId,
    amountCents,
    reason: opts?.reason,
    platformAbsorbsRefund: opts?.platformAbsorbsRefund,
    adminNote: opts?.adminNote,
  });
}

export function assertRefundIsAllowed(
  preview: RefundCalculationPreview,
  input: AssertRefundAllowedInput
): { allowed: true } | { allowed: false; blockingReasons: string[] } {
  const reasons = [...preview.blockingReasons];
  if (!input.reason?.trim()) {
    reasons.push("reason_required");
  }
  if (input.scope === "custom_vendor_partial" && !input.adminNote?.trim()) {
    reasons.push("admin_note_required_for_custom_partial");
  }
  if (preview.platformWouldAbsorbRefund && !input.adminNote?.trim()) {
    reasons.push("admin_note_required_when_platform_absorbs");
  }
  const unique = [...new Set(reasons)];
  if (unique.length > 0) {
    return { allowed: false, blockingReasons: unique };
  }
  return { allowed: true };
}

export async function buildRefundExecutionPlan(
  input: AssertRefundAllowedInput
): Promise<RefundExecutionPlan | null> {
  let preview: RefundCalculationPreview | null;
  switch (input.scope) {
    case "full_order":
      preview = await previewFullOrderRefund(input.orderId, { reason: input.reason });
      break;
    case "full_vendor_order":
      if (!input.vendorOrderId) return null;
      preview = await previewFullVendorOrderRefund(input.orderId, input.vendorOrderId, {
        reason: input.reason,
      });
      break;
    case "custom_vendor_partial":
      if (!input.vendorOrderId || input.amountCents == null) return null;
      preview = await previewCustomVendorOrderRefund(
        input.orderId,
        input.vendorOrderId,
        input.amountCents,
        {
          platformAbsorbsRefund: input.platformAbsorbsRefund,
          adminNote: input.adminNote,
          reason: input.reason,
        }
      );
      break;
  }
  if (!preview) return null;

  const allowed = assertRefundIsAllowed(preview, input);
  if (!allowed.allowed) {
    return {
      ...preview,
      blockingReasons: allowed.blockingReasons,
      stripePaymentIntentId: null,
      paymentId: null,
      stripeChargeId: null,
    };
  }

  const order = await loadOrderFinancialContext(input.orderId);
  const payment = order?.payments[0] ?? null;

  return {
    ...preview,
    blockingReasons: [],
    stripePaymentIntentId:
      payment?.stripePaymentIntentId ?? order?.stripePaymentIntentId ?? null,
    paymentId: payment?.id ?? null,
    stripeChargeId: payment?.stripeChargeId ?? null,
  };
}
