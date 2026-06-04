/**
 * Admin-only: assess whether customer refund evidence is safe enough to prepare vendor transfer reversals.
 */
import type { OrderRefundScope } from "@prisma/client";

export const FULL_SCOPE_REFUND_SCOPES: ReadonlySet<OrderRefundScope> = new Set([
  "full_order",
  "system_cancel",
  "full_vendor_order",
]);

export type PrepareMissingReversalBlockReason =
  | "missing_safe_refund_link"
  | "no_succeeded_order_refund"
  | "no_succeeded_refund_attempt"
  | "refund_ledger_missing"
  | "refund_is_legacy_or_denormalized_only"
  | "partial_refund_manual_review"
  | "transfer_not_paid_via_connect"
  | "unsafe_reversal_amount"
  | "vendor_payout_transfer_not_found_for_order"
  | "duplicate_existing_reversal";

export type RefundEvidenceOrderRefund = {
  id: string;
  vendorOrderId: string | null;
  amountCents: number;
  status: string;
  refundScope: string;
  refundAttemptId: string | null;
  refundAttemptStatus?: string | null;
  stripeRefundId?: string | null;
};

export type RefundEvidenceLegacyAttempt = {
  id: string;
  vendorOrderId: string | null;
  amountCents: number;
  status: string;
  stripeRefundId: string | null;
  hasLinkedOrderRefund: boolean;
  dismissedAsLegacyAt?: Date | null;
};

export type RefundEvidenceInput = {
  orderId: string;
  orderTotalCents: number;
  denormalizedOrderRefundedCents: number;
  ledgerRefundedCents: number;
  legacyRefundedCents: number;
  vendorOrderId: string;
  vendorOrderTotalCents: number;
  orderRefunds: RefundEvidenceOrderRefund[];
  legacyAttempts: RefundEvidenceLegacyAttempt[];
};

export type RefundEvidenceAssessment = {
  hasSafeFullScopeSucceededRefund: boolean;
  safeOrderRefundId: string | null;
  safeRefundAttemptId: string | null;
  prepareBlockReason: PrepareMissingReversalBlockReason | null;
  inconsistentLedger: boolean;
  denormalizedOnlyRefund: boolean;
  hasSucceededOrderRefundRows: boolean;
  hasUnlinkedSucceededOrderRefund: boolean;
  hasSucceededLegacyAttemptOnly: boolean;
  hasPartialSucceededRefundOnly: boolean;
};

export function orderRefundAppliesToVendorTransfer(input: {
  refund: Pick<RefundEvidenceOrderRefund, "vendorOrderId" | "amountCents" | "refundScope">;
  orderTotalCents: number;
  vendorOrderId: string;
  vendorOrderTotalCents: number;
}): boolean {
  const scope = input.refund.refundScope;
  if ((scope === "full_order" || scope === "system_cancel") && !input.refund.vendorOrderId) {
    return input.refund.amountCents === input.orderTotalCents;
  }
  if (scope === "full_vendor_order" && input.refund.vendorOrderId === input.vendorOrderId) {
    return input.refund.amountCents === input.vendorOrderTotalCents;
  }
  return false;
}

