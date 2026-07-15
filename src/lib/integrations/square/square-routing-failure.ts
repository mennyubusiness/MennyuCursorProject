/**
 * Normalized Square routing / readiness failure payload for diagnostics.
 * Safe for VendorOrder JSON fields (no tokens/secrets).
 */

export type SquareRoutingFailureStage =
  | "readiness"
  | "cart_preflight"
  | "mapping"
  | "create_order"
  | "create_payment";

export type SquareRoutingFailurePayload = {
  code: string;
  stage: SquareRoutingFailureStage;
  vendorId: string;
  vendorOrderId?: string;
  merchantId?: string | null;
  selectedLocationId?: string | null;
  missingMenuItemIds?: string[];
  missingModifierGroupIds?: string[];
  missingModifierOptionIds?: string[];
  alternateLocationIds?: string[];
  squareOrderId?: string | null;
  idempotencyKey?: string;
  attempt?: number;
  summary: string;
  providerErrors?: unknown;
  occurredAt: string;
};

export function buildSquareRoutingFailurePayload(
  input: Omit<SquareRoutingFailurePayload, "occurredAt"> & { occurredAt?: string }
): SquareRoutingFailurePayload {
  return {
    ...input,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}

export const SQUARE_CART_PREFLIGHT_FAILED = "SQUARE_CART_PREFLIGHT_FAILED";

export const SQUARE_CART_PREFLIGHT_CUSTOMER_MESSAGE =
  "One or more items are no longer available from this vendor. Review your cart before continuing.";
