import "server-only";

import { env } from "@/lib/env";

export type SquareOrderTotalComparison = {
  ooSubtotalCents: number;
  ooTaxCents: number;
  ooTotalCents: number;
  squareOrderTotalCents: number | null;
  squareExternalPaymentCents: number | null;
  squareTotalDifferenceCents: number | null;
  warnThresholdCents: number;
  blockThresholdCents: number | null;
  mismatchWarning: boolean;
  mismatchBlocked: boolean;
};

export const SQUARE_TOTAL_MISMATCH_ADMIN_COPY =
  "Square calculated a different order total than Open Order. Verify taxes, modifiers, discounts, or catalog prices before relying on Square totals for reconciliation.";

export function parseSquareTotalMismatchWarnCents(raw?: string): number {
  const parsed = Number.parseInt(raw?.trim() ?? "1", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

export function parseSquareTotalMismatchBlockCents(raw?: string): number | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function computeOoVendorFoodTotalCents(input: {
  subtotalCents: number;
  taxCents: number;
}): Pick<SquareOrderTotalComparison, "ooSubtotalCents" | "ooTaxCents" | "ooTotalCents"> {
  return {
    ooSubtotalCents: input.subtotalCents,
    ooTaxCents: input.taxCents,
    ooTotalCents: input.subtotalCents + input.taxCents,
  };
}

export function evaluateSquareOrderTotalComparison(input: {
  subtotalCents: number;
  taxCents: number;
  squareOrderTotalCents?: number | null;
  squareExternalPaymentCents?: number | null;
}): SquareOrderTotalComparison {
  const oo = computeOoVendorFoodTotalCents(input);
  const warnThresholdCents = parseSquareTotalMismatchWarnCents(
    env.SQUARE_TOTAL_MISMATCH_WARN_CENTS
  );
  const blockThresholdCents = parseSquareTotalMismatchBlockCents(
    env.SQUARE_TOTAL_MISMATCH_BLOCK_CENTS
  );

  const squareOrderTotalCents =
    input.squareOrderTotalCents != null && input.squareOrderTotalCents >= 0
      ? input.squareOrderTotalCents
      : null;
  const squareExternalPaymentCents =
    input.squareExternalPaymentCents != null && input.squareExternalPaymentCents >= 0
      ? input.squareExternalPaymentCents
      : null;

  const compareAgainst = squareOrderTotalCents;
  const squareTotalDifferenceCents =
    compareAgainst == null ? null : Math.abs(oo.ooTotalCents - compareAgainst);

  const mismatchWarning =
    squareTotalDifferenceCents != null && squareTotalDifferenceCents >= warnThresholdCents;
  const mismatchBlocked =
    blockThresholdCents != null &&
    squareTotalDifferenceCents != null &&
    squareTotalDifferenceCents >= blockThresholdCents;

  return {
    ...oo,
    squareOrderTotalCents,
    squareExternalPaymentCents,
    squareTotalDifferenceCents,
    warnThresholdCents,
    blockThresholdCents,
    mismatchWarning,
    mismatchBlocked,
  };
}
