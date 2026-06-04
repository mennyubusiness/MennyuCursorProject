/**
 * Vendor Transfers page: client-side row classification for operational sections.
 * Presentation only — does not change transfer/reversal execution logic.
 */
import type { TransferClawbackBadgeKind } from "@/lib/admin-payout-transfer-clawback-badge";
import { isLegacyClawbackReviewClosed } from "@/lib/legacy-clawback-review";
import {
  financialReviewIssueLabel,
  financialReviewIssueSubcopy,
} from "@/lib/clawback-financial-review";
import {
  isIdempotencyMismatchTransfer,
  isInsufficientBalanceTransfer,
  isRetryablePayoutTransfer,
} from "@/lib/vendor-payout-transfer-failure";
import {
  CANCELLED_DUE_TO_REFUND_STATUS,
  isCancelledDueToRefundTransfer,
  isPartialRefundManualReviewTransfer,
} from "@/lib/vendor-payout-transfer-refund-eligibility";
import { isVendorConnectTransferPaid } from "@/lib/stripe-money-movement";

export const RECENTLY_SENT_TRANSFER_LIMIT = 15;

export type PayoutTransferRowLike = {
  id: string;
  status: string;
  amountCents: number;
  createdAt: string;
  submittedAt: string | null;
  stripeTransferId: string | null;
  destinationAccountId: string;
  blockedReason: string | null;
  failureMessage: string | null;
  clawbackBadge: TransferClawbackBadgeKind | null;
  legacyClawbackReviewStatus?: string | null;
  financialReviewKind?: "manual" | "legacy" | null;
};

export type TransferReversalRowLike = {
  id: string;
  status: string;
  amountCents: number;
  createdAt: string;
};

export function clawbackBadgeNeedsAction(kind: TransferClawbackBadgeKind | null): boolean {
  return (
    kind === "missing" ||
    kind === "failed" ||
    kind === "pending" ||
    kind === "manual_review" ||
    kind === "legacy_review"
  );
}

export function transferShowsFinancialReviewActions(row: PayoutTransferRowLike): boolean {
  if (row.clawbackBadge !== "manual_review" && row.clawbackBadge !== "legacy_review") {
    return false;
  }
  return !isLegacyClawbackReviewClosed(row.legacyClawbackReviewStatus);
}

export function transferNeedsAction(row: PayoutTransferRowLike): boolean {
  if (isCancelledDueToRefundTransfer(row)) return false;
  if (row.clawbackBadge === "manual_review" || row.clawbackBadge === "legacy_review") {
    return transferShowsFinancialReviewActions(row);
  }
  if (clawbackBadgeNeedsAction(row.clawbackBadge)) return true;
  if (row.status === "pending" || row.status === "submitted") return true;
  if (isInsufficientBalanceTransfer(row)) return true;
  if (isIdempotencyMismatchTransfer(row)) return true;
  if (isPartialRefundManualReviewTransfer(row)) return true;
  if (row.status === "failed") return true;
  if (row.status === "blocked" || row.destinationAccountId === "blocked") return true;
  return false;
}

export function reversalNeedsAction(row: TransferReversalRowLike): boolean {
  return row.status === "pending" || row.status === "submitted" || row.status === "failed";
}

export function reversalIsRecoveredHistory(row: TransferReversalRowLike): boolean {
  return row.status === "reversed";
}

export function transferIssueLabel(row: PayoutTransferRowLike): string {
  if (clawbackBadgeNeedsAction(row.clawbackBadge)) {
    switch (row.clawbackBadge) {
      case "missing":
        return "Clawback missing";
      case "failed":
        return "Clawback failed";
      case "pending":
        return "Clawback pending";
      case "manual_review":
        return financialReviewIssueLabel(row.financialReviewKind ?? "manual");
      case "legacy_review":
        return financialReviewIssueLabel("legacy");
      default:
        break;
    }
  }
  if (row.status === "pending" || row.status === "submitted") return "Ready to send";
  if (isInsufficientBalanceTransfer(row)) return "Blocked: insufficient balance";
  if (isIdempotencyMismatchTransfer(row)) return "Blocked: idempotency mismatch";
  if (isPartialRefundManualReviewTransfer(row)) return "Manual review required";
  if (row.status === "failed") return "Transfer failed";
  if (row.status === "blocked" || row.destinationAccountId === "blocked") {
    return "Transfer blocked";
  }
  return "Needs attention";
}