export function assessRefundEvidenceForReversalPrep(
  input: RefundEvidenceInput
): RefundEvidenceAssessment {
  const succeededOrderRefunds = input.orderRefunds.filter((r) => r.status === "succeeded");
  const succeededFullScope = succeededOrderRefunds.filter((r) =>
    FULL_SCOPE_REFUND_SCOPES.has(r.refundScope as OrderRefundScope)
  );

  const safeOrderRefund = succeededFullScope.find((refund) => {
    if (!refund.refundAttemptId || refund.refundAttemptStatus !== "succeeded") {
      return false;
    }
    return orderRefundAppliesToVendorTransfer({
      refund,
      orderTotalCents: input.orderTotalCents,
      vendorOrderId: input.vendorOrderId,
      vendorOrderTotalCents: input.vendorOrderTotalCents,
    });
  });

  const unlinkedSucceededFullScope = succeededFullScope.filter((refund) =>
    orderRefundAppliesToVendorTransfer({
      refund,
      orderTotalCents: input.orderTotalCents,
      vendorOrderId: input.vendorOrderId,
      vendorOrderTotalCents: input.vendorOrderTotalCents,
    })
  );

  const hasUnlinkedSucceededOrderRefund = unlinkedSucceededFullScope.some(
    (r) => !r.refundAttemptId || r.refundAttemptStatus !== "succeeded"
  );

  const hasPartialSucceededRefundOnly =
    succeededOrderRefunds.length > 0 &&
    !unlinkedSucceededFullScope.some((r) => r.refundAttemptId && r.refundAttemptStatus === "succeeded") &&
    !safeOrderRefund;

  const legacySucceeded = input.legacyAttempts.filter(
    (a) => a.status === "succeeded" && !a.hasLinkedOrderRefund && !a.dismissedAsLegacyAt
  );
  const hasSucceededLegacyAttemptOnly =
    !safeOrderRefund && legacySucceeded.length > 0 && succeededOrderRefunds.length === 0;

  const inconsistentLedger =
    input.denormalizedOrderRefundedCents > 0 &&
    succeededOrderRefunds.length === 0 &&
    input.ledgerRefundedCents === 0 &&
    input.legacyRefundedCents === 0;

  const denormalizedOnlyRefund =
    input.denormalizedOrderRefundedCents > 0 &&
    !safeOrderRefund &&
    succeededOrderRefunds.length === 0 &&
    legacySucceeded.length === 0;

  let prepareBlockReason: PrepareMissingReversalBlockReason | null = null;
  if (safeOrderRefund) {
    prepareBlockReason = null;
  } else if (hasUnlinkedSucceededOrderRefund) {
    prepareBlockReason = "missing_safe_refund_link";
  } else if (inconsistentLedger || denormalizedOnlyRefund) {
    prepareBlockReason = "refund_is_legacy_or_denormalized_only";
  } else if (succeededOrderRefunds.length === 0 && legacySucceeded.length === 0) {
    prepareBlockReason =
      input.denormalizedOrderRefundedCents > 0 ? "refund_ledger_missing" : "no_succeeded_order_refund";
  } else if (hasPartialSucceededRefundOnly) {
    prepareBlockReason = "partial_refund_manual_review";
  } else if (hasSucceededLegacyAttemptOnly) {
    prepareBlockReason = "no_succeeded_refund_attempt";
  } else if (succeededFullScope.length === 0 && succeededOrderRefunds.length > 0) {
    prepareBlockReason = "partial_refund_manual_review";
  } else {
    prepareBlockReason = "no_succeeded_order_refund";
  }

  return {
    hasSafeFullScopeSucceededRefund: Boolean(safeOrderRefund),
    safeOrderRefundId: safeOrderRefund?.id ?? null,
    safeRefundAttemptId: safeOrderRefund?.refundAttemptId ?? null,
    prepareBlockReason,
    inconsistentLedger,
    denormalizedOnlyRefund,
    hasSucceededOrderRefundRows: succeededOrderRefunds.length > 0,
    hasUnlinkedSucceededOrderRefund,
    hasSucceededLegacyAttemptOnly,
    hasPartialSucceededRefundOnly,
  };
}

export function prepareMissingReversalBlockMessage(reason: PrepareMissingReversalBlockReason): string {
  switch (reason) {
    case "missing_safe_refund_link":
      return "Vendor clawback is required, but Open Order cannot prepare the reversal automatically because the succeeded refund ledger entry is not linked to a succeeded refund attempt. Review the refund record before creating a reversal.";
    case "refund_ledger_missing":
      return "Vendor clawback is required, but Open Order cannot prepare the reversal automatically because no succeeded full-scope refund ledger entry is linked to this order. Review the refund record before creating a reversal.";
    case "refund_is_legacy_or_denormalized_only":
      return "Refund amount is present on the order, but no matching refund ledger row was found. Manual review is required before preparing a vendor reversal.";
    case "no_succeeded_order_refund":
      return "Vendor clawback is required, but Open Order cannot prepare the reversal automatically because no safe succeeded full-scope refund ledger entry is linked to this order. Review the refund record before creating a reversal.";
    case "no_succeeded_refund_attempt":
      return "A legacy refund attempt was detected, but it is not safely linked for automatic reversal preparation. Manual review is required.";
    case "partial_refund_manual_review":
      return "Only a partial or non-standard refund was found. Proportional vendor reversal preparation is not automated — manual review is required.";
    case "transfer_not_paid_via_connect":
      return "Vendor transfer was not paid via Connect, so no transfer reversal can be prepared.";
    case "unsafe_reversal_amount":
      return "The paid vendor transfer amount is not safe to reverse automatically.";
    case "vendor_payout_transfer_not_found_for_order":
      return "Vendor payout transfer was not found for this order.";
    case "duplicate_existing_reversal":
      return "A reversal row already exists for this refund and transfer.";
    default:
      return "Vendor clawback preparation is blocked. Manual review is required.";
  }
}
