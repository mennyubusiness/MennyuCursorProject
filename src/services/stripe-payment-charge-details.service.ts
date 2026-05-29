/**
 * Resolve Stripe charge + balance transaction identifiers for a PaymentIntent.
 */
import type Stripe from "stripe";
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
