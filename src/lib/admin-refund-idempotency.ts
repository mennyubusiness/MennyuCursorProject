export type AdminRefundScopeKey =
  | "full_order"
  | "full_vendor_order"
  | "custom_vendor_partial"
  | "line_item_refund";

/** Stable idempotency for admin OrderRefund + RefundAttempt rows. */
export function buildAdminRefundIdempotencyKey(input: {
  scope: AdminRefundScopeKey;
  orderId: string;
  vendorOrderId?: string | null;
  amountCents: number;
  orderLineItemId?: string | null;
  quantity?: number;
}): string {
  if (input.scope === "line_item_refund") {
    return `admin:line_item_refund:${input.orderId}:${input.vendorOrderId ?? "_"}:${input.orderLineItemId ?? "_"}:${input.quantity ?? 0}:${input.amountCents}`;
  }
  return `admin:${input.scope}:${input.orderId}:${input.vendorOrderId ?? "_"}:${input.amountCents}`;
}

/** Stripe API idempotency key (distinct from DB row key). */
export function buildAdminStripeRefundIdempotencyKey(dbIdempotencyKey: string): string {
  return `stripe_${dbIdempotencyKey}`;
}
