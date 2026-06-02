/**
 * Read-only lookup: whether a charge balance transaction was included in a platform bank payout.
 * Explanatory only — never marks vendor transfers paid.
 */
import "server-only";

import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import type { PlatformPayoutDisplayStatus } from "@/lib/stripe-money-movement";

function mapPayoutStatus(
  payout: Stripe.Payout,
  payoutId: string
): PlatformPayoutDisplayStatus {
  const paidOutStatuses = new Set(["paid", "in_transit"]);
  if (paidOutStatuses.has(payout.status)) {
    return {
      kind: "paid_out",
      payoutId,
      stripeStatus: payout.status,
      amountCents: typeof payout.amount === "number" ? payout.amount : null,
    };
  }
  return {
    kind: "pending",
    payoutId,
    stripeStatus: payout.status,
  };
}

async function balanceTransactionInPayout(
  balanceTransactionId: string,
  payoutId: string
): Promise<boolean> {
  if (!stripe) return false;
  let startingAfter: string | undefined;
  for (let page = 0; page < 5; page++) {
    const list = await stripe.balanceTransactions.list({
      payout: payoutId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    if (list.data.some((t) => t.id === balanceTransactionId)) {
      return true;
    }
    if (!list.has_more || list.data.length === 0) break;
    startingAfter = list.data[list.data.length - 1]?.id;
  }
  return false;
}

async function findPlatformPayoutForBalanceTransaction(
  balanceTransactionId: string
): Promise<PlatformPayoutDisplayStatus> {
  if (!stripe) {
    return { kind: "unknown", reason: "stripe_unavailable" };
  }

  try {
    await stripe.balanceTransactions.retrieve(balanceTransactionId.trim());
  } catch {
    return { kind: "unknown", reason: "lookup_failed" };
  }

  let startingAfter: string | undefined;
  for (let page = 0; page < 3; page++) {
    const payouts = await stripe.payouts.list({
      limit: 25,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const payout of payouts.data) {
      const included = await balanceTransactionInPayout(balanceTransactionId, payout.id);
      if (included) {
        return mapPayoutStatus(payout, payout.id);
      }
    }

    if (!payouts.has_more || payouts.data.length === 0) break;
    startingAfter = payouts.data[payouts.data.length - 1]?.id;
  }

  return { kind: "not_included" };
}

export async function lookupPlatformPayoutForBalanceTransaction(
  balanceTransactionId: string | null | undefined,
  options?: { skipStripeLookup?: boolean }
): Promise<PlatformPayoutDisplayStatus> {
  if (!balanceTransactionId?.trim()) {
    return { kind: "unknown", reason: "no_balance_transaction" };
  }
  if (options?.skipStripeLookup) {
    return { kind: "unknown", reason: "lookup_failed" };
  }
  return findPlatformPayoutForBalanceTransaction(balanceTransactionId.trim());
}

export function platformPayoutDisplayForListRow(
  balanceTransactionId: string | null | undefined
): PlatformPayoutDisplayStatus {
  if (!balanceTransactionId?.trim()) {
    return { kind: "unknown", reason: "no_balance_transaction" };
  }
  return { kind: "unknown", reason: "lookup_failed" };
}
