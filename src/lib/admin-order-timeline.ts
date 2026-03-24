/**
 * Unified admin order timeline (parent + vendors + issues + refunds).
 */
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import { getVendorOrderHistoryEventLabel } from "@/lib/admin-history-labels";

export type AdminOrderTimelineEntry = {
  id: string;
  at: Date;
  title: string;
  sourceLabel: string;
};

function normalizeSource(raw: string | null | undefined): string {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return "System";
  if (t.includes("deliverect")) return "Deliverect";
  if (t.includes("webhook")) return "Deliverect";
  if (t.includes("admin") || t === "manual") return "Admin";
  if (t.includes("stripe")) return "Stripe";
  return raw!.length > 24 ? `${raw!.slice(0, 24)}…` : raw!;
}

function refundLabel(
  ra: AdminOrderDetail["refundAttempts"][number],
  vendorNameForVo: (vendorOrderId: string) => string | null
): string {
  const amount = `$${(ra.amountCents / 100).toFixed(2)}`;
  const vendorSuffix = ra.vendorOrderId
    ? ` (${vendorNameForVo(ra.vendorOrderId) ?? "vendor order"})`
    : "";
  const dismissedSuffix = ra.dismissedAsLegacyAt != null ? " (dismissed as legacy)" : "";
  if (ra.status === "succeeded") {
    const stripe = ra.stripeRefundId ? ` — ${ra.stripeRefundId}` : "";
    return `Refund completed — ${amount}${vendorSuffix}${stripe}${dismissedSuffix}`;
  }
  if (ra.status === "failed") {
    const msg = ra.failureMessage
      ? ` — ${ra.failureMessage.slice(0, 60)}${ra.failureMessage.length > 60 ? "…" : ""}`
      : ra.failureCode
        ? ` — ${ra.failureCode}`
        : "";
    return `Refund failed — ${amount}${vendorSuffix}${msg}${dismissedSuffix}`;
  }
  return `Refund attempted — ${amount}${vendorSuffix}${dismissedSuffix}`;
}

export function buildAdminOrderTimeline(detail: AdminOrderDetail): AdminOrderTimelineEntry[] {
  const vendorNameByVoId = (vendorOrderId: string) =>
    detail.vendorOrders.find((vo) => vo.id === vendorOrderId)?.vendor.name ?? null;

  const rows: AdminOrderTimelineEntry[] = [];

  for (const h of detail.statusHistory) {
    rows.push({
      id: `parent-${h.id}`,
      at: h.createdAt,
      title: `Order status: ${h.status}`,
      sourceLabel: normalizeSource(h.source),
    });
  }

  for (const vo of detail.vendorOrders) {
    for (const h of vo.statusHistory) {
      rows.push({
        id: `vo-${h.id}`,
        at: h.createdAt,
        title: `${vo.vendor.name} — ${getVendorOrderHistoryEventLabel(h)}`,
        sourceLabel: normalizeSource(h.source),
      });
    }
  }

  for (const i of detail.issues) {
    rows.push({
      id: `oi-created-${i.id}`,
      at: i.createdAt,
      title: `Order issue: ${i.type.replace(/_/g, " ")} (${i.status})`,
      sourceLabel: "System",
    });
    if (i.resolvedAt) {
      rows.push({
        id: `oi-resolved-${i.id}`,
        at: i.resolvedAt,
        title: `Order issue resolved: ${i.type.replace(/_/g, " ")}`,
        sourceLabel: "Admin",
      });
    }
  }

  for (const vo of detail.vendorOrders) {
    for (const i of vo.issues) {
      rows.push({
        id: `voi-created-${i.id}`,
        at: i.createdAt,
        title: `${vo.vendor.name} — Issue: ${i.type.replace(/_/g, " ")} (${i.status})`,
        sourceLabel: "System",
      });
      if (i.resolvedAt) {
        rows.push({
          id: `voi-resolved-${i.id}`,
          at: i.resolvedAt,
          title: `${vo.vendor.name} — Issue resolved: ${i.type.replace(/_/g, " ")}`,
          sourceLabel: "Admin",
        });
      }
    }
  }

  for (const ra of detail.refundAttempts) {
    rows.push({
      id: `refund-${ra.id}`,
      at: ra.createdAt,
      title: refundLabel(ra, vendorNameByVoId),
      sourceLabel: "Stripe",
    });
  }

  rows.sort((a, b) => a.at.getTime() - b.at.getTime());
  return rows;
}
