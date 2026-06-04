import Link from "next/link";
import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import { fulfillmentStatusBadge, formatAdminMoney, ADMIN_SECTION_CARD } from "@/lib/admin-order-detail-ui";
import { AdminVendorOrderOperationalPanel } from "./AdminVendorOrderOperationalPanel";
import { AdminVendorOrderTechnicalRoutingDetails } from "./AdminDeliverectDiagnosticsPanel";
import { AdminVendorOrderTransition } from "./AdminVendorOrderTransition";

type VoRow = AdminOrderDetail["vendorOrders"][number];
type RefundAttempt = AdminOrderDetail["refundAttempts"][number];

export function AdminVendorOrderCard({
  vo,
  showRecoveredBadge,
  showProgressionUi,
  progressionTargetsFiltered,
  showRecheck,
  refundAttempts,
}: {
  vo: VoRow;
  showRecoveredBadge: boolean;
  showProgressionUi: boolean;
  progressionTargetsFiltered: string[];
  showRecheck: boolean;
  refundAttempts: RefundAttempt[];
}) {
  const fulfillment = fulfillmentStatusBadge(vo.fulfillmentStatus);

  const voRefunds = refundAttempts.filter((ra) => ra.vendorOrderId === vo.id);
  const latestRefund = voRefunds.length > 0 ? voRefunds[voRefunds.length - 1] : null;
  const refundAmount = latestRefund ? formatAdminMoney(latestRefund.amountCents) : "";

  return (
    <article className={`${ADMIN_SECTION_CARD} space-y-0`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-oo-light-stone pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-oo-charcoal">{vo.vendor.name}</h3>
            <Link
              href={`/vendor/${vo.vendorId}/orders`}
              className="text-xs text-oo-stone-gray hover:underline"
            >
              Vendor queue →
            </Link>
          </div>
          <p className="mt-0.5 text-sm tabular-nums text-oo-stone-gray">
            {formatAdminMoney(vo.totalCents)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fulfillment.className}`}>
            {fulfillment.label}
          </span>
          {showRecoveredBadge && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
              Recovered manually
            </span>
          )}
        </div>
      </header>

      <AdminVendorOrderOperationalPanel vo={vo} />

      {vo.fulfillmentStatus === "cancelled" && (
        <div className="mt-3">
          {latestRefund?.status === "succeeded" && (
            <p className="rounded border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 text-xs font-medium text-emerald-900">
              Refund completed — {refundAmount}
            </p>
          )}
          {latestRefund?.status === "attempted" && (
            <p className="rounded border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-xs font-medium text-amber-900">
              Refund pending — {refundAmount}
            </p>
          )}
          {latestRefund?.status === "failed" && (
            <div className="rounded border border-red-200 bg-red-50/70 px-2.5 py-2">
              <p className="text-xs font-medium text-red-800">Refund failed — {refundAmount}</p>
              {latestRefund.failureMessage && (
                <p className="mt-0.5 text-xs text-oo-stone-gray">
                  {latestRefund.failureMessage.slice(0, 120)}
                  {latestRefund.failureMessage.length > 120 ? "…" : ""}
                </p>
              )}
            </div>
          )}
          {!latestRefund && (
            <div className="rounded border border-amber-200 bg-amber-50/70 px-2.5 py-2">
              <p className="text-xs font-medium text-amber-800">Financial follow-up may be required</p>
              <p className="mt-0.5 text-xs text-oo-stone-gray">
                This vendor order was cancelled. Refund or reconciliation may be needed.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        <h4 className="text-xs font-semibold text-oo-charcoal">Items</h4>
        <ul className="mt-2 space-y-2">
          {vo.lineItems.map((line) => (
            <li
              key={line.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-oo-light-stone/80 pb-2 text-sm last:border-0"
            >
              <div>
                <span className="font-medium text-oo-charcoal">
                  {line.name} × {line.quantity}
                </span>
                {line.specialInstructions && (
                  <p className="text-xs text-amber-800">Note: {line.specialInstructions}</p>
                )}
                {line.selections.length > 0 && (
                  <p className="text-xs text-oo-stone-gray">
                    {line.selections
                      .map((s) => `${s.nameSnapshot}${s.quantity > 1 ? ` ×${s.quantity}` : ""}`)
                      .join(", ")}
                  </p>
                )}
              </div>
              <span className="tabular-nums text-oo-stone-gray">
                {formatAdminMoney(line.priceCents * line.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {showProgressionUi && (
        <div className="mt-4 border-t border-oo-light-stone pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Fulfillment progression
          </p>
          <div className="mt-2">
            <AdminVendorOrderTransition
              vendorOrderId={vo.id}
              allowedTargets={progressionTargetsFiltered}
            />
          </div>
        </div>
      )}

      <AdminVendorOrderTechnicalRoutingDetails vo={vo} showRecheck={showRecheck} />
    </article>
  );
}
