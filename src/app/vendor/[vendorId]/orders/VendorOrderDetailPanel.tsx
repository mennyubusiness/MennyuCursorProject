"use client";

import { getPickupCode } from "@/lib/pickup-code";
import {
  formatVendorOrderTimelineTime,
  vendorOrderHeadlineStatus,
  vendorOrderTimelineLabel,
  vendorRoutingStatusLabel,
} from "@/lib/vendor-order-vendor-display";
import { formatVendorCustomerPhone } from "@/lib/vendor-order-next-action";
import { getVendorOrderOperatingMode } from "@/lib/vendor-order-operating-mode";
import {
  isSquareRoutedVendorOrderWithSync,
  VENDOR_DELIVERECT_CONTROLLED_NOTICE,
  VENDOR_SQUARE_SYNC_NOTICE,
} from "@/lib/deliverect-vendor-order-authority";

export type VendorOrderDetailData = {
  id: string;
  routingStatus: string;
  fulfillmentStatus: string;
  squareOrderId?: string | null;
  manuallyRecoveredAt?: string | null;
  totalCents: number;
  tipCents: number;
  order: {
    id: string;
    orderNotes: string | null;
    customerPhone: string | null;
    createdAt: string;
  };
  lineItems: Array<{
    id: string;
    name: string;
    quantity: number;
    priceCents: number;
    specialInstructions: string | null;
    selections: Array<{
      nameSnapshot: string;
      quantity: number;
      modifierOption: { name: string };
    }>;
  }>;
  statusHistory: Array<{
    source?: string | null;
    fulfillmentStatus?: string | null;
    routingStatus?: string | null;
    createdAt: string;
  }>;
};

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function VendorOrderDetailPanel({
  vendorOrder,
  posManaged,
  isDeliverectLive = false,
  orderRoutingMode,
}: {
  vendorOrder: VendorOrderDetailData;
  posManaged: boolean;
  isDeliverectLive?: boolean;
  orderRoutingMode?: import("@prisma/client").VendorOrderRoutingMode | null;
}) {
  const pickupCode = getPickupCode(vendorOrder.order.id);
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

  return (
    <div className="rounded-xl border border-oo-light-stone bg-oo-cream/40 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Order detail</p>
          <p className="mt-1 font-mono text-lg font-bold text-oo-charcoal">{pickupCode}</p>
          <p className="mt-1 font-medium text-oo-charcoal">{headline}</p>
          <p className="mt-1 text-oo-stone-gray">{routingLabel}</p>
        </div>
        <div className="text-right text-xs text-oo-stone-gray">
          <p>{formatVendorOrderTimelineTime(vendorOrder.order.createdAt)}</p>
          {phone ? <p className="mt-1">{phone}</p> : null}
        </div>
      </div>

      {posManaged ? (
        <p className="mt-3 rounded-lg bg-oo-warm-white px-3 py-2 text-oo-stone-gray">
          {VENDOR_DELIVERECT_CONTROLLED_NOTICE}
        </p>
      ) : null}

      {isSquareRoutedVendorOrderWithSync({
        orderRoutingMode,
        squareOrderId: vendorOrder.squareOrderId,
      }) ? (
        <p className="mt-3 rounded-lg bg-oo-warm-white px-3 py-2 text-oo-stone-gray">
          {VENDOR_SQUARE_SYNC_NOTICE}
        </p>
      ) : null}

      {vendorOrder.order.orderNotes?.trim() ? (
        <p className="mt-3 text-oo-stone-gray">
          <span className="font-medium text-oo-charcoal">Note:</span> {vendorOrder.order.orderNotes}
        </p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {vendorOrder.lineItems.map((line) => (
          <li key={line.id} className="border-t border-oo-light-stone/80 pt-3 first:border-t-0 first:pt-0">
            <div className="flex justify-between gap-2">
              <span className="font-medium text-oo-charcoal">
                {line.quantity}× {line.name}
              </span>
              <span className="shrink-0 text-oo-charcoal">{formatMoney(line.priceCents * line.quantity)}</span>
            </div>
            {line.selections.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-xs text-oo-stone-gray">
                {line.selections.map((sel, idx) => (
                  <li key={`${line.id}-${idx}`}>
                    + {sel.quantity > 1 ? `${sel.quantity}× ` : ""}
                    {sel.nameSnapshot || sel.modifierOption.name}
                  </li>
                ))}
              </ul>
            ) : null}
            {line.specialInstructions?.trim() ? (
              <p className="mt-1 text-xs italic text-oo-stone-gray">{line.specialInstructions}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-oo-light-stone pt-3 text-sm">
        <div>
          <dt className="text-xs text-oo-stone-gray">Vendor subtotal</dt>
          <dd className="font-medium text-oo-charcoal">{formatMoney(vendorOrder.totalCents)}</dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Tip</dt>
          <dd className="font-medium text-oo-charcoal">{formatMoney(vendorOrder.tipCents ?? 0)}</dd>
        </div>
      </dl>

      {vendorOrder.statusHistory.length > 0 ? (
        <div className="mt-4 border-t border-oo-light-stone pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Status timeline</p>
          <ol className="mt-2 space-y-2">
            {vendorOrder.statusHistory.map((entry, idx) => (
              <li key={`${entry.createdAt}-${idx}`} className="flex justify-between gap-2 text-xs">
                <span className="text-oo-charcoal">{vendorOrderTimelineLabel(entry)}</span>
                <span className="shrink-0 text-oo-stone-gray">
                  {formatVendorOrderTimelineTime(entry.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
