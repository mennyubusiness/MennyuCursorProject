import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  isReconcilablePayoutTransfer,
  metadataStrongMatch,
  pickUniqueStripeTransferMatch,
  RECONCILE_ELIGIBLE_STATUSES,
  reconciliationCreatedWindow,
  type StripeTransferMatchInput,
  type VendorPayoutReconciliationRow,
  stripeTransferMatchesVendorPayoutRow,
} from "@/lib/vendor-payout-transfer-reconciliation";
import { VENDOR_PAYOUT_TRANSFER_STATUS } from "@/services/vendor-payout-transfer.service";

export type ReconcileVendorPayoutTransferOutcome =
  | "updated_paid"
  | "already_paid"
  | "unchanged_not_found"
  | "unchanged_ambiguous"
  | "mismatch"
  | "skipped_ineligible"
  | "error";

export type ReconcileVendorPayoutTransferResult = {
  vendorPayoutTransferId: string;
  outcome: ReconcileVendorPayoutTransferOutcome;
  message: string;
  stripeTransferId?: string | null;
  detail?: string;
};

export type ReconcileBulkSummary = {
  checked: number;
  updatedPaid: number;
  unchanged: number;
  notFound: number;
  ambiguous: number;
  mismatched: number;
  errors: number;
  skippedIneligible: number;
  results: ReconcileVendorPayoutTransferResult[];
};

const vendorPayoutTransferReconcileSelect = {
  id: true,
  paymentAllocationId: true,
  vendorOrderId: true,
  vendorId: true,
  destinationAccountId: true,
  amountCents: true,
  currency: true,
  status: true,
  stripeTransferId: true,
  createdAt: true,
  submittedAt: true,
  failedAt: true,
  vendorOrder: { select: { orderId: true } },
} as const;

function toReconciliationRow(
  row: {
    id: string;
    paymentAllocationId: string;
    vendorOrderId: string;
    vendorId: string;
    destinationAccountId: string;
    amountCents: number;
    currency: string;
    status: string;
    stripeTransferId: string | null;
    createdAt: Date;
    submittedAt: Date | null;
    failedAt: Date | null;
    vendorOrder: { orderId: string };
  }
): VendorPayoutReconciliationRow {
  return {
    id: row.id,
    paymentAllocationId: row.paymentAllocationId,
    vendorOrderId: row.vendorOrderId,
    vendorId: row.vendorId,
    orderId: row.vendorOrder.orderId,
    destinationAccountId: row.destinationAccountId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    stripeTransferId: row.stripeTransferId,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt,
    failedAt: row.failedAt,
  };
}

function toMatchInput(tr: Stripe.Transfer): StripeTransferMatchInput {
  return {
    id: tr.id,
    amount: tr.amount,
    currency: tr.currency,
    destination: typeof tr.destination === "string" ? tr.destination : "",
    reversed: Boolean(tr.reversed),
    created: tr.created,
    metadata: (tr.metadata ?? {}) as Record<string, string>,
  };
}

async function stripeTransferIdUsedByOtherRow(
  stripeTransferId: string,
  exceptRowId: string
): Promise<boolean> {
  const other = await prisma.vendorPayoutTransfer.findFirst({
    where: {
      stripeTransferId,
      NOT: { id: exceptRowId },
    },
    select: { id: true },
  });
  return Boolean(other);
}

async function markRowPaidFromStripe(
  rowId: string,
  stripeTransferId: string,
  submittedAt: Date | null
): Promise<void> {
  await prisma.vendorPayoutTransfer.update({
    where: { id: rowId },
    data: {
      status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
      stripeTransferId,
      submittedAt: submittedAt ?? new Date(),
      failureMessage: null,
      failedAt: null,
      blockedReason: null,
    },
  });
}

export async function findMatchingStripeTransferForVendorPayoutTransfer(
  row: VendorPayoutReconciliationRow
): Promise<
  | { kind: "found"; transfer: StripeTransferMatchInput }
  | { kind: "none" }
  | { kind: "ambiguous"; transferIds: string[] }
  | { kind: "error"; message: string }
