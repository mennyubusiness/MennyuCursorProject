import type { AdminRefundScopeKey } from "@/lib/admin-refund-idempotency";

export type AdminRefundRequestBody = {
  scope: AdminRefundScopeKey;
  vendorOrderId?: string | null;
  orderLineItemId?: string | null;
  quantity?: number | null;
  amountCents?: number | null;
  reason: string;
  adminNote?: string | null;
  customerVisibleNote?: string | null;
  platformAbsorbsRefund?: boolean | null;
  linkedOrderIssueId?: string | null;
  includeTax?: boolean | null;
  includeTip?: boolean | null;
  includeServiceFee?: boolean | null;
};

export type ParseAdminRefundBodyResult =
  | { ok: true; data: AdminRefundRequestBody }
  | { ok: false; error: string };

const SCOPES: AdminRefundScopeKey[] = [
  "full_order",
  "full_vendor_order",
  "custom_vendor_partial",
  "line_item_refund",
];

export function parseAdminRefundRequestBody(body: unknown): ParseAdminRefundBodyResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const scope = b.scope;
  if (typeof scope !== "string" || !SCOPES.includes(scope as AdminRefundScopeKey)) {
    return {
      ok: false,
      error:
        "scope must be full_order, full_vendor_order, custom_vendor_partial, or line_item_refund",
    };
  }
  const reason = b.reason;
  if (typeof reason !== "string" || !reason.trim()) {
    return { ok: false, error: "reason is required" };
  }
  const vendorOrderId =
    b.vendorOrderId === null || b.vendorOrderId === undefined
      ? null
      : typeof b.vendorOrderId === "string"
        ? b.vendorOrderId.trim() || null
        : null;
  if (scope !== "full_order" && !vendorOrderId) {
    return { ok: false, error: "vendorOrderId is required for vendor-scoped refunds" };
  }

  const orderLineItemId =
    b.orderLineItemId === null || b.orderLineItemId === undefined
      ? null
      : typeof b.orderLineItemId === "string"
        ? b.orderLineItemId.trim() || null
        : null;

  let quantity: number | null = null;
  if (b.quantity != null) {
    if (typeof b.quantity !== "number" || !Number.isInteger(b.quantity)) {
      return { ok: false, error: "quantity must be a positive integer" };
    }
    quantity = b.quantity;
  }

  if (scope === "line_item_refund") {
    if (!orderLineItemId) {
      return { ok: false, error: "orderLineItemId is required for line_item_refund" };
    }
    if (quantity == null || quantity <= 0) {
      return { ok: false, error: "quantity is required and must be a positive integer" };
    }
  }

  let amountCents: number | null = null;
  if (b.amountCents != null) {
    if (typeof b.amountCents !== "number" || !Number.isInteger(b.amountCents)) {
      return { ok: false, error: "amountCents must be an integer" };
    }
    amountCents = b.amountCents;
  }
  if (scope === "custom_vendor_partial" && amountCents == null) {
    return { ok: false, error: "amountCents is required for custom_vendor_partial" };
  }

  const adminNote =
    typeof b.adminNote === "string" ? b.adminNote : b.adminNote == null ? null : null;
  const customerVisibleNote =
    typeof b.customerVisibleNote === "string"
      ? b.customerVisibleNote
      : b.customerVisibleNote == null
        ? null
        : null;
  const platformAbsorbsRefund = b.platformAbsorbsRefund === true;
  const linkedOrderIssueId =
    b.linkedOrderIssueId === null || b.linkedOrderIssueId === undefined
      ? null
      : typeof b.linkedOrderIssueId === "string"
        ? b.linkedOrderIssueId.trim() || null
        : null;

  const includeTax = b.includeTax !== false;
  const includeTip = b.includeTip === true;
  const includeServiceFee = b.includeServiceFee === true;

  if (platformAbsorbsRefund && !adminNote?.trim()) {
    return {
      ok: false,
      error: "adminNote is required when platformAbsorbsRefund is true",
    };
  }

  return {
    ok: true,
    data: {
      scope: scope as AdminRefundScopeKey,
      vendorOrderId,
      orderLineItemId,
      quantity,
      amountCents,
      reason: reason.trim(),
      adminNote,
      customerVisibleNote,
      platformAbsorbsRefund,
      linkedOrderIssueId,
      includeTax,
      includeTip,
      includeServiceFee,
    },
  };
}
