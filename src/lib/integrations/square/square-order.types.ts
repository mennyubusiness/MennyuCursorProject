/** Square Orders API request/response shapes (subset used by Open Order). */

export type SquareMoney = {
  amount: number;
  currency: string;
};

export type SquareOrderLineItemModifier = {
  catalog_object_id: string;
  quantity: string;
};

export type SquareOrderLineItem = {
  quantity: string;
  catalog_object_id: string;
  note?: string;
  modifiers?: SquareOrderLineItemModifier[];
};

export type SquarePickupFulfillment = {
  type: "PICKUP";
  state: "PROPOSED";
  pickup_details: {
    recipient?: {
      display_name?: string;
    };
    note?: string;
    schedule_type?: "ASAP";
  };
};

export type SquareOrderFulfillment = {
  uid?: string;
  type?: string;
  state?: string;
  pickup_details?: {
    recipient?: { display_name?: string };
    note?: string;
    schedule_type?: string;
  };
};

export type SquareOrderSnapshot = {
  id: string;
  location_id?: string;
  state?: string;
  reference_id?: string;
  fulfillments?: SquareOrderFulfillment[];
  total_money?: SquareMoney;
  line_items?: SquareOrderLineItem[];
};

export type SquareOrder = SquareOrderSnapshot;

export type SquareCreateOrderRequest = {
  idempotency_key: string;
  order: {
    location_id: string;
    reference_id?: string;
    source?: { name: string };
    line_items: SquareOrderLineItem[];
    fulfillments?: SquarePickupFulfillment[];
    state?: "OPEN";
  };
};

export type SquareRetrieveOrderResponse = {
  order?: SquareOrderSnapshot;
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
};

export type SquareCreateOrderResponse = {
  order?: SquareOrder;
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
};

export type SquareExternalPaymentDetails = {
  type: "OTHER" | "BANK_TRANSFER" | "CHECK" | "CARD" | "SQUARE_GIFT_CARD";
  source: string;
};

export type SquareCreateExternalPaymentRequest = {
  idempotency_key: string;
  source_id: "EXTERNAL";
  order_id: string;
  amount_money: SquareMoney;
  external_details: SquareExternalPaymentDetails;
  autocomplete?: boolean;
};

export type SquarePayment = {
  id?: string;
  order_id?: string;
  status?: string;
};

export type SquareCreatePaymentResponse = {
  payment?: SquarePayment;
  errors?: Array<{ code?: string; detail?: string; category?: string }>;
};

import type { SquareOrderTotalComparison } from "@/lib/integrations/square/square-order-total-comparison";

export type SquareOrderSubmitAudit = {
  createOrderRequest?: SquareCreateOrderRequest;
  createOrderResponse?: SquareCreateOrderResponse;
  createPaymentRequest?: SquareCreateExternalPaymentRequest;
  createPaymentResponse?: SquareCreatePaymentResponse;
  mappingIssues?: unknown;
  /** Attached when readiness fails with "No active Square item mappings…". No secrets. */
  mappingFailureDiagnostics?: unknown;
  /** Normalized machine-readable failure (readiness / mapping / create_order / create_payment). */
  routingFailure?: unknown;
  squarePaymentId?: string;
  squareOrderState?: string;
  squarePaymentStatus?: string;
  squareLastAttemptAt?: string;
  reconciliation?: SquareOrderTotalComparison;
  paymentOnlyRetry?: boolean;
  statusSync?: SquareWebhookLastApplyRecord;
};

export type SquareWebhookLastApplyOutcome =
  | "applied"
  | "noop_same_status"
  | "ignored_backward"
  | "unmapped_status"
  | "fetch_failed"
  | "validation_failed";

export type SquareWebhookLastApplyRecord = {
  outcome: SquareWebhookLastApplyOutcome;
  processedAt: string;
  applySource: "webhook" | "admin_manual";
  detail?: string;
  squareOrderState?: string | null;
  squareFulfillmentState?: string | null;
  interpretedFulfillment?: string | null;
  interpretedRouting?: string | null;
  proposedFulfillment?: string | null;
  proposedRouting?: string | null;
  currentFulfillment?: string;
  currentRouting?: string;
  squareOrderId?: string | null;
  webhookEventId?: string | null;
  lastError?: string | null;
  externalAudit?: string | null;
};
