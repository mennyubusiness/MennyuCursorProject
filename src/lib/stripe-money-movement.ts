import {
  IDEMPOTENCY_MISMATCH_STATUS,
  INSUFFICIENT_BALANCE_STATUS,
} from "@/lib/vendor-payout-transfer-failure";
import {
  CANCELLED_DUE_TO_REFUND_STATUS,
  isCancelledDueToRefundTransfer,
  isPartialRefundManualReviewTransfer,
  PARTIAL_REFUND_MANUAL_REVIEW_STATUS,
} from "@/lib/vendor-payout-transfer-refund-eligibility";

/** Admin copy — platform bank payout ≠ vendor Connect transfer. */
export const STRIPE_PLATFORM_PAYOUT_NOT_VENDOR_PAYMENT =
  "Stripe payouts to the Open Order bank are not vendor payments. Vendors are paid only when a Stripe Connect transfer (tr_...) is sent to their connected account.";

export const ADMIN_VENDOR_TRANSFERS_PAGE_INTRO =
  "Vendor transfers move funds from Open Order's Stripe platform balance to vendor connected Stripe accounts.";

export const ADMIN_VENDOR_TRANSFERS_BALANCE_NOTE =
  "Transfers without a linked charge (source_transaction) can only be sent from Stripe available balance. Pending charge funds and platform payouts to Open Order's bank do not fund those transfers. When source_transaction is set, Stripe waits for the customer charge to become available.";

export const ADMIN_VENDOR_TRANSFERS_AUTO_TRANSFER_NOTE =
  "Vendor transfers are attempted automatically when a payment succeeds. Use manual batch/retry only for recovery.";

export const ADMIN_ACCOUNTING_CONTEXT_INTRO =
  "Platform payout information explains whether Stripe paid Open Order's bank. It does not determine whether the vendor was paid.";

export const ADMIN_STRIPE_MONEY_MOVEMENT_DEFINITIONS = [
  "Vendor Connect transfer: Open Order → vendor connected Stripe account.",
  "Platform payout: Stripe → Open Order bank account.",
  "Only a Connect transfer with a tr_... ID means the vendor was paid through Stripe.",
] as const;

export const BLOCKED_VENDOR_TRANSFER_STILL_OWED =
  "Customer payment exists, but no vendor Connect transfer has been recorded. Vendor is still owed.";

export const VENDOR_PAID_VIA_CONNECT_LABEL = "vendor paid via Connect";

/** Map internal VendorPayoutTransfer.status to admin-visible label. */
export function adminVendorConnectTransferStatusLabel(status: string): string {
  if (status === "paid") return VENDOR_PAID_VIA_CONNECT_LABEL;
  if (status === CANCELLED_DUE_TO_REFUND_STATUS) {
    return "Cancelled: customer refunded";
  }
  if (status === PARTIAL_REFUND_MANUAL_REVIEW_STATUS) {
    return "Manual review: partial refund";
  }
  if (status === INSUFFICIENT_BALANCE_STATUS) {
    return "Vendor transfer blocked: insufficient Stripe available balance";
  }
  if (status === IDEMPOTENCY_MISMATCH_STATUS) {
    return "Manual review: Stripe idempotency mismatch";
  }
  if (status === "blocked") return "Blocked vendor transfer";
  if (status === "failed") return "Vendor transfer failed";
  if (status === "pending") return "Vendor transfer pending";
  if (status === "submitted") return "Vendor transfer submitted";
  return status;
}

export type PlatformPayoutDisplayStatus =
  | { kind: "unknown"; reason: "no_balance_transaction" | "stripe_unavailable" | "lookup_failed" }
  | { kind: "not_included" }
  | { kind: "pending"; payoutId: string; stripeStatus: string }
  | { kind: "paid_out"; payoutId: string; stripeStatus: string; amountCents: number | null };

export function stripeNetToPlatformCents(
  customerPaymentCents: number,
  stripeProcessingFeeCents: number | null | undefined
): number | null {
  if (stripeProcessingFeeCents == null) return null;
  return customerPaymentCents - stripeProcessingFeeCents;
}

export function isVendorConnectTransferPaid(
  transferStatus: string,
  stripeTransferId?: string | null
): boolean {
  return transferStatus === "paid" && Boolean(stripeTransferId?.trim());
}

/** Amount still owed to vendor via Connect transfer (0 when paid in Stripe). */
export function vendorStillOwedCents(input: {
  transferStatus: string;
  stripeTransferId?: string | null;
  vendorConnectTransferOwedCents: number;
}): number {
  if (isCancelledDueToRefundTransfer({ status: input.transferStatus })) {
    return 0;
  }
  if (isPartialRefundManualReviewTransfer({ status: input.transferStatus })) {
    return 0;
  }
  if (isVendorConnectTransferPaid(input.transferStatus, input.stripeTransferId)) {
    return 0;
  }
  return Math.max(0, input.vendorConnectTransferOwedCents);
}

/** Per vendor slice: Open Order service fee retained from customer payment. */
export function openOrderRetainedFromVendorSlice(serviceFeeCents: number): number {
  return Math.max(0, serviceFeeCents);
}

/** Order-level retained = Stripe net to platform minus sum of vendor net transfer amounts. */
export function openOrderRetainedFromPayment(
  stripeNetToPlatformCents: number | null,
  sumNetVendorTransferCents: number
): number | null {
  if (stripeNetToPlatformCents == null) return null;
  return stripeNetToPlatformCents - sumNetVendorTransferCents;
}

