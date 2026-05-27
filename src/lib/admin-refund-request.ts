import type { AdminRefundScopeKey } from "@/lib/admin-refund-idempotency";

export type AdminRefundRequestBody = {
  scope: AdminRefundScopeKey;
  vendorOrderId?: string | null;
  amountCents?: number | null;
  reason: string;
  adminNote?: string | null;
  customerVisibleNote?: string | null;
  platformAbsorbsRefund?: boolean | null;
};

export type ParseAdminRefundBodyResult =
  | { ok: true; data: AdminRefundRequestBody }
  | { ok: false; error: string };

const SCOPES: AdminRefundScopeKey[] = [
  "full_order",
  "full_vendor_order",
  "custom_vendor_partial",
];

export function parseAdminRefundRequestBody(body: unknown): ParseAdminRefundBodyResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid JSON body" };
  }
  const b = body as Record<string, unknown>;
  const scope = b.scope;
  if (typeof scope !== "string" || !SCOPES.includes(scope as AdminRefundScopeKey)) {
    return { ok: false, error: "scope must be full_order, full_vendor_order, or custom_vendor_partial" };
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

  return {
    ok: true,
    data: {
      scope: scope as AdminRefundScopeKey,
      vendorOrderId,
      amountCents,
      reason: reason.trim(),
      adminNote,
      customerVisibleNote,
      platformAbsorbsRefund,
    },
  };
}
