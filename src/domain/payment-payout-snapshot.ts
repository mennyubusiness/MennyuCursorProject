/**
 * Pure checks for persisted payout snapshots (no Stripe / DB imports).
 */

export type PaymentPayoutSnapshotForVerify = {
  id: string;
  stripeProcessingFeeCents: number | null;
  allocations: Array<{ allocatedProcessingFeeCents: number }>;
};

/**
 * Idempotent replay: stored Stripe fee and allocation sums must match freshly fetched fee.
 * Throws on any mismatch — never silently overwrites accounting rows.
 */
export function assertPaymentPayoutSnapshotMatchesLiveFee(
  payment: PaymentPayoutSnapshotForVerify,
  liveFeeCents: number | null
): void {
  const stored = payment.stripeProcessingFeeCents;
  const sumAllocated = payment.allocations.reduce((s, a) => s + a.allocatedProcessingFeeCents, 0);
  const expectedSumFromStored = stored ?? 0;

  if (sumAllocated !== expectedSumFromStored) {
    const msg = `[PAYMENT_ALLOCATED_SUM_MISMATCH] paymentId=${payment.id} sumAllocatedProcessingFeeCents=${sumAllocated} expected=${expectedSumFromStored} (from Payment.stripeProcessingFeeCents)`;
    console.error(msg);
    throw new Error(msg);
  }

  /** Pre–payout-snapshot rows: no stored fee and no allocation; do not fail replays when Stripe reports a fee now. */
  if (stored === null && liveFeeCents !== null && sumAllocated === 0) {
    console.warn(
      `[PAYMENT_STRIPE_FEE_LEGACY_SNAPSHOT] paymentId=${payment.id} liveFeeCents=${liveFeeCents} — historical payment without fee snapshot; idempotent replay allowed.`
    );
    return;
  }

  if (stored !== liveFeeCents) {
    const msg = `[PAYMENT_STRIPE_FEE_MISMATCH] paymentId=${payment.id} storedStripeProcessingFeeCents=${stored} liveBalanceTransactionFeeCents=${liveFeeCents}`;
    console.error(msg);
    throw new Error(msg);
  }
}
