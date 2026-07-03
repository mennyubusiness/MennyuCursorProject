import "server-only";

import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import {
  isReconcilablePodPayoutTransfer,
  pickUniquePodStripeTransferMatch,
  podMetadataStrongMatch,
  podReconciliationCreatedWindow,
  podReconciliationResultMessage,
  stripeTransferMatchesPodPayoutRow,
  type PodPayoutReconciliationRow,
  type StripePodTransferMatchInput,
} from "@/lib/pod-payout-transfer-reconciliation";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";

export type ReconcilePodPayoutTransferOutcome =
  | "updated_paid"
  | "already_paid"
  | "unchanged_not_found"
  | "unchanged_ambiguous"
  | "mismatch"
  | "skipped_ineligible"
  | "error";

export type ReconcilePodPayoutTransferResult = {
  podPayoutTransferId: string;
  outcome: ReconcilePodPayoutTransferOutcome;
  message: string;
  stripeTransferId?: string | null;
  detail?: string;
};

const podPayoutTransferReconcileSelect = {
  id: true,
  podPayoutAllocationId: true,
  podId: true,
  destinationAccountId: true,
  amountCents: true,
  currency: true,
  status: true,
  stripeTransferId: true,
  createdAt: true,
  submittedAt: true,
  paidAt: true,
  failedAt: true,
  podPayoutAllocation: { select: { orderId: true } },
} as const;

function toReconciliationRow(row: {
  id: string;
  podPayoutAllocationId: string;
  podId: string;
  destinationAccountId: string | null;
  amountCents: number;
  currency: string;
  status: string;
  stripeTransferId: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  paidAt: Date | null;
  failedAt: Date | null;
  podPayoutAllocation: { orderId: string };
}): PodPayoutReconciliationRow {
  return {
    id: row.id,
    podPayoutAllocationId: row.podPayoutAllocationId,
    podId: row.podId,
    orderId: row.podPayoutAllocation.orderId,
    destinationAccountId: row.destinationAccountId ?? "",
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    stripeTransferId: row.stripeTransferId,
    createdAt: row.createdAt,
    submittedAt: row.submittedAt,
    paidAt: row.paidAt,
    failedAt: row.failedAt,
  };
}

function toMatchInput(tr: Stripe.Transfer): StripePodTransferMatchInput {
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

async function stripeTransferIdUsedByOtherPodRow(
  stripeTransferId: string,
  exceptRowId: string
): Promise<boolean> {
  const other = await prisma.podPayoutTransfer.findFirst({
    where: {
      stripeTransferId,
      NOT: { id: exceptRowId },
    },
    select: { id: true },
  });
  return Boolean(other);
}

async function markPodRowPaidFromStripe(
  rowId: string,
  stripeTransferId: string,
  submittedAt: Date | null
): Promise<void> {
  const now = new Date();
  await prisma.podPayoutTransfer.update({
    where: { id: rowId },
    data: {
      status: POD_PAYOUT_TRANSFER_STATUS.paid,
      stripeTransferId,
      submittedAt: submittedAt ?? now,
      paidAt: now,
      reconciledAt: now,
      blockedReason: null,
      failureMessage: null,
      failureCode: null,
      failedAt: null,
    },
  });
}

export async function findMatchingStripeTransferForPodPayoutTransfer(
  row: PodPayoutReconciliationRow
): Promise<
  | { kind: "found"; transfer: StripePodTransferMatchInput }
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
      const window = podReconciliationCreatedWindow(row);
      const check = stripeTransferMatchesPodPayoutRow(input, row, window);
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

  const window = podReconciliationCreatedWindow(row);
  const candidates: StripePodTransferMatchInput[] = [];

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

  const metadataMatches = candidates.filter((c) =>
    podMetadataStrongMatch(c.metadata, row)
  );
  if (metadataMatches.length === 1) {
    const check = stripeTransferMatchesPodPayoutRow(metadataMatches[0]!, row, window);
    if (check.matches) {
      return { kind: "found", transfer: metadataMatches[0]! };
    }
  }

  return pickUniquePodStripeTransferMatch(candidates, row, window);
}

export async function reconcilePodPayoutTransfer(
  rowId: string
): Promise<ReconcilePodPayoutTransferResult> {
  const row = await prisma.podPayoutTransfer.findUnique({
    where: { id: rowId },
    select: podPayoutTransferReconcileSelect,
  });

  if (!row) {
    return {
      podPayoutTransferId: rowId,
      outcome: "error",
      message: "Pod payout transfer not found",
    };
  }

  const reconRow = toReconciliationRow(row);

  if (!isReconcilablePodPayoutTransfer(reconRow)) {
    return {
      podPayoutTransferId: rowId,
      outcome: "skipped_ineligible",
      message: podReconciliationResultMessage("skipped_ineligible"),
    };
  }

  if (reconRow.status === POD_PAYOUT_TRANSFER_STATUS.paid && reconRow.stripeTransferId?.trim()) {
    const match = await findMatchingStripeTransferForPodPayoutTransfer(reconRow);
    if (match.kind === "found") {
      return {
        podPayoutTransferId: rowId,
        outcome: "already_paid",
        message: podReconciliationResultMessage("already_paid"),
        stripeTransferId: match.transfer.id,
      };
    }
    if (match.kind === "error") {
      return {
        podPayoutTransferId: rowId,
        outcome: "mismatch",
        message: podReconciliationResultMessage("mismatch"),
        stripeTransferId: reconRow.stripeTransferId,
        detail: match.message,
      };
    }
  }

  const match = await findMatchingStripeTransferForPodPayoutTransfer(reconRow);

  if (match.kind === "error") {
    if (reconRow.stripeTransferId?.trim()) {
      return {
        podPayoutTransferId: rowId,
        outcome: "mismatch",
        message: podReconciliationResultMessage("mismatch"),
        stripeTransferId: reconRow.stripeTransferId,
        detail: match.message,
      };
    }
    return {
      podPayoutTransferId: rowId,
      outcome: "error",
      message: match.message,
    };
  }

  if (match.kind === "none") {
    return {
      podPayoutTransferId: rowId,
      outcome: "unchanged_not_found",
      message: podReconciliationResultMessage("unchanged_not_found"),
    };
  }

  if (match.kind === "ambiguous") {
    return {
      podPayoutTransferId: rowId,
      outcome: "unchanged_ambiguous",
      message: podReconciliationResultMessage("unchanged_ambiguous"),
      detail: match.transferIds.join(", "),
    };
  }

  if (await stripeTransferIdUsedByOtherPodRow(match.transfer.id, rowId)) {
    return {
      podPayoutTransferId: rowId,
      outcome: "unchanged_ambiguous",
      message: podReconciliationResultMessage("unchanged_ambiguous"),
      detail: `Stripe transfer ${match.transfer.id} is linked to another Open Order row`,
    };
  }

  await markPodRowPaidFromStripe(
    rowId,
    match.transfer.id,
    row.submittedAt ?? new Date(match.transfer.created * 1000)
  );

  return {
    podPayoutTransferId: rowId,
    outcome: "updated_paid",
    message: podReconciliationResultMessage("updated_paid"),
    stripeTransferId: match.transfer.id,
  };
}
