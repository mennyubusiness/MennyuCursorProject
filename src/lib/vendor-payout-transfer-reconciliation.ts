import { INSUFFICIENT_BALANCE_STATUS } from "@/lib/vendor-payout-transfer-failure";

export const BLOCKED_DESTINATION_SENTINEL = "blocked";

export const RECONCILE_ELIGIBLE_STATUSES = [
  "failed",
  INSUFFICIENT_BALANCE_STATUS,
  "pending",
  "submitted",
] as const;

export type VendorPayoutReconciliationRow = {
  id: string;
  paymentAllocationId: string;
  vendorOrderId: string;
  vendorId: string;
  orderId: string;
  destinationAccountId: string;
  amountCents: number;
  currency: string;
  status: string;
  stripeTransferId: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  failedAt: Date | null;
};

export type StripeTransferMatchInput = {
  id: string;
  amount: number;
  currency: string;
  destination: string;
  reversed: boolean;
  created: number;
  metadata: Record<string, string> | null;
};

export function isReconcilablePayoutTransfer(row: {
  status: string;
  destinationAccountId: string;
  stripeTransferId?: string | null;
}): boolean {
  if (row.destinationAccountId === BLOCKED_DESTINATION_SENTINEL) return false;
  if (row.status === "blocked") return false;
  if (row.status === "paid" && row.stripeTransferId?.trim()) return false;
  return (RECONCILE_ELIGIBLE_STATUSES as readonly string[]).includes(row.status);
}

export function reconciliationAnchorDate(row: VendorPayoutReconciliationRow): Date {
  return row.submittedAt ?? row.failedAt ?? row.createdAt;
}

/** Stripe list window: 7 days before anchor through 24h after now. */
export function reconciliationCreatedWindow(row: VendorPayoutReconciliationRow): {
  gte: number;
  lte: number;
} {
  const anchor = reconciliationAnchorDate(row);
  const gte = Math.floor((anchor.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const lte = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);
  return { gte, lte };
}

function metaValue(metadata: Record<string, string> | null, key: string): string | null {
  const v = metadata?.[key];
  return v != null && String(v).trim() !== "" ? String(v).trim() : null;
}

export function metadataStrongMatch(
  metadata: Record<string, string> | null,
  row: Pick<
    VendorPayoutReconciliationRow,
    "id" | "paymentAllocationId" | "vendorOrderId" | "vendorId" | "orderId"
  >
): boolean {
  const rowIds = [
    metaValue(metadata, "openOrderVendorPayoutTransferId"),
    metaValue(metadata, "mennyu_vendor_payout_transfer_id"),
  ].filter(Boolean);
  if (rowIds.some((id) => id === row.id)) return true;

  const allocIds = [
    metaValue(metadata, "paymentAllocationId"),
    metaValue(metadata, "mennyu_payment_allocation_id"),
  ].filter(Boolean);
  if (allocIds.some((id) => id === row.paymentAllocationId)) return true;

  return false;
}

export function metadataContradictsRow(
  metadata: Record<string, string> | null,
  row: Pick<
    VendorPayoutReconciliationRow,
    "id" | "paymentAllocationId" | "vendorOrderId" | "vendorId" | "orderId"
  >
): boolean {
  const ooId = metaValue(metadata, "openOrderVendorPayoutTransferId");
  const legacyId = metaValue(metadata, "mennyu_vendor_payout_transfer_id");
  if (ooId && ooId !== row.id) return true;
  if (legacyId && legacyId !== row.id) return true;

  const alloc = metaValue(metadata, "paymentAllocationId");
  const legacyAlloc = metaValue(metadata, "mennyu_payment_allocation_id");
  if (alloc && alloc !== row.paymentAllocationId) return true;
  if (legacyAlloc && legacyAlloc !== row.paymentAllocationId) return true;

  const vo = metaValue(metadata, "vendorOrderId");
  if (vo && vo !== row.vendorOrderId) return true;

  const vendor = metaValue(metadata, "vendorId");
  if (vendor && vendor !== row.vendorId) return true;

  const order = metaValue(metadata, "orderId");
  if (order && order !== row.orderId) return true;

  return false;
}

export function stripeTransferMatchesVendorPayoutRow(
  transfer: StripeTransferMatchInput,
  row: VendorPayoutReconciliationRow,
  window: { gte: number; lte: number }
): { matches: boolean; reason?: string; strongMetadata?: boolean } {
  if (transfer.reversed) {
    return { matches: false, reason: "transfer_reversed" };
  }
  if (transfer.amount !== row.amountCents) {
    return { matches: false, reason: "amount_mismatch" };
  }
  if (transfer.currency.toLowerCase() !== row.currency.toLowerCase()) {
    return { matches: false, reason: "currency_mismatch" };
  }
  if (transfer.destination !== row.destinationAccountId) {
    return { matches: false, reason: "destination_mismatch" };
  }
  if (transfer.created < window.gte || transfer.created > window.lte) {
    return { matches: false, reason: "outside_time_window" };
  }
  if (metadataContradictsRow(transfer.metadata, row)) {
    return { matches: false, reason: "metadata_contradiction" };
  }

  const strongMetadata = metadataStrongMatch(transfer.metadata, row);
  return { matches: true, strongMetadata };
}

export function pickUniqueStripeTransferMatch(
  candidates: StripeTransferMatchInput[],
  row: VendorPayoutReconciliationRow
): { kind: "found"; transfer: StripeTransferMatchInput } | { kind: "none" } | { kind: "ambiguous"; transferIds: string[] } {
  const window = reconciliationCreatedWindow(row);
  const matching = candidates.filter((t) => stripeTransferMatchesVendorPayoutRow(t, row, window).matches);

  const strong = matching.filter((t) => metadataStrongMatch(t.metadata, row));
  if (strong.length === 1) {
    return { kind: "found", transfer: strong[0]! };
  }
  if (strong.length > 1) {
    return { kind: "ambiguous", transferIds: strong.map((t) => t.id) };
  }

  if (matching.length === 1) {
    return { kind: "found", transfer: matching[0]! };
  }
  if (matching.length > 1) {
    return { kind: "ambiguous", transferIds: matching.map((t) => t.id) };
  }

  return { kind: "none" };
}

export function reconciliationResultMessage(
  outcome: string,
  detail?: string,
  context?: {
    hasCustomerPayment?: boolean;
    platformPayoutPaidOut?: boolean;
  }
): string {
  switch (outcome) {
    case "updated_paid":
      return "Matching vendor Connect transfer found and row was marked paid.";
    case "already_paid":
      return "Already marked paid and verified in Stripe";
    case "unchanged_not_found": {
      const base =
        context?.hasCustomerPayment === false
          ? "No matching Stripe transfer found"
          : "Customer payment exists, but no vendor Connect transfer was found. This vendor payout is still unpaid.";
      if (context?.platformPayoutPaidOut) {
        return `${base} Platform payout to Open Order bank found. This does not count as vendor payment.`;
      }
      return base;
    }
    case "unchanged_ambiguous":
      return "Multiple possible Stripe transfers found — manual review required";
    case "mismatch":
      return detail ?? "Local Stripe transfer ID did not match expected amount/destination";
    case "skipped_ineligible":
      return "Row is not eligible for reconciliation";
    default:
      return detail ?? outcome;
  }
}
