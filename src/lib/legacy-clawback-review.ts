/**
 * Admin-only: persistence statuses for historical vendor clawback review (not customer-facing).
 */

export const LEGACY_CLAWBACK_REVIEW_STATUSES = ["reviewed", "deferred"] as const;
export type LegacyClawbackReviewStatus = (typeof LEGACY_CLAWBACK_REVIEW_STATUSES)[number];

export function isLegacyClawbackReviewClosed(status: string | null | undefined): boolean {
  return status === "reviewed" || status === "deferred";
}

export const LEGACY_CLAWBACK_REVIEW_EXPLANATION =
  "This historical order appears refunded and the vendor was paid via Connect, but Open Order cannot safely prepare a transfer reversal because the refund ledger linkage is incomplete. Review the Stripe records manually before taking financial action.";

export function legacyClawbackReviewStatusLabel(status: string | null | undefined): string {
  if (status === "reviewed") return "Reviewed";
  if (status === "deferred") return "Deferred";
  return "Open";
}
