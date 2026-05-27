export type AdminRefundScopeKey =
  | "full_order"
  | "full_vendor_order"
  | "custom_vendor_partial";

/** Stable idempotency for admin OrderRefund + RefundAttempt rows. */
export function buildAdminRefundIdempotencyKey(input: {
  scope: AdminRefundScopeKey;
  orderId: string;
  vendorOrderId?: string | null;
  amountCents: number;
}): string {
  return `admin:${input.scope}:${input.orderId}:${input.vendorOrderId ?? "_"}:${input.amountCents}`;
}

/** Stripe API idempotency key (distinct from DB row key). */
export function buildAdminStripeRefundIdempotencyKey(dbIdempotencyKey: string): string {
  return `stripe_${dbIdempotencyKey}`;
}
