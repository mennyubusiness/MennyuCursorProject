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
  /** Distinguishes webhook vs admin/API reconciliation fallback in audit JSON. */
  applySource?: "webhook" | "fallback";
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
  /** First webhook that set lastExternalStatusAt (POS signal). */
  firstExternalSignal?: boolean;
  /** Minutes between deliverectSubmittedAt and this apply (ops / audit). */
  minutesAfterDeliverectSubmit?: number | null;
  /** True if first POS signal arrived after DELIVERECT_RECONCILIATION_STALE_MINUTES window. */
  reconciledAfterStaleThreshold?: boolean;
}

export interface DeliverectWebhookApplyResult {
  outcome: DeliverectWebhookApplyOutcomeResolved;
  orderId: string;
  vendorOrderId: string;
  /** True when fulfillment/routing row changed or deliverectOrderId backfilled */
  updatedVendorOrderState: boolean;
}