> {
  if (!env.STRIPE_SECRET_KEY || !stripe) {
    return { kind: "error", message: "Stripe is not configured." };
  }

  if (row.stripeTransferId?.trim()) {
    try {
      const tr = await stripe.transfers.retrieve(row.stripeTransferId.trim());
      const input = toMatchInput(tr);
      const window = reconciliationCreatedWindow(row);
      const check = stripeTransferMatchesVendorPayoutRow(input, row, window);
      if (check.matches) {
        return { kind: "found", transfer: input };
      }
      return { kind: "error", message: check.reason ?? "mismatch" };
    } catch (e) {
      return {
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  const window = reconciliationCreatedWindow(row);
  const candidates: StripeTransferMatchInput[] = [];

  try {
    let startingAfter: string | undefined;
    for (let page = 0; page < 5; page++) {
      const list = await stripe.transfers.list({
        destination: row.destinationAccountId,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        created: { gte: window.gte, lte: window.lte },
      });
      for (const tr of list.data) {
        candidates.push(toMatchInput(tr));
      }
      if (!list.has_more || list.data.length === 0) break;
      startingAfter = list.data[list.data.length - 1]?.id;
    }

    const byGroup = await stripe.transfers.list({
      transfer_group: `order_${row.orderId}`,
      limit: 100,
      created: { gte: window.gte, lte: window.lte },
    });
    for (const tr of byGroup.data) {
      if (!candidates.some((c) => c.id === tr.id)) {
        candidates.push(toMatchInput(tr));
      }
    }
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }

  return pickUniqueStripeTransferMatch(candidates, row);
}

export async function reconcileVendorPayoutTransfer(
  rowId: string
): Promise<ReconcileVendorPayoutTransferResult> {
  const row = await prisma.vendorPayoutTransfer.findUnique({
    where: { id: rowId },
    select: vendorPayoutTransferReconcileSelect,
  });

  if (!row) {
    return {
      vendorPayoutTransferId: rowId,
      outcome: "error",
      message: "Vendor payout transfer not found",
    };
  }

  const reconRow = toReconciliationRow(row);

  if (!isReconcilablePayoutTransfer(reconRow)) {
    return {
      vendorPayoutTransferId: rowId,
      outcome: "skipped_ineligible",
      message: "Row is not eligible for reconciliation",
    };
  }

  if (
    reconRow.status === VENDOR_PAYOUT_TRANSFER_STATUS.paid &&
    reconRow.stripeTransferId?.trim()
  ) {
    const match = await findMatchingStripeTransferForVendorPayoutTransfer(reconRow);
    if (match.kind === "found") {
      return {
        vendorPayoutTransferId: rowId,
        outcome: "already_paid",
        message: "Already marked paid and verified in Stripe",
        stripeTransferId: match.transfer.id,
      };
    }
    if (match.kind === "error") {
      return {
        vendorPayoutTransferId: rowId,
        outcome: "mismatch",
        message: "Local Stripe transfer ID did not match expected amount/destination",
        stripeTransferId: reconRow.stripeTransferId,
        detail: match.message,
      };
    }
  }

  const match = await findMatchingStripeTransferForVendorPayoutTransfer(reconRow);

  if (match.kind === "error") {
    if (reconRow.stripeTransferId?.trim()) {
      return {
        vendorPayoutTransferId: rowId,
        outcome: "mismatch",
        message: "Local Stripe transfer ID did not match expected amount/destination",
        stripeTransferId: reconRow.stripeTransferId,
        detail: match.message,
      };
    }
    return {
      vendorPayoutTransferId: rowId,
      outcome: "error",
      message: match.message,
    };
  }

  if (match.kind === "none") {
    return {
      vendorPayoutTransferId: rowId,
      outcome: "unchanged_not_found",
      message: "No matching Stripe transfer found",
    };
  }

  if (match.kind === "ambiguous") {
    return {
      vendorPayoutTransferId: rowId,
      outcome: "unchanged_ambiguous",
      message: "Multiple possible Stripe transfers found — manual review required",
      detail: match.transferIds.join(", "),
    };
  }

  if (await stripeTransferIdUsedByOtherRow(match.transfer.id, rowId)) {
    return {
      vendorPayoutTransferId: rowId,
      outcome: "unchanged_ambiguous",
      message: "Multiple possible Stripe transfers found — manual review required",
      detail: `Stripe transfer ${match.transfer.id} is linked to another Open Order row`,
    };
  }

  await markRowPaidFromStripe(
    rowId,
    match.transfer.id,
    new Date(match.transfer.created * 1000)
  );

  return {
    vendorPayoutTransferId: rowId,
    outcome: "updated_paid",
    message: `Updated from Stripe transfer ${match.transfer.id}`,
    stripeTransferId: match.transfer.id,
    detail: metadataStrongMatch(match.transfer.metadata, reconRow)
      ? "metadata_match"
      : "conservative_match",
  };
}

export async function reconcileEligibleVendorPayoutTransfers(options?: {
  limit?: number;
}): Promise<ReconcileBulkSummary> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

  const rows = await prisma.vendorPayoutTransfer.findMany({
    where: {
      status: { in: [...RECONCILE_ELIGIBLE_STATUSES] },
      destinationAccountId: { not: "blocked" },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const summary: ReconcileBulkSummary = {
    checked: rows.length,
    updatedPaid: 0,
    unchanged: 0,
    notFound: 0,
    ambiguous: 0,
    mismatched: 0,
    errors: 0,
    skippedIneligible: 0,
    results: [],
  };

  for (const row of rows) {
    const result = await reconcileVendorPayoutTransfer(row.id);
    summary.results.push(result);

    switch (result.outcome) {
      case "updated_paid":
        summary.updatedPaid++;
        break;
      case "already_paid":
        summary.unchanged++;
        break;
      case "unchanged_not_found":
        summary.notFound++;
        summary.unchanged++;
        break;
      case "unchanged_ambiguous":
        summary.ambiguous++;
        summary.unchanged++;
        break;
      case "mismatch":
        summary.mismatched++;
        break;
      case "skipped_ineligible":
        summary.skippedIneligible++;
        break;
      case "error":
        summary.errors++;
        break;
      default:
        break;
    }
  }

  return summary;
}
