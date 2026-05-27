/**
 * Stripe refund webhook handlers — reconcile OrderRefund ledger from Stripe events.
 */
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { syncRefundFromStripeRefundObject } from "@/services/refund-ledger.service";
import {
  syncTransferReversedFromStripeWebhook,
  type TransferReversedSyncResult,
} from "@/services/stripe-transfer-reversal-webhook.service";

export type { TransferReversedSyncResult };

export type StripeRefundWebhookResult =
  | { handled: true; orderRefundId: string }
  | { handled: false; reason: string };

function refundPayload(refund: Stripe.Refund): Parameters<typeof syncRefundFromStripeRefundObject>[0] {
  return {
    id: refund.id,
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status,
    payment_intent: refund.payment_intent,
    charge: refund.charge,
    metadata: (refund.metadata ?? {}) as Record<string, string>,
  };
}

export async function handleStripeRefundWebhookEvent(
  refund: Stripe.Refund,
  opts?: { stripeRawJson?: Prisma.InputJsonValue }
): Promise<StripeRefundWebhookResult> {
  const result = await syncRefundFromStripeRefundObject(refundPayload(refund), opts);
  if (result.outcome === "synced") {
    return { handled: true, orderRefundId: result.orderRefundId };
  }
  console.warn(
    JSON.stringify({
      event: "stripe_refund_webhook_unmatched",
      stripeRefundId: refund.id,
      reason: result.reason,
      metadata: refund.metadata,
      payment_intent:
        typeof refund.payment_intent === "string"
          ? refund.payment_intent
          : refund.payment_intent?.id,
    })
  );
  return { handled: false, reason: result.reason };
}

/**
 * charge.refunded — sync each refund on the charge (Stripe may send refund.* separately too).
 */
export async function handleChargeRefundedWebhook(
  charge: Stripe.Charge,
  opts?: { stripeRawJson?: Prisma.InputJsonValue }
): Promise<StripeRefundWebhookResult[]> {
  const refunds = charge.refunds?.data ?? [];
  const results: StripeRefundWebhookResult[] = [];
  for (const refund of refunds) {
    results.push(await handleStripeRefundWebhookEvent(refund, opts));
  }
  if (refunds.length === 0) {
    console.warn(
      JSON.stringify({
        event: "stripe_charge_refunded_no_refunds_array",
        chargeId: charge.id,
        amountRefunded: charge.amount_refunded,
      })
    );
  }
  return results;
}

/** transfer.reversed — reconcile reversal rows when matched; log otherwise. */
export async function handleTransferReversedWebhook(
  transfer: Stripe.Transfer
): Promise<TransferReversedSyncResult> {
  const result = await syncTransferReversedFromStripeWebhook(transfer);
  if (result.outcome === "unmatched") {
    console.warn(
      JSON.stringify({
        event: "stripe_transfer_reversed_unmatched",
        transferId: transfer.id,
        reason: result.reason,
        amount: transfer.amount,
        metadata: transfer.metadata,
      })
    );
  } else {
    console.info(
      JSON.stringify({
        event: "stripe_transfer_reversed_synced",
        transferId: transfer.id,
        reversalIds: result.reversalIds,
      })
    );
  }
  return result;
}
