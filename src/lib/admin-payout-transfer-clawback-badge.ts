/**
 * Admin-only compact clawback badge for Vendor Transfers list rows.
 */
import type { VendorClawbackSummary } from "@/lib/vendor-clawback-status";
import { isLegacyClawbackReviewClosed } from "@/lib/legacy-clawback-review";

export type TransferClawbackBadgeKind =
  | "pending"
  | "failed"
  | "missing"
  | "recovered"
  | "manual_review"
  | "legacy_review";

export function transferClawbackBadgeLabel(kind: TransferClawbackBadgeKind): string {
  switch (kind) {
    case "pending":
      return "Clawback pending";
    case "failed":
      return "Clawback failed";
    case "missing":
      return "Clawback missing";
    case "recovered":
      return "Clawback recovered";
    case "manual_review":
      return "Manual review";
    case "legacy_review":
      return "Legacy review";
  }
}

export function transferClawbackBadgeClass(kind: TransferClawbackBadgeKind): string {
  switch (kind) {
    case "pending":
      return "bg-amber-100 text-amber-950 ring-amber-200";
    case "failed":
    case "missing":
      return "bg-red-100 text-red-900 ring-red-200";
    case "recovered":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
    case "manual_review":
    case "legacy_review":
      return "bg-violet-100 text-violet-950 ring-violet-200";
  }
}

export function transferClawbackBadgeTitle(kind: TransferClawbackBadgeKind): string {
  switch (kind) {
    case "pending":
      return "Vendor transfer reversal is pending.";
    case "failed":
      return "Vendor transfer reversal failed. Customer refund requires vendor clawback recovery.";
    case "missing":
      return "Customer refund requires vendor transfer reversal.";
    case "recovered":
      return "Vendor clawback recovered via Stripe transfer reversal.";
    case "manual_review":
      return "Partial or non-standard refund after vendor was paid. Automatic vendor reversal is not supported — review manually.";
    case "legacy_review":
      return "Historical refund linkage is incomplete. Review Stripe records manually before clawback action.";
  }
}

export function transferClawbackBadgeFromSummary(input: {
  clawback: VendorClawbackSummary;
  legacyClawbackReviewStatus: string | null;
  unsafeLegacyRefundLinkage: boolean;
}): TransferClawbackBadgeKind | null {
  const { clawback, legacyClawbackReviewStatus, unsafeLegacyRefundLinkage } = input;

  if (clawback.clawbackStatus === "not_needed") return null;

  if (isLegacyClawbackReviewClosed(legacyClawbackReviewStatus)) {
    return null;
  }

  if (clawback.clawbackStatus === "manual_review") {
    return unsafeLegacyRefundLinkage ? "legacy_review" : "manual_review";
  }

  if (
    unsafeLegacyRefundLinkage &&
    clawback.hasMissingReversalSetup
  ) {
    return "legacy_review";
  }

  if (
    clawback.clawbackStatus === "recovered" ||
    (clawback.clawbackRequiredCents > 0 &&
      clawback.clawbackRecoveredCents >= clawback.clawbackRequiredCents)
  ) {
    return "recovered";
  }

  if (clawback.hasFailedReversal || clawback.clawbackStatus === "failed") {
    return "failed";
  }

  if (clawback.hasPendingReversal || clawback.clawbackStatus === "pending") {
    return "pending";
  }

  if (clawback.hasMissingReversalSetup) {
    return "missing";
  }

  return null;
}