export function transferRecommendedAction(row: PayoutTransferRowLike): string {
  if (row.clawbackBadge === "missing") return "Prepare vendor reversal on order";
  if (row.clawbackBadge === "failed") return "Retry reversal";
  if (row.clawbackBadge === "pending") return "Run reversal batch";
  if (row.clawbackBadge === "manual_review" || row.clawbackBadge === "legacy_review") {
    return financialReviewIssueSubcopy(row.financialReviewKind ?? "manual");
  }
  if (row.status === "pending" || row.status === "submitted") return "Run vendor transfer batch";
  if (isInsufficientBalanceTransfer(row)) return "Wait for available balance or refresh";
  if (isIdempotencyMismatchTransfer(row)) return "Reconcile with Stripe, then retry";
  if (isPartialRefundManualReviewTransfer(row)) return "Review order refunds";
  if (isRetryablePayoutTransfer(row)) return "Retry vendor transfer";
  if (row.status === "blocked") return "Review vendor Connect setup";
  return "Review order";
}

export function reversalIssueLabel(row: TransferReversalRowLike): string {
  if (row.status === "failed") return "Clawback failed";
  if (row.status === "pending" || row.status === "submitted") return "Clawback pending";
  return "Clawback";
}

export function reversalRecommendedAction(row: TransferReversalRowLike): string {
  if (row.status === "failed") return "Retry reversal";
  if (row.status === "pending" || row.status === "submitted") return "Run reversal batch";
  return "Review order";
}

export function countRetryableTransfers(transfers: PayoutTransferRowLike[]): number {
  return transfers.filter((t) => isRetryablePayoutTransfer(t)).length;
}

export function countActionItems(
  transfers: PayoutTransferRowLike[],
  reversals: TransferReversalRowLike[]
): number {
  return (
    transfers.filter((t) => transferNeedsAction(t)).length +
    reversals.filter((r) => reversalNeedsAction(r)).length
  );
}

export function isRecentlySentTransfer(row: PayoutTransferRowLike): boolean {
  if (!isVendorConnectTransferPaid(row.status, row.stripeTransferId)) return false;
  if (transferNeedsAction(row)) return false;
  return true;
}

export function sortBySentDateDesc<T extends { submittedAt: string | null; createdAt: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.submittedAt ?? a.createdAt).getTime();
    const tb = new Date(b.submittedAt ?? b.createdAt).getTime();
    return tb - ta;
  });
}

export type SectionQuickFilter =
  | "default"
  | "needs_action"
  | "ready"
  | "blocked"
  | "clawbacks"
  | "cancelled"
  | "sent"
  | "all";

export function transferMatchesQuickFilter(
  row: PayoutTransferRowLike,
  filter: SectionQuickFilter
): boolean {
  if (filter === "all" || filter === "default") return true;
  if (filter === "needs_action") return transferNeedsAction(row);
  if (filter === "cancelled") return isCancelledDueToRefundTransfer(row);
  if (filter === "sent") return isRecentlySentTransfer(row);
  if (filter === "clawbacks") return clawbackBadgeNeedsAction(row.clawbackBadge);
  if (filter === "ready") {
    return (
      !isCancelledDueToRefundTransfer(row) &&
      (row.status === "pending" || row.status === "submitted")
    );
  }
  if (filter === "blocked") {
    return (
      !isCancelledDueToRefundTransfer(row) &&
      (isInsufficientBalanceTransfer(row) ||
        isIdempotencyMismatchTransfer(row) ||
        isPartialRefundManualReviewTransfer(row) ||
        row.status === "blocked" ||
        row.destinationAccountId === "blocked")
    );
  }
  return true;
}

export function countClawbacksNeedingAction(
  transfers: PayoutTransferRowLike[],
  reversals: TransferReversalRowLike[]
): number {
  const fromTransfers = transfers.filter((t) => clawbackBadgeNeedsAction(t.clawbackBadge)).length;
  const fromReversals = reversals.filter((r) => reversalNeedsAction(r)).length;
  return fromTransfers + fromReversals;
}

export function manualReviewTransferCount(transfers: PayoutTransferRowLike[]): number {
  return transfers.filter(
    (t) =>
      !isCancelledDueToRefundTransfer(t) &&
      (isPartialRefundManualReviewTransfer(t) || isIdempotencyMismatchTransfer(t))
  ).length;
}

export function blockedTransferCount(transfers: PayoutTransferRowLike[]): number {
  return transfers.filter(
    (t) =>
      !isCancelledDueToRefundTransfer(t) &&
      (isInsufficientBalanceTransfer(t) ||
        t.status === "blocked" ||
        t.destinationAccountId === "blocked")
  ).length;
}

export function readyTransferCount(transfers: PayoutTransferRowLike[]): number {
  return transfers.filter(
    (t) =>
      !isCancelledDueToRefundTransfer(t) &&
      (t.status === "pending" || t.status === "submitted")
  ).length;
}

/** Subtle badge styling for recovered clawback on history rows. */
export function clawbackBadgeClassForContext(
  kind: TransferClawbackBadgeKind,
  urgent: boolean
): string {
  if (!urgent && kind === "recovered") {
    return "bg-emerald-50/80 text-emerald-800 ring-emerald-100";
  }
  return "";
}

export { CANCELLED_DUE_TO_REFUND_STATUS };
