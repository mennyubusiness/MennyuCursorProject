/**
 * Read Stripe balance_transaction.fee for a PaymentIntent.
 *
 * TODO(refund-payout): Partial refunds and Connect transfer reconciliation may require adjusting or
 *   supplementing these snapshots — do not mutate historical payment-time rows silently.
 * TODO(connect-transfers): Use PaymentAllocation.netVendorTransferCents when creating stripe.transfers.
 */
import { fetchPaymentIntentChargeDetails } from "@/services/stripe-payment-charge-details.service";

export function isDevBypassStripePaymentIntentId(paymentIntentId: string): boolean {
  return paymentIntentId.startsWith("dev_bypass_");
}

/**
 * Returns Stripe's processing fee in cents from the charge's balance transaction, or null when
 * unavailable (dev bypass, missing Stripe client, missing BT, or fee not yet populated).
 */
export async function fetchStripeProcessingFeeCents(
  paymentIntentId: string
): Promise<number | null> {
  const details = await fetchPaymentIntentChargeDetails(paymentIntentId);
  return details?.feeCents ?? null;
}

export {
  assertPaymentPayoutSnapshotMatchesLiveFee,
  type PaymentPayoutSnapshotForVerify,
} from "@/domain/payment-payout-snapshot";
