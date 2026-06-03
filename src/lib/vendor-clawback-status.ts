/**
 * Computed vendor clawback state after customer refunds (admin-only).
 * Clawback = recovering funds from a vendor Connect transfer via Stripe transfer reversal.
 */
import {
  CANCELLED_DUE_TO_REFUND_DISPLAY,
  isCancelledDueToRefundTransfer,
  isPartialRefundManualReviewTransfer,
  PARTIAL_REFUND_MANUAL_REVIEW_DISPLAY,
} from "@/lib/vendor-payout-transfer-refund-eligibility";
import { isVendorConnectTransferPaid } from "@/lib/stripe-money-movement";

export const VENDOR_CLAWBACK_PENDING_ATTENTION_MINUTES = 30;

export type VendorClawbackStatus =
  | "not_needed"
  | "pending"
  | "recovered"
  | "failed"
  | "partially_recovered"
  | "manual_review";

export type VendorClawbackRecommendedAction =
  | "none"
  | "retry_reversal"
  | "run_reversal_batch"
  | "manual_review"
  | "view_payout_transfers";

export type VendorClawbackSummary = {
  clawbackRequiredCents: number;
  clawbackRecoveredCents: number;
  clawbackPendingCents: number;
  clawbackFailedCents: number;
  clawbackStatus: VendorClawbackStatus;
  adminLabel: string;
  adminDetail: string | null;
  adminWarning: string | null;
  hasFailedReversal: boolean;
  hasPendingReversal: boolean;
  hasMissingReversalSetup: boolean;
  recommendedAction: VendorClawbackRecommendedAction;
};

export type VendorClawbackReversalRow = {
  id?: string;
  status: string;
  amountCents: number;
  failureMessage?: string | null;
  createdAt?: Date | string;
  submittedAt?: Date | string | null;
  stripeTransferReversalId?: string | null;
};

export type VendorClawbackInput = {
  transferStatus: string | null;
  stripeTransferId: string | null;
  transferAmountCents: number | null;
  vendorOrderTotalCents: number;
  vendorOrderRefundedCents: number;
  reversals: VendorClawbackReversalRow[];
};

const PENDING_REVERSAL_STATUSES = new Set(["pending", "submitted"]);

function baseSummary(
  overrides: Partial<VendorClawbackSummary> & Pick<VendorClawbackSummary, "clawbackStatus" | "adminLabel">
): VendorClawbackSummary {
  return {
    clawbackRequiredCents: 0,
    clawbackRecoveredCents: 0,
    clawbackPendingCents: 0,
    clawbackFailedCents: 0,
    adminDetail: null,
    adminWarning: null,
    hasFailedReversal: false,
    hasPendingReversal: false,
    hasMissingReversalSetup: false,
    recommendedAction: "none",
    ...overrides,
  };
}

