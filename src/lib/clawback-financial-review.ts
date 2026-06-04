/**
 * Admin-only: when a vendor Connect transfer needs manual financial review
 * (partial refund, legacy/incomplete refund evidence, etc.).
 */
import type { VendorClawbackSummary } from "@/lib/vendor-clawback-status";
import { isLegacyClawbackReviewClosed } from "@/lib/legacy-clawback-review";

export type VendorFinancialReviewKind = "manual" | "legacy";

export function vendorFinancialReviewKind(input: {
  unsafeLegacyRefundLinkage: boolean;
  prepareBlockReason?: string | null;
}): VendorFinancialReviewKind {
  if (input.unsafeLegacyRefundLinkage) return "legacy";
  if (input.prepareBlockReason === "partial_refund_manual_review") return "manual";
  return "manual";
}

export function vendorNeedsFinancialReview(input: {
  clawback: Pick<VendorClawbackSummary, "clawbackStatus" | "recommendedAction">;
  legacyClawbackReviewStatus: string | null;
  unsafeLegacyRefundLinkage: boolean;
  paidViaConnect: boolean;
}): boolean {
  if (!input.paidViaConnect) return false;
  if (isLegacyClawbackReviewClosed(input.legacyClawbackReviewStatus)) return false;
  if (input.clawback.clawbackStatus !== "manual_review") return false;
  if (input.unsafeLegacyRefundLinkage) return true;
  if (input.clawback.recommendedAction === "manual_review") return true;
  return false;
}

export function financialReviewIssueLabel(kind: VendorFinancialReviewKind): string {
  return kind === "legacy" ? "Legacy review" : "Manual review";
}

export function financialReviewIssueSubcopy(kind: VendorFinancialReviewKind): string {
  return kind === "legacy"
    ? "Historical refund records are incomplete — review manually"
    : "Partial refund — automatic reversal is not supported";
}
