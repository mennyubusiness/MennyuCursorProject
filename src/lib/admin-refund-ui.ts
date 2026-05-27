import type { AdminRefundScopeKey } from "@/lib/admin-refund-idempotency";

export function formatAdminMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function refundStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Refund pending";
    case "succeeded":
      return "Customer refunded";
    case "failed":
      return "Refund failed";
    case "canceled":
      return "Refund canceled";
    case "requires_action":
      return "Needs review";
    default:
      return status.replace(/_/g, " ");
  }
}

export function refundScopeLabel(scope: string): string {
  switch (scope) {
    case "full_order":
      return "Full order";
    case "full_vendor_order":
      return "Full vendor order";
    case "custom_vendor_partial":
      return "Custom partial (vendor)";
    case "line_item_refund":
      return "Line item";
    case "system_cancel":
      return "System cancel";
    case "vendor_denial":
      return "Vendor denial";
    case "legacy":
      return "Legacy";
    default:
      return scope.replace(/_/g, " ");
  }
}

export function paymentRefundStatusLabel(status: string | null | undefined): string {
  if (!status || status === "none") return "No refunds";
  if (status === "partial") return "Partially refunded";
  if (status === "full") return "Fully refunded";
  if (status === "pending") return "Refund in progress";
  return status;
}

export function refundModalTitle(scope: AdminRefundScopeKey): string {
  switch (scope) {
    case "full_order":
      return "Refund full order";
    case "full_vendor_order":
      return "Refund vendor order";
    case "custom_vendor_partial":
      return "Refund custom amount";
    case "line_item_refund":
      return "Refund line item";
  }
}

export function transferToneClass(tone: "neutral" | "warning" | "danger" | "success"): string {
  switch (tone) {
    case "danger":
      return "border-red-200 bg-red-50 text-red-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    default:
      return "border-oo-light-stone bg-oo-cream/80 text-oo-charcoal";
  }
}
