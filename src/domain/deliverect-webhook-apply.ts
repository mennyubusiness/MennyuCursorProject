/**
 * Types for Deliverect webhook application outcomes (Mennyu vendor order sync).
 */

export type DeliverectWebhookApplyOutcomeResolved =
  | "applied"
  | "noop_same_status"
  | "ignored_backward"
  | "unmapped_status";

/** Persisted on VendorOrder.deliverectWebhookLastApply (JSON). */
export interface DeliverectWebhookLastApplyRecord {
  outcome: DeliverectWebhookApplyOutcomeResolved;
  processedAt: string;
  /** Human-readable detail for admins / logs */
  detail?: string;
  rawNumericCode?: number | null;
  rawEventHint?: string | null;
  /** From strict mapper (when mapped) */
  interpretedFulfillment?: string | null;
  interpretedRouting?: string | null;
  /** After monotonic merge with current VO */
  proposedFulfillment?: string | null;
  proposedRouting?: string | null;
  currentFulfillment?: string;
  currentRouting?: string;
}

export interface DeliverectWebhookApplyResult {
  outcome: DeliverectWebhookApplyOutcomeResolved;
  orderId: string;
  vendorOrderId: string;
  /** True when fulfillment/routing row changed or deliverectOrderId backfilled */
  updatedVendorOrderState: boolean;
}
