/**
 * Read Stripe balance_transaction.fee for a PaymentIntent.
 *
 * TODO(refund-payout): Partial refunds and Connect transfer reconciliation may require adjusting or
 *   supplementing these snapshots — do not mutate historical payment-time rows silently.
 * TODO(connect-transfers): Use PaymentAllocation.netVendorTransferCents when creating stripe.transfers.
 */
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export function isDevBypassStripePaymentIntentId(paymentIntentId: string): boolean {
  return paymentIntentId.startsWith("dev_bypass_");
}

/**
 * Returns Stripe's processing fee in cents from the charge's balance transaction, or null when
 * unavailable (dev bypass, missing Stripe client, or missing BT — caller may throw in production).
 */
export async function fetchStripeProcessingFeeCents(
  paymentIntentId: string
): Promise<number | null> {
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
    return null;
  }

  const btRaw = (charge as Stripe.Charge).balance_transaction;
  if (btRaw == null) {
    return null;
  }

  if (typeof btRaw === "string") {
    const btx = await stripe.balanceTransactions.retrieve(btRaw);
    return btx.fee;
  }

  return (btRaw as Stripe.BalanceTransaction).fee;
}

export {
  assertPaymentPayoutSnapshotMatchesLiveFee,
  type PaymentPayoutSnapshotForVerify,
} from "@/domain/payment-payout-snapshot";
