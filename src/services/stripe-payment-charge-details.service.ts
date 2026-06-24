/**
 * Resolve Stripe charge + balance transaction identifiers for a PaymentIntent.
 */
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { isDevBypassStripePaymentIntentId } from "@/services/stripe-processing-fee.service";

export type PaymentIntentChargeDetails = {
  chargeId: string | null;
  balanceTransactionId: string | null;
  feeCents: number | null;
};

export async function fetchPaymentIntentChargeDetails(
  paymentIntentId: string
): Promise<PaymentIntentChargeDetails | null> {
  if (isDevBypassStripePaymentIntentId(paymentIntentId)) {
    return null;
  }
  if (!stripe) {
    return null;
  }

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });

  const charge = pi.latest_charge;
  if (!charge || typeof charge === "string") {
    return { chargeId: null, balanceTransactionId: null, feeCents: null };
  }

  const chargeObj = charge as Stripe.Charge;
  const chargeId = chargeObj.id ?? null;

  const btRaw = chargeObj.balance_transaction;
  if (btRaw == null) {
    return { chargeId, balanceTransactionId: null, feeCents: null };
  }

  if (typeof btRaw === "string") {
    const btx = await stripe.balanceTransactions.retrieve(btRaw);
    return {
      chargeId,
      balanceTransactionId: btx.id,
      feeCents: typeof btx.fee === "number" ? btx.fee : null,
    };
  }

  const btx = btRaw as Stripe.BalanceTransaction;
  return {
    chargeId,
    balanceTransactionId: btx.id,
    feeCents: typeof btx.fee === "number" ? btx.fee : null,
  };
}

/** Backfill Payment.stripeChargeId from Stripe when missing (e.g. deferred fee capture). */
export async function resolvePaymentStripeChargeId(paymentId: string): Promise<string | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { stripeChargeId: true, stripePaymentIntentId: true },
  });
  if (!payment) return null;
  const existing = payment.stripeChargeId?.trim();
  if (existing) return existing;

  const details = await fetchPaymentIntentChargeDetails(payment.stripePaymentIntentId);
  if (!details?.chargeId) return null;

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      stripeChargeId: details.chargeId,
      ...(details.balanceTransactionId
        ? { stripeBalanceTransactionId: details.balanceTransactionId }
        : {}),
    },
  });
  return details.chargeId;
}
