/**
 * Shared layout helpers for admin order detail (presentation only).
 */

import { isActiveOrderIssueStatus } from "@/domain/order-support-issue";
import { adminOperationalParentStatusLabel } from "@/domain/order-state";
import type { ParentOrderStatus } from "@/domain/types";
import { hasDeliverectChannelLink } from "@/lib/deliverect-admin-lifecycle";

export const ADMIN_SECTION_CARD =
  "rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm";

export const ADMIN_SUBTLE_SECTION =
  "rounded-xl border border-oo-light-stone bg-oo-warm-white/80 p-4";

export const ADMIN_DETAILS_SECTION =
  "group rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm";

export function formatAdminOrderDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export function formatAdminMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function isSystemIssueActive(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "open" || status === "OPEN";
}

export function isAnyIssueActive(
  customerIssues: Array<{ status: string }>,
  systemIssues: Array<{ status: string }>
): boolean {
  return (
    customerIssues.some((i) => isActiveOrderIssueStatus(i.status)) ||
    systemIssues.some((i) => isSystemIssueActive(i.status))
  );
}

export function routingStatusBadge(routingStatus: string): { label: string; className: string } {
  switch (routingStatus) {
    case "pending":
      return { label: "Routing pending", className: "bg-amber-100 text-amber-900" };
    case "sent":
      return { label: "Sent", className: "bg-blue-100 text-blue-900" };
    case "confirmed":
      return { label: "Confirmed", className: "bg-emerald-100 text-emerald-900" };
    case "failed":
      return { label: "Routing failed", className: "bg-red-100 text-red-900" };
    default:
      return { label: routingStatus, className: "bg-stone-200 text-stone-800" };
  }
}

export function fulfillmentStatusBadge(fulfillmentStatus: string): { label: string; className: string } {
  switch (fulfillmentStatus) {
    case "pending":
      return { label: "Awaiting confirmation", className: "bg-amber-100 text-amber-900" };
    case "accepted":
      return { label: "Confirmed", className: "bg-blue-100 text-blue-900" };
    case "preparing":
      return { label: "Preparing", className: "bg-orange-100 text-orange-900" };
    case "ready":
      return { label: "Ready", className: "bg-emerald-100 text-emerald-900" };
    case "completed":
      return { label: "Completed", className: "bg-emerald-100 text-emerald-900" };
    case "cancelled":
      return { label: "Cancelled", className: "bg-stone-200 text-stone-700" };
    default:
      return { label: fulfillmentStatus, className: "bg-stone-200 text-stone-800" };
  }
}

export function providerLabel(vo: {
  deliverectChannelLinkId?: string | null;
  vendor: { deliverectChannelLinkId?: string | null };
  deliverectSubmittedAt?: Date | null;
  routingStatus: string;
}): { label: string; className: string } {
  const deliverect = hasDeliverectChannelLink({
    deliverectChannelLinkId: vo.deliverectChannelLinkId,
    vendorDeliverectChannelLinkId: vo.vendor.deliverectChannelLinkId,
  });
  if (deliverect || vo.deliverectSubmittedAt || vo.routingStatus === "sent" || vo.routingStatus === "failed") {
    return { label: "Deliverect", className: "bg-violet-100 text-violet-900" };
  }
  return { label: "Manual", className: "bg-stone-200 text-stone-700" };
}

export function severityBadgeClass(severity: string): string {
  const s = severity.toLowerCase();
  if (s === "high" || s === "critical") return "bg-red-100 text-red-900";
  if (s === "medium" || s === "normal") return "bg-amber-100 text-amber-900";
  return "bg-stone-200 text-stone-700";
}

export function issueStatusBadgeClass(status: string): string {
  if (isActiveOrderIssueStatus(status) || isSystemIssueActive(status)) {
    return "bg-amber-100 text-amber-900";
  }
  const s = status.toLowerCase();
  if (s === "resolved") return "bg-emerald-100 text-emerald-900";
  if (s === "dismissed") return "bg-stone-200 text-stone-700";
  if (s === "reviewing") return "bg-blue-100 text-blue-900";
  return "bg-stone-200 text-stone-800";
}

export function parentStatusBadgeClass(status: string): string {
  if (status === "pending_payment") return "bg-amber-100 text-amber-900";
  if (status === "completed") return "bg-emerald-100 text-emerald-900";
  if (status === "cancelled" || status === "failed") return "bg-red-100 text-red-900";
  if (status === "ready") return "bg-emerald-100 text-emerald-900";
  return "bg-blue-100 text-blue-900";
}

export function paymentChipLabel(orderStatus: string, paymentRefundStatus?: string | null): string {
  if (orderStatus === "pending_payment") return "Payment pending";
  if (paymentRefundStatus === "fully_refunded") return "Refunded";
  if (paymentRefundStatus === "partially_refunded") return "Partially refunded";
  return "Paid";
}

export function paymentChipClass(orderStatus: string, paymentRefundStatus?: string | null): string {
  if (orderStatus === "pending_payment") return "bg-amber-100 text-amber-900";
  if (paymentRefundStatus === "fully_refunded") return "bg-stone-200 text-stone-700";
  if (paymentRefundStatus === "partially_refunded") return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-900";
}

export function fulfillmentSummaryChip(
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string; manuallyRecoveredAt?: Date | null }>
): { label: string; className: string } {
  if (vendorOrders.length === 0) {
    return { label: "No vendors", className: "bg-stone-200 text-stone-700" };
  }
  const allCompleted = vendorOrders.every((v) => v.fulfillmentStatus === "completed");
  if (allCompleted) return { label: "Completed", className: "bg-emerald-100 text-emerald-900" };
  const anyCancelled = vendorOrders.some((v) => v.fulfillmentStatus === "cancelled");
  const anyFailedRouting = vendorOrders.some((v) => v.routingStatus === "failed" && v.fulfillmentStatus === "pending");
  const anyRecovered = vendorOrders.some((v) => v.manuallyRecoveredAt != null);
  if (anyFailedRouting) return { label: "Routing failed", className: "bg-red-100 text-red-900" };
  if (anyRecovered && vendorOrders.some((v) => v.fulfillmentStatus !== "pending")) {
    return { label: "Recovered", className: "bg-emerald-100 text-emerald-900" };
  }
  if (anyCancelled && vendorOrders.every((v) => v.fulfillmentStatus === "cancelled")) {
    return { label: "Cancelled", className: "bg-stone-200 text-stone-700" };
  }
  return { label: "In progress", className: "bg-blue-100 text-blue-900" };
}

export function parentStatusDisplay(
  status: string,
  vendorOrders: Array<{ routingStatus: string; fulfillmentStatus: string }>
): string {
  return adminOperationalParentStatusLabel(
    status as ParentOrderStatus,
    vendorOrders
  );
}
