/**
 * Shared refund decision layer (Phase 1).
 * Answers whether a refund is required, scope, reason, and auto vs admin review.
 * No Stripe or payment execution; callers use this before building refund flows.
 */

export type RefundScope = "none" | "vendor_order" | "full_order";

export type RefundReason =
  | "customer_cancel"
  | "vendor_denial"
  | "routing_failure_unrecoverable"
  | "partial_order_failure"
  | "admin_manual_resolution"
  | "unknown";

export interface RefundDecision {
  required: boolean;
  scope: RefundScope;
  reason: RefundReason;
  orderId: string;
  vendorOrderId?: string | null;
  canAutoRefund: boolean;
  requiresAdminReview: boolean;
  amountCents?: number;
}

/** Why the refund check is being performed (caller-provided trigger). */
export type RefundTrigger =
  | "customer_cancel_full"
  | "customer_cancel_vendor_order"
  | "vendor_denial"
  | "admin_cancel_vendor_order"
  | "admin_cancel_full"
  | "routing_failure_unrecoverable"
  | "partial_order_failure"
  | "admin_manual_resolution"
  | "recoverable_failure"
  | "unknown";

export type VendorOrderSnapshot = {
  id: string;
  totalCents: number;
  routingStatus: string;
  fulfillmentStatus: string;
};

export type OrderSnapshotForRefund = {
  id: string;
  status: string;
  totalCents: number;
  vendorOrders: VendorOrderSnapshot[];
};

export type RefundContext = {
  orderId: string;
  trigger: RefundTrigger;
  vendorOrderId?: string | null;
  order: OrderSnapshotForRefund;
};

function noRefund(orderId: string, reason: RefundReason = "unknown"): RefundDecision {
  return {
    required: false,
    scope: "none",
    reason,
    orderId,
    canAutoRefund: false,
    requiresAdminReview: false,
  };
}

/**
 * Returns the refund decision for the given context.
 * Uses current product rules: customer cancel before preparation => refund;
 * vendor denial => vendor-portion refund; recoverable failure => no refund yet;
 * unrecoverable => refund affected scope; ambiguous/late-stage => admin review.
 */
export function getRefundDecision(context: RefundContext): RefundDecision {
  const { orderId, trigger, vendorOrderId, order } = context;
  const vos = order.vendorOrders;

  switch (trigger) {
    case "customer_cancel_full": {
      return {
        required: true,
        scope: "full_order",
        reason: "customer_cancel",
        orderId,
        canAutoRefund: true,
        requiresAdminReview: false,
        amountCents: order.totalCents,
      };
    }

    case "customer_cancel_vendor_order": {
      const vo = vendorOrderId ? vos.find((v) => v.id === vendorOrderId) : null;
      if (!vo) return noRefund(orderId, "unknown");
      return {
        required: true,
        scope: "vendor_order",
        reason: "customer_cancel",
        orderId,
        vendorOrderId: vo.id,
        canAutoRefund: true,
        requiresAdminReview: false,
        amountCents: vo.totalCents,
      };
    }

    case "vendor_denial": {
      const vo = vendorOrderId ? vos.find((v) => v.id === vendorOrderId) : null;
      if (!vo) return noRefund(orderId, "unknown");
      return {
        required: true,
        scope: "vendor_order",
        reason: "vendor_denial",
        orderId,
        vendorOrderId: vo.id,
        canAutoRefund: true,
        requiresAdminReview: false,
        amountCents: vo.totalCents,
      };
    }

    case "routing_failure_unrecoverable": {
      const vo = vendorOrderId ? vos.find((v) => v.id === vendorOrderId) : null;
      if (!vo) return noRefund(orderId, "unknown");
      const isOnlyVo = vos.length === 1;
      return {
        required: true,
        scope: isOnlyVo ? "full_order" : "vendor_order",
        reason: "routing_failure_unrecoverable",
        orderId,
        vendorOrderId: vo.id,
        canAutoRefund: false,
        requiresAdminReview: true,
        amountCents: isOnlyVo ? order.totalCents : vo.totalCents,
      };
    }

    case "partial_order_failure": {
      const vo = vendorOrderId ? vos.find((v) => v.id === vendorOrderId) : null;
      if (!vo) return noRefund(orderId, "unknown");
      return {
        required: true,
        scope: "vendor_order",
        reason: "partial_order_failure",
        orderId,
        vendorOrderId: vo.id,
        canAutoRefund: false,
        requiresAdminReview: true,
        amountCents: vo.totalCents,
      };
    }

    case "admin_cancel_vendor_order": {
      const vo = vendorOrderId ? vos.find((v) => v.id === vendorOrderId) : null;
      if (!vo) return noRefund(orderId, "unknown");
      return {
        required: true,
        scope: "vendor_order",
        reason: "admin_manual_resolution",
        orderId,
        vendorOrderId: vo.id,
        canAutoRefund: false,
        requiresAdminReview: true,
        amountCents: vo.totalCents,
      };
    }

    case "admin_cancel_full": {
      return {
        required: true,
        scope: "full_order",
        reason: "admin_manual_resolution",
        orderId,
        canAutoRefund: false,
        requiresAdminReview: true,
        amountCents: order.totalCents,
      };
    }

    case "admin_manual_resolution": {
      if (vendorOrderId) {
        const vo = vos.find((v) => v.id === vendorOrderId);
        return {
          required: true,
          scope: "vendor_order",
          reason: "admin_manual_resolution",
          orderId,
          vendorOrderId: vendorOrderId,
          canAutoRefund: false,
          requiresAdminReview: true,
          amountCents: vo?.totalCents,
        };
      }
      return {
        required: true,
        scope: "full_order",
        reason: "admin_manual_resolution",
        orderId,
        canAutoRefund: false,
        requiresAdminReview: true,
        amountCents: order.totalCents,
      };
    }

    case "recoverable_failure":
      return noRefund(orderId, "unknown");

    case "unknown":
    default:
      return noRefund(orderId, "unknown");
  }
}