export function platformPayoutDisplayLabel(status: PlatformPayoutDisplayStatus): string {
  switch (status.kind) {
    case "unknown":
      if (status.reason === "no_balance_transaction") {
        return "Unknown (no balance transaction stored)";
      }
      if (status.reason === "lookup_failed") {
        return "Unknown (open order detail for platform payout lookup)";
      }
      if (status.reason === "stripe_unavailable") return "Unknown (Stripe unavailable)";
      return "Unknown";
    case "not_included":
      return "Not yet included in a platform payout";
    case "pending":
      return `Pending platform payout ${status.payoutId} (${status.stripeStatus})`;
    case "paid_out":
      return `Paid out to Open Order bank ${status.payoutId} (${status.stripeStatus})`;
    default:
      return "Unknown";
  }
}

export type VendorLiabilityTotals = {
  vendorOwedCents: number;
  vendorPaidCents: number;
  readyToTransferCents: number;
  blockedInsufficientBalanceCents: number;
  idempotencyMismatchCents: number;
  cancelledDueToRefundCents: number;
  blockedConnectCount: number;
};

/** Short badge label for vendor transfer table rows. */
export function vendorTransferStatusBadgeLabel(status: string): string {
  if (status === "paid") return "vendor paid via Connect";
  if (status === CANCELLED_DUE_TO_REFUND_STATUS) return "cancelled: customer refunded";
  if (status === PARTIAL_REFUND_MANUAL_REVIEW_STATUS) return "manual review: partial refund";
  if (status === "pending" || status === "submitted") return "ready to send";
  if (status === INSUFFICIENT_BALANCE_STATUS) return "blocked: insufficient balance";
  if (status === IDEMPOTENCY_MISMATCH_STATUS) return "manual review";
  if (status === "blocked") return "blocked";
  if (status === "failed") return "failed";
  return status;
}

const OWED_STATUSES = new Set([
  "failed",
  INSUFFICIENT_BALANCE_STATUS,
  IDEMPOTENCY_MISMATCH_STATUS,
  "pending",
  "submitted",
  "blocked",
]);

export function computeVendorLiabilityTotals(
  transfers: Array<{
    status: string;
    amountCents: number;
    destinationAccountId: string;
    stripeTransferId?: string | null;
  }>
): VendorLiabilityTotals {
  let vendorOwedCents = 0;
  let vendorPaidCents = 0;
  let readyToTransferCents = 0;
  let blockedInsufficientBalanceCents = 0;
  let idempotencyMismatchCents = 0;
  let cancelledDueToRefundCents = 0;
  let blockedConnectCount = 0;

  for (const t of transfers) {
    if (isCancelledDueToRefundTransfer({ status: t.status })) {
      cancelledDueToRefundCents += t.amountCents;
      continue;
    }
    if (isPartialRefundManualReviewTransfer({ status: t.status })) {
      continue;
    }
    if (isVendorConnectTransferPaid(t.status, t.stripeTransferId)) {
      vendorPaidCents += t.amountCents;
      continue;
    }
    if (t.status === "pending" || t.status === "submitted") {
      readyToTransferCents += t.amountCents;
      vendorOwedCents += t.amountCents;
      continue;
    }
    if (t.status === INSUFFICIENT_BALANCE_STATUS) {
      blockedInsufficientBalanceCents += t.amountCents;
      vendorOwedCents += t.amountCents;
      continue;
    }
    if (t.status === IDEMPOTENCY_MISMATCH_STATUS) {
      idempotencyMismatchCents += t.amountCents;
      vendorOwedCents += t.amountCents;
      continue;
    }
    if (t.status === "blocked" || t.destinationAccountId === "blocked") {
      if (t.destinationAccountId === "blocked") blockedConnectCount++;
      if (OWED_STATUSES.has(t.status)) vendorOwedCents += t.amountCents;
      continue;
    }
    if (OWED_STATUSES.has(t.status)) {
      vendorOwedCents += t.amountCents;
    }
  }

  return {
    vendorOwedCents,
    vendorPaidCents,
    readyToTransferCents,
    blockedInsufficientBalanceCents,
    idempotencyMismatchCents,
    cancelledDueToRefundCents,
    blockedConnectCount,
  };
}

export type PayoutTransferMoneyContext = {
  customerPaymentCents: number;
  stripeProcessingFeeCents: number | null;
  stripeNetToPlatformCents: number | null;
  vendorConnectTransferOwedCents: number;
  vendorStillOwedCents: number;
  openOrderRetainedCents: number;
  transferStatus: string;
  stripeTransferId: string | null;
  stripeBalanceTransactionId: string | null;
};

export function buildPayoutTransferMoneyContext(input: {
  paymentAmountCents: number;
  stripeProcessingFeeCents: number | null;
  allocationServiceFeeCents: number;
  netVendorTransferCents: number;
  transferStatus: string;
  stripeTransferId: string | null;
  stripeBalanceTransactionId: string | null;
}): PayoutTransferMoneyContext {
  const vendorConnectTransferOwedCents = input.netVendorTransferCents;
  return {
    customerPaymentCents: input.paymentAmountCents,
    stripeProcessingFeeCents: input.stripeProcessingFeeCents,
    stripeNetToPlatformCents: stripeNetToPlatformCents(
      input.paymentAmountCents,
      input.stripeProcessingFeeCents
    ),
    vendorConnectTransferOwedCents,
    vendorStillOwedCents: vendorStillOwedCents({
      transferStatus: input.transferStatus,
      stripeTransferId: input.stripeTransferId,
      vendorConnectTransferOwedCents,
    }),
    openOrderRetainedCents: openOrderRetainedFromVendorSlice(input.allocationServiceFeeCents),
    transferStatus: input.transferStatus,
    stripeTransferId: input.stripeTransferId,
    stripeBalanceTransactionId: input.stripeBalanceTransactionId,
  };
}
