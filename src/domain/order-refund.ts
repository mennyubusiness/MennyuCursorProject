/**
 * Pure refund ledger helpers (no DB / Stripe).
 */
import type { OrderRefundScope, OrderRefundStatus } from "@prisma/client";

export const ORDER_REFUND_SUCCEEDED_STATUS: OrderRefundStatus = "succeeded";

export const COMMITTED_ORDER_REFUND_STATUSES: OrderRefundStatus[] = [
  "succeeded",
  "pending",
  "requires_action",
];

const LEDGER_COMMITTED_STATUSES = COMMITTED_ORDER_REFUND_STATUSES;

export const PAYMENT_REFUND_STATUS = {
  none: "none",
  pending: "pending",
  partial: "partial",
  full: "full",
} as const;

export type PaymentRefundStatusLabel = (typeof PAYMENT_REFUND_STATUS)[keyof typeof PAYMENT_REFUND_STATUS];

function isLedgerCommitted(status: string): boolean {
  return LEDGER_COMMITTED_STATUSES.includes(status as OrderRefundStatus);
}

/** Sum succeeded refund cents (reporting). */
export function computeTotalRefundedCents(input: {
  orderRefunds: Array<{ amountCents: number; status: string }>;
  legacyAttempts: Array<{ amountCents: number; status: string; hasLinkedOrderRefund: boolean }>;
}): { ledgerCents: number; legacyCents: number; totalCents: number } {
  const ledgerCents = input.orderRefunds
    .filter((r) => r.status === ORDER_REFUND_SUCCEEDED_STATUS)
    .reduce((s, r) => s + r.amountCents, 0);
  const legacyCents = input.legacyAttempts
    .filter((a) => a.status === "succeeded" && !a.hasLinkedOrderRefund)
    .reduce((s, a) => s + a.amountCents, 0);
  return { ledgerCents, legacyCents, totalCents: ledgerCents + legacyCents };
}

/** Committed refund cents (succeeded + in-flight) for over-refund prevention. */
export function computeCommittedRefundCents(input: {
  orderRefunds: Array<{ amountCents: number; status: string }>;
  legacyAttempts: Array<{ amountCents: number; status: string; hasLinkedOrderRefund: boolean }>;
}): number {
  const ledger = input.orderRefunds
    .filter((r) => isLedgerCommitted(r.status))
    .reduce((s, r) => s + r.amountCents, 0);
  const legacy = input.legacyAttempts
    .filter(
      (a) =>
        !a.hasLinkedOrderRefund &&
        (a.status === "succeeded" || a.status === "attempted")
    )
    .reduce((s, a) => s + a.amountCents, 0);
  return ledger + legacy;
}

export function computeVendorOrderRefundedCents(input: {
  vendorOrderId: string;
  orderRefunds: Array<{ vendorOrderId: string | null; amountCents: number; status: string }>;
  legacyAttempts: Array<{
    vendorOrderId: string | null;
    amountCents: number;
    status: string;
    hasLinkedOrderRefund: boolean;
  }>;
  /** When true, include pending/attempted amounts (for caps). Default: succeeded only. */
  committed?: boolean;
}): number {
  const ledgerFilter = input.committed ? isLedgerCommitted : (s: string) => s === ORDER_REFUND_SUCCEEDED_STATUS;
  const legacyStatuses = input.committed ? new Set(["succeeded", "attempted"]) : new Set(["succeeded"]);

  const fromLedger = input.orderRefunds
    .filter(
      (r) =>
        ledgerFilter(r.status) &&
        r.vendorOrderId === input.vendorOrderId
    )
    .reduce((s, r) => s + r.amountCents, 0);
  const fromLegacy = input.legacyAttempts
    .filter(
      (a) =>
        legacyStatuses.has(a.status) &&
        !a.hasLinkedOrderRefund &&
        a.vendorOrderId === input.vendorOrderId
    )
    .reduce((s, a) => s + a.amountCents, 0);
  return fromLedger + fromLegacy;
}

export function computeRemainingRefundableCents(
  paidCents: number,
  totalRefundedCents: number
): number {
  return Math.max(0, paidCents - totalRefundedCents);
}

export function derivePaymentRefundStatus(input: {
  paymentAmountCents: number;
  totalRefundedCents: number;
  hasPendingRefund: boolean;
}): PaymentRefundStatusLabel {
  if (input.hasPendingRefund) return PAYMENT_REFUND_STATUS.pending;
  if (input.totalRefundedCents <= 0) return PAYMENT_REFUND_STATUS.none;
  if (input.totalRefundedCents >= input.paymentAmountCents) return PAYMENT_REFUND_STATUS.full;
  return PAYMENT_REFUND_STATUS.partial;
}

export function mapRefundDecisionToScope(input: {
  scope: "full_order" | "vendor_order" | "none";
  reason: string;
}): OrderRefundScope {
  if (input.scope === "full_order") {
    if (input.reason === "customer_cancel") return "system_cancel";
    if (input.reason === "vendor_denial") return "vendor_denial";
    return "full_order";
  }
  if (input.scope === "vendor_order") {
    if (input.reason === "vendor_denial") return "vendor_denial";
    if (input.reason === "customer_cancel") return "system_cancel";
    return "full_vendor_order";
  }
  return "legacy";
}

export function mapStripeRefundStatus(status: string | null | undefined): OrderRefundStatus {
  switch (status) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "pending":
      return "pending";
    case "requires_action":
      return "requires_action";
    default:
      return "pending";
  }
}

export function assertRefundAmountWithinCaps(input: {
  amountCents: number;
  orderPaidCents: number;
  orderRefundedCents: number;
  vendorOrderTotalCents?: number | null;
  vendorOrderRefundedCents?: number | null;
}): void {
  if (input.amountCents <= 0) {
    throw new Error("REFUND_AMOUNT_MUST_BE_POSITIVE");
  }
  const orderRemaining = computeRemainingRefundableCents(
    input.orderPaidCents,
    input.orderRefundedCents // caller passes committed cents for cap checks
  );
  if (input.amountCents > orderRemaining) {
    throw new Error(
      `REFUND_EXCEEDS_ORDER_REMAINING: remaining=${orderRemaining}, requested=${input.amountCents}`
    );
  }
  if (input.vendorOrderTotalCents != null) {
    const voRemaining = computeRemainingRefundableCents(
      input.vendorOrderTotalCents,
      input.vendorOrderRefundedCents ?? 0
    );
    if (input.amountCents > voRemaining) {
      throw new Error(
        `REFUND_EXCEEDS_VENDOR_ORDER_REMAINING: remaining=${voRemaining}, requested=${input.amountCents}`
      );
    }
  }
}
