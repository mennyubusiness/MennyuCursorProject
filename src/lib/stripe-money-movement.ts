import { INSUFFICIENT_BALANCE_STATUS } from "@/lib/vendor-payout-transfer-failure";

/** Admin copy — platform bank payout ≠ vendor Connect transfer. */
export const STRIPE_PLATFORM_PAYOUT_NOT_VENDOR_PAYMENT =
  "Stripe payouts to the Open Order bank are not vendor payments. Vendors are paid only when a Stripe Connect transfer is created to their connected account.";

export const BLOCKED_VENDOR_TRANSFER_STILL_OWED =
  "This vendor transfer is still owed. The customer payment may already have been paid out to the Open Order bank, but no matching vendor Connect transfer has been recorded.";

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
  blockedInsufficientBalanceCents: number;
  blockedConnectCount: number;
};

const OWED_STATUSES = new Set([
  "failed",
  INSUFFICIENT_BALANCE_STATUS,
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
  let blockedInsufficientBalanceCents = 0;
  let blockedConnectCount = 0;

  for (const t of transfers) {
    if (isVendorConnectTransferPaid(t.status, t.stripeTransferId)) {
      vendorPaidCents += t.amountCents;
      continue;
    }
    if (t.status === INSUFFICIENT_BALANCE_STATUS) {
      blockedInsufficientBalanceCents += t.amountCents;
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
    blockedInsufficientBalanceCents,
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