export function vendorClawbackStatusBadgeClass(status: VendorClawbackStatus): string {
  switch (status) {
    case "recovered":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    case "failed":
      return "bg-red-100 text-red-900 ring-red-200";
    case "pending":
      return "bg-amber-100 text-amber-950 ring-amber-200";
    case "partially_recovered":
      return "bg-orange-100 text-orange-950 ring-orange-200";
    case "manual_review":
      return "bg-violet-100 text-violet-950 ring-violet-200";
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function isVendorClawbackAttentionReason(
  reason: string
): reason is "vendor_clawback_failed" | "vendor_clawback_pending" | "vendor_clawback_missing" {
  return (
    reason === "vendor_clawback_failed" ||
    reason === "vendor_clawback_pending" ||
    reason === "vendor_clawback_missing"
  );
}

export function computeVendorClawbackSummary(input: VendorClawbackInput): VendorClawbackSummary {
  const transferStatus = input.transferStatus ?? "missing";

  if (isCancelledDueToRefundTransfer({ status: transferStatus })) {
    return baseSummary({
      clawbackStatus: "not_needed",
      adminLabel: "Vendor transfer cancelled due to refund",
      adminDetail: CANCELLED_DUE_TO_REFUND_DISPLAY,
    });
  }

  if (isPartialRefundManualReviewTransfer({ status: transferStatus })) {
    return baseSummary({
      clawbackStatus: "manual_review",
      adminLabel: "Vendor clawback manual review",
      adminDetail: PARTIAL_REFUND_MANUAL_REVIEW_DISPLAY,
      recommendedAction: "manual_review",
    });
  }

  const paidViaConnect = isVendorConnectTransferPaid(transferStatus, input.stripeTransferId);
  if (!paidViaConnect) {
    return baseSummary({
      clawbackStatus: "not_needed",
      adminLabel: "Vendor clawback not needed",
      adminDetail: "No vendor Connect transfer was sent before the refund.",
    });
  }

  if (input.vendorOrderRefundedCents <= 0) {
    return baseSummary({
      clawbackStatus: "not_needed",
      adminLabel: "Vendor clawback not needed",
      adminDetail: "Customer has not been refunded for this vendor order yet.",
    });
  }

  const required = Math.max(0, input.transferAmountCents ?? 0);
  if (required <= 0) {
    return baseSummary({
      clawbackStatus: "not_needed",
      adminLabel: "Vendor clawback not needed",
    });
  }

  let recovered = 0;
  let pending = 0;
  let failed = 0;
  for (const row of input.reversals) {
    if (row.status === "reversed") recovered += row.amountCents;
    else if (PENDING_REVERSAL_STATUSES.has(row.status)) pending += row.amountCents;
    else if (row.status === "failed") failed += row.amountCents;
  }

  const isPartialVendorRefund =
    input.vendorOrderRefundedCents > 0 &&
    input.vendorOrderRefundedCents < input.vendorOrderTotalCents;
  const missingReversalRows = input.reversals.length === 0;

  if (missingReversalRows) {
    return baseSummary({
      clawbackRequiredCents: required,
      clawbackStatus: "manual_review",
      adminLabel: isPartialVendorRefund
        ? "Vendor clawback manual review"
        : "Vendor clawback setup missing",
      adminDetail: isPartialVendorRefund
        ? "Partial customer refund on a paid vendor Connect transfer. Proportional reversal is not automated — review manually."
        : "Customer was refunded but no transfer reversal row exists. Prepare or execute a reversal manually.",
      adminWarning:
        "Customer was refunded, but Open Order has not recovered this vendor's transferred funds. Retry the transfer reversal or handle manually.",
      hasMissingReversalSetup: true,
      recommendedAction: "manual_review",
    });
  }

  if (failed > 0 && recovered < required) {
    return baseSummary({
      clawbackRequiredCents: required,
      clawbackRecoveredCents: recovered,
      clawbackPendingCents: pending,
      clawbackFailedCents: failed,
      clawbackStatus: "failed",
      adminLabel: "Vendor clawback failed",
      adminDetail: "Stripe transfer reversal failed. Customer refund succeeded separately.",
      adminWarning:
        "Customer was refunded, but Open Order has not recovered this vendor's transferred funds. Retry the transfer reversal or handle manually.",
      hasFailedReversal: true,
      hasPendingReversal: pending > 0,
      recommendedAction: "retry_reversal",
    });
  }

  if (recovered >= required) {
    return baseSummary({
      clawbackRequiredCents: required,
      clawbackRecoveredCents: recovered,
      clawbackPendingCents: pending,
      clawbackFailedCents: failed,
      clawbackStatus: "recovered",
      adminLabel: "Vendor clawback recovered",
      adminDetail: "Transfer reversal completed in Stripe.",
    });
  }

  if (recovered > 0 && recovered < required) {
    return baseSummary({
      clawbackRequiredCents: required,
      clawbackRecoveredCents: recovered,
      clawbackPendingCents: pending,
      clawbackFailedCents: failed,
      clawbackStatus: "partially_recovered",
      adminLabel: "Vendor clawback partially recovered",
      adminDetail: "Some reversal amount recovered; remaining clawback may still be outstanding.",
      hasPendingReversal: pending > 0,
      recommendedAction: pending > 0 ? "run_reversal_batch" : "manual_review",
    });
  }

  if (pending > 0) {
    return baseSummary({
      clawbackRequiredCents: required,
      clawbackRecoveredCents: recovered,
      clawbackPendingCents: pending,
      clawbackFailedCents: failed,
      clawbackStatus: "pending",
      adminLabel: "Vendor clawback pending",
      adminDetail:
        "Transfer reversal prepared or submitted. Customer refund alone does not claw back vendor funds.",
      hasPendingReversal: true,
      recommendedAction: "run_reversal_batch",
    });
  }

  return baseSummary({
    clawbackRequiredCents: required,
    clawbackRecoveredCents: recovered,
    clawbackPendingCents: pending,
    clawbackFailedCents: failed,
    clawbackStatus: "manual_review",
    adminLabel: "Vendor clawback manual review",
    adminDetail: "Review reversal rows for this paid vendor transfer.",
    recommendedAction: "manual_review",
  });
}

export function reversalRowAgeAnchor(row: {
  createdAt?: Date | string;
  submittedAt?: Date | string | null;
}): Date | null {
  const raw = row.submittedAt ?? row.createdAt;
  if (!raw) return null;
  return raw instanceof Date ? raw : new Date(raw);
}

export function isReversalPendingAttentionStale(
  row: { status: string; createdAt?: Date | string; submittedAt?: Date | string | null },
  nowMs: number,
  thresholdMinutes = VENDOR_CLAWBACK_PENDING_ATTENTION_MINUTES
): boolean {
  if (!PENDING_REVERSAL_STATUSES.has(row.status)) return false;
  const anchor = reversalRowAgeAnchor(row);
  if (!anchor) return false;
  return nowMs - anchor.getTime() >= thresholdMinutes * 60 * 1000;
}
