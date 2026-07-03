import { IDEMPOTENCY_MISMATCH_STATUS, INSUFFICIENT_BALANCE_STATUS } from "@/lib/vendor-payout-transfer-failure";
import {
  isPodPayoutCancelledDueToRefundTransfer,
  isPodPayoutPartialRefundReviewTransfer,
} from "@/lib/pod-payout-transfer-refund-eligibility";
import { POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION } from "@/lib/pod-payout-transfer-decision";

export const POD_RECONCILE_ELIGIBLE_STATUSES = [
  "failed",
  INSUFFICIENT_BALANCE_STATUS,
  IDEMPOTENCY_MISMATCH_STATUS,
  "pending",
  "submitted",
] as const;

export type PodPayoutReconciliationRow = {
  id: string;
  podPayoutAllocationId: string;
  podId: string;
  orderId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: string;
  status: string;
  stripeTransferId: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  paidAt: Date | null;
  failedAt: Date | null;
};

export type StripePodTransferMatchInput = {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  reversed: boolean;
  created: number;
  metadata: Record<string, string> | null;
};

export function isReconcilablePodPayoutTransfer(row: {
  status: string;
  destinationAccountId: string | null;
  stripeTransferId?: string | null;
}): boolean {
  if (isPodPayoutCancelledDueToRefundTransfer(row)) return false;
  if (isPodPayoutPartialRefundReviewTransfer(row)) return false;
  if (!row.destinationAccountId || row.destinationAccountId === POD_PAYOUT_TRANSFER_BLOCKED_DESTINATION) {
    return false;
  }
  if (row.status === "blocked") return false;
  if (row.status === "paid" && row.stripeTransferId?.trim()) return false;
  return (POD_RECONCILE_ELIGIBLE_STATUSES as readonly string[]).includes(row.status);
}

export function podReconciliationAnchorDate(row: PodPayoutReconciliationRow): Date {
  return row.paidAt ?? row.submittedAt ?? row.failedAt ?? row.createdAt;
}

export function podReconciliationCreatedWindow(row: PodPayoutReconciliationRow): {
  gte: number;
  lte: number;
} {
  const anchor = podReconciliationAnchorDate(row);
  const gte = Math.floor((anchor.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const lte = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
  return { gte, lte };
}

function metaValue(metadata: Record<string, string> | null, key: string): string | null {
  const v = metadata?.[key];
  return v != null && String(v).trim() !== "" ? String(v).trim() : null;
}

export function podMetadataStrongMatch(
  metadata: Record<string, string> | null,
  row: Pick<PodPayoutReconciliationRow, "id" | "podPayoutAllocationId" | "podId" | "orderId">
): boolean {
  const transferId =
    metaValue(metadata, "openOrderPodPayoutTransferId") ??
    metaValue(metadata, "mennyu_pod_payout_transfer_id");
  if (transferId === row.id) return true;
  const allocationId =
    metaValue(metadata, "podPayoutAllocationId") ??
    metaValue(metadata, "mennyu_pod_payout_allocation_id");
  if (allocationId === row.podPayoutAllocationId) return true;
  const podId = metaValue(metadata, "podId");
  const orderId = metaValue(metadata, "orderId");
  return podId === row.podId && orderId === row.orderId;
}

export function stripeTransferMatchesPodPayoutRow(
  transfer: StripePodTransferMatchInput,
  row: PodPayoutReconciliationRow,
  window: { gte: number; lte: number }
): { matches: boolean; reason?: string } {
  if (transfer.reversed) return { matches: false, reason: "reversed" };
  if (transfer.created < window.gte || transfer.created > window.lte) {
    return { matches: false, reason: "outside_window" };
  }
  if (transfer.destination !== row.destinationAccountId) {
    return { matches: false, reason: "destination_mismatch" };
  }
  if (transfer.amount !== row.amountCents) {
    return { matches: false, reason: "amount_mismatch" };
  }
  if (transfer.currency.toLowerCase() !== row.currency.toLowerCase()) {
    return { matches: false, reason: "currency_mismatch" };
  }
  if (!podMetadataStrongMatch(transfer.metadata, row)) {
    return { matches: false, reason: "metadata_mismatch" };
  }
  return { matches: true };
}

export function pickUniquePodStripeTransferMatch(
  candidates: StripePodTransferMatchInput[],
  row: PodPayoutReconciliationRow,
  window: { gte: number; lte: number }
): { kind: "found"; transfer: StripePodTransferMatchInput } | { kind: "none" } | { kind: "ambiguous"; transferIds: string[] } {
  const matches = candidates.filter((c) => stripeTransferMatchesPodPayoutRow(c, row, window).matches);
  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "found", transfer: matches[0]! };
  return { kind: "ambiguous", transferIds: matches.map((m) => m.id) };
}

export function podReconciliationResultMessage(outcome: string): string {
  switch (outcome) {
    case "updated_paid":
      return "Stripe transfer found — row marked paid.";
    case "already_paid":
      return "Row already marked paid.";
    case "unchanged_not_found":
      return "No matching Stripe transfer found.";
    case "unchanged_ambiguous":
      return "Multiple matching Stripe transfers — manual review required.";
    case "mismatch":
      return "Stripe transfer found but details did not match.";
    case "skipped_ineligible":
      return "Row is not eligible for reconciliation.";
    default:
      return outcome;
  }
}
