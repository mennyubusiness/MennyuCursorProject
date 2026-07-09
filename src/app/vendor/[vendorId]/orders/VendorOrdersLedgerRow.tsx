"use client";

import { useMemo } from "react";
import { getPickupCode } from "@/lib/pickup-code";
import {
  isActiveLedgerOrder,
  type VendorOrdersLedgerOrder,
} from "@/lib/vendor-orders-ledger-filters";
import { formatVendorCustomerPhone } from "@/lib/vendor-order-next-action";
import { getVendorOrderOperatingMode } from "@/lib/vendor-order-operating-mode";
import {
  vendorOrderHeadlineStatus,
  vendorRoutingStatusLabel,
} from "@/lib/vendor-order-vendor-display";
import type { VendorOrderIssueRow } from "@/services/vendor-order-issue.service";
import { VendorOrderDetailPanel } from "./VendorOrderDetailPanel";
import { VendorOrderIssueCard } from "./VendorOrderIssueCard";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatOrderTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function itemSummary(lineItems: VendorOrdersLedgerOrder["lineItems"]): string {
  if (lineItems.length === 0) return "No items";
  const names = lineItems.slice(0, 2).map((line) => `${line.quantity}× ${line.name}`);
  const extra = lineItems.length > 2 ? ` +${lineItems.length - 2} more` : "";
  return names.join(", ") + extra;
}

function issueBadgeLabel(issues: VendorOrderIssueRow[]): string | null {
  if (issues.length === 0) return null;
  const openCount = issues.filter((issue) => issue.isActive).length;
  if (openCount > 0) {
    return openCount === 1 ? "Open issue" : `${openCount} open issues`;
  }
  return issues.length === 1 ? "Resolved issue" : `${issues.length} resolved issues`;
}

export function VendorOrdersLedgerRow({
  vendorId,
  vendorOrder,
  issues,
  orderRoutingMode,
  isDeliverectLive,
  posManaged,
  expanded,
  onToggleExpanded,
  onIssuesUpdated,
}: {
  vendorId: string;
  vendorOrder: VendorOrdersLedgerOrder;
  issues: VendorOrderIssueRow[];
  isDeliverectLive: boolean;
  posManaged: boolean;
  orderRoutingMode: import("@prisma/client").VendorOrderRoutingMode;
  expanded: boolean;
  onToggleExpanded: () => void;
  onIssuesUpdated: () => void;
}) {
  const pickupCode = getPickupCode(vendorOrder.order.id);
  const active = isActiveLedgerOrder(vendorOrder);
  const operatingMode = getVendorOrderOperatingMode(
    vendorOrder,
    vendorOrder.statusHistory,
    isDeliverectLive
  );
  const needsAttention = operatingMode === "needs_attention";
  const headline = vendorOrderHeadlineStatus({
    routingStatus: vendorOrder.routingStatus,
    fulfillmentStatus: vendorOrder.fulfillmentStatus,
    needsAttention,
    orderRoutingMode,
  });
  const routingLabel = vendorRoutingStatusLabel(
    vendorOrder.routingStatus,
    vendorOrder.fulfillmentStatus,
    { orderRoutingMode }
  );
  const phone = formatVendorCustomerPhone(vendorOrder.order.customerPhone);
  const issueLabel = issueBadgeLabel(issues);

  const rowTone = useMemo(() => {
    if (active) return "border-brand/30 bg-brand/[0.03] ring-1 ring-brand/10";
    if (needsAttention || (issues.some((i) => i.isActive) && issues.length > 0)) {
      return "border-amber-300/80 bg-amber-50/40";
    }
    return "border-oo-light-stone bg-oo-warm-white";
  }, [active, needsAttention, issues]);

  return (
    <li className={`rounded-xl border shadow-sm ${rowTone}`}>
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex w-full items-start gap-3 px-4 py-3 text-left sm:px-5 sm:py-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-lg font-bold text-oo-charcoal sm:text-xl">{pickupCode}</p>
            {active ? (
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-brand">
                Active
              </span>
            ) : null}
            {issueLabel ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  issues.some((issue) => issue.isActive)
                    ? "bg-amber-100 text-amber-950"
                    : "bg-stone-100 text-stone-800"
                }`}
              >
                {issueLabel}
              </span>
            ) : null}
            {needsAttention && !issueLabel ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-950">
                Needs attention
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-oo-charcoal">{headline}</p>
          <p className="mt-0.5 text-xs text-oo-stone-gray sm:text-sm">
            {formatOrderTime(vendorOrder.order.createdAt)}
            {phone ? ` · ${phone}` : ""}
            {" · "}
            {routingLabel}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-oo-stone-gray">{itemSummary(vendorOrder.lineItems)}</p>
          {issues[0]?.issueTypeLabel && !expanded ? (
            <p className="mt-1 text-xs text-amber-900">{issues[0].issueTypeLabel}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-oo-charcoal sm:text-base">
            {formatMoney(vendorOrder.totalCents)}
          </p>
          <p className="mt-2 text-xs font-medium text-oo-stone-gray">{expanded ? "Hide" : "Details"}</p>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-oo-light-stone px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
          <VendorOrderDetailPanel
            vendorOrder={{
              ...vendorOrder,
              tipCents: vendorOrder.tipCents ?? 0,
              statusHistory: vendorOrder.statusHistory ?? [],
            }}
            posManaged={posManaged}
            isDeliverectLive={isDeliverectLive}
            orderRoutingMode={orderRoutingMode}
          />
          {issues.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Customer issues
              </p>
              {issues.map((issue) => (
                <VendorOrderIssueCard
                  key={issue.id}
                  issue={issue}
                  vendorId={vendorId}
                  onUpdated={onIssuesUpdated}
                  compact
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
