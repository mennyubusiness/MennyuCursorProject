/**
 * Pro-rata allocation of Stripe processing fees across vendor slices (largest remainder).
 * Weights = gross vendor payable (subtotal + tax + tip), excluding Mennyu service fee.
 */

export type AllocateProcessingFeeResult = {
  allocatedCents: number[];
  /** True when all weights are zero but totalFeeCents > 0 (do not assign fee to one vendor). */
  zeroWeightWithPositiveFee: boolean;
};

/**
 * Largest-remainder method: exact sum of allocated cents equals totalFeeCents.
 * Tie-break on equal fractional parts: lower index first (deterministic).
 */
export function allocateProcessingFeeLargestRemainder(
  totalFeeCents: number,
  grossVendorPayableWeightsCents: number[]
): AllocateProcessingFeeResult {
  if (!Number.isInteger(totalFeeCents) || totalFeeCents < 0) {
    throw new Error("totalFeeCents must be a non-negative integer");
  }
  const n = grossVendorPayableWeightsCents.length;
  if (n === 0) {
    if (totalFeeCents !== 0) {
      throw new Error("totalFeeCents must be 0 when there are no vendor slices");
    }
    return { allocatedCents: [], zeroWeightWithPositiveFee: false };
  }

  const W = grossVendorPayableWeightsCents.reduce((a, b) => a + b, 0);
  if (W === 0) {
    return {
      allocatedCents: grossVendorPayableWeightsCents.map(() => 0),
      zeroWeightWithPositiveFee: totalFeeCents > 0,
    };
  }

  const exact = grossVendorPayableWeightsCents.map((w) => (totalFeeCents * w) / W);
  const floors = exact.map((q) => Math.floor(q));
  const allocated = [...floors];
  let remainder = totalFeeCents - allocated.reduce((a, b) => a + b, 0);

  const order = exact
    .map((q, i) => ({ i, frac: q - floors[i]! }))
    .sort((a, b) => {
      if (b.frac !== a.frac) return b.frac - a.frac;
      return a.i - b.i;
    });

  for (let k = 0; k < remainder; k++) {
    const idx = order[k % n]!.i;
    allocated[idx] += 1;
  }

  return { allocatedCents: allocated, zeroWeightWithPositiveFee: false };
}

/** net = max(0, gross - allocated) per slice. */
export function netVendorTransferCentsFromGrossAndAllocated(
  grossCents: number[],
  allocatedCents: number[]
): number[] {
  if (grossCents.length !== allocatedCents.length) {
    throw new Error("grossCents and allocatedCents must have the same length");
  }
  return grossCents.map((g, i) => Math.max(0, g - (allocatedCents[i] ?? 0)));
}

/**
 * Full snapshot pipeline used at payment time (see `recordPaymentAndAllocations` in payment.service).
 * `stripeProcessingFeeCents` null → allocate 0 fee (dev bypass).
 */
export function computeVendorOrderPayoutSnapshots(
  grossVendorPayableCentsPerOrder: number[],
  stripeProcessingFeeCents: number | null
): {
  allocatedProcessingFeeCents: number[];
  netVendorTransferCents: number[];
  zeroWeightWithPositiveFee: boolean;
} {
  const feeToAllocate = stripeProcessingFeeCents ?? 0;
  const { allocatedCents, zeroWeightWithPositiveFee } = allocateProcessingFeeLargestRemainder(
    feeToAllocate,
    grossVendorPayableCentsPerOrder
  );
  const netVendorTransferCents = netVendorTransferCentsFromGrossAndAllocated(
    grossVendorPayableCentsPerOrder,
    allocatedCents
  );
  return {
    allocatedProcessingFeeCents: allocatedCents,
    netVendorTransferCents,
    zeroWeightWithPositiveFee,
  };
}
