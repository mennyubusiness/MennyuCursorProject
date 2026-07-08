import {
  fulfillmentStatusBadge,
  providerLabel,
} from "@/lib/admin-order-detail-ui";
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";

type VoRow = AdminOrderDetail["vendorOrders"][number];

function vendorReceivedPlain(vo: VoRow): string {
  if (vo.manuallyRecoveredAt) return "Yes — confirmed manually";
  if (vo.routingStatus === "failed" && vo.fulfillmentStatus === "pending") {
    return "No — routing failed";
  }
  if (vo.routingStatus === "sent" && vo.fulfillmentStatus === "pending") {
    return "Sent — waiting for kitchen confirmation";
  }
  if (vo.routingStatus === "confirmed" || vo.fulfillmentStatus !== "pending") {
    return "Yes";
  }
  if (vo.routingStatus === "pending") return "Not yet — routing pending";
  return "Unknown";
}

/** Plain-language vendor status for the default card view. */
export function AdminVendorOrderOperationalPanel({ vo }: { vo: VoRow }) {
  const fulfillment = fulfillmentStatusBadge(vo.fulfillmentStatus);
  const provider = providerLabel(vo);

  return (
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs font-medium text-oo-stone-gray">Vendor received order</dt>
        <dd className="mt-0.5 text-oo-charcoal">{vendorReceivedPlain(vo)}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-oo-stone-gray">Kitchen status</dt>
        <dd className="mt-0.5">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${fulfillment.className}`}>
            {fulfillment.label}
          </span>
        </dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-xs font-medium text-oo-stone-gray">POS / routing</dt>
        <dd className="mt-0.5 text-oo-stone-gray">
          {provider.label === "Square"
            ? "Connected to POS (Square)"
            : provider.label === "Deliverect"
              ? "Connected to POS (Deliverect)"
              : "Manual routing (no POS link)"}
        </dd>
      </div>
      {vo.squareOrderId?.trim() ? (
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium text-oo-stone-gray">Square order id</dt>
          <dd className="mt-0.5 break-all font-mono text-[11px] text-oo-charcoal">{vo.squareOrderId}</dd>
        </div>
      ) : null}
      {(vo.squareLastError || vo.deliverectLastError) && vo.routingStatus === "failed" && (
        <div className="sm:col-span-2">
          <p className="rounded border border-red-200 bg-red-50/70 px-2.5 py-2 text-xs text-red-900">
            Routing problem: {(vo.squareLastError ?? vo.deliverectLastError ?? "").slice(0, 160)}
            {(vo.squareLastError ?? vo.deliverectLastError ?? "").length > 160 ? "…" : ""}
          </p>
        </div>
      )}
    </dl>
  );
}
