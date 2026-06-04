import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import type { AdminOrderPaymentSummary } from "@/services/admin-order-payment-summary.service";
import { ADMIN_DETAILS_SECTION, formatAdminOrderDate } from "@/lib/admin-order-detail-ui";
import type { AdminOrderGroupContext } from "@/lib/admin-order-group-context";
import { AdminOrderQaToolsSection } from "./AdminOrderQaToolsSection";

export function AdminOrderTechnicalDetailsSection({
  adminOrder,
  paymentSummary,
  showAdminTestTools,
  groupOrderContext,
}: {
  adminOrder: AdminOrderDetail;
  paymentSummary: AdminOrderPaymentSummary | null;
  showAdminTestTools: boolean;
  groupOrderContext?: AdminOrderGroupContext | null;
}) {
  const payment = paymentSummary?.payment;

  return (
    <details
      id="technical-details"
      className={`${ADMIN_DETAILS_SECTION} scroll-mt-4 px-5 py-4`}
    >
      <summary className="cursor-pointer text-sm font-semibold text-oo-charcoal">
        Technical details
      </summary>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Stripe IDs, routing codes, Deliverect references, and dev/staging QA tools — collapsed by
        default.
      </p>
      <div className="mt-4 space-y-4 border-t border-oo-light-stone pt-4">
        {showAdminTestTools ? (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-950">
              Dev / staging QA tools
            </p>
            <div className="mt-2">
              <AdminOrderQaToolsSection
                orderStatus={adminOrder.status}
                vendorOrders={adminOrder.vendorOrders}
              />
            </div>
          </div>
        ) : null}

        <div className="font-mono text-xs text-oo-charcoal">
          <p className="text-oo-stone-gray">Order ID</p>
          <p className="break-all">{adminOrder.id}</p>
        </div>
        {groupOrderContext ? (
          <dl className="grid gap-2 font-mono text-xs sm:grid-cols-2">
            <div>
              <dt className="text-oo-stone-gray">Group order session</dt>
              <dd className="break-all">{groupOrderContext.sessionId}</dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Group join code</dt>
              <dd>{groupOrderContext.joinCode}</dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Group status</dt>
              <dd>{groupOrderContext.status}</dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Session expires</dt>
              <dd>{formatAdminOrderDate(groupOrderContext.expiresAt)}</dd>
            </div>
          </dl>
        ) : null}
        {payment && (
          <dl className="grid gap-2 font-mono text-xs sm:grid-cols-2">
            <div>
              <dt className="text-oo-stone-gray">Stripe PaymentIntent</dt>
              <dd className="break-all">{payment.stripePaymentIntentId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Stripe Charge</dt>
              <dd className="break-all">{payment.stripeChargeId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Balance transaction</dt>
              <dd className="break-all">{payment.stripeBalanceTransactionId ?? "—"}</dd>
            </div>
          </dl>
        )}
        {adminOrder.vendorOrders.map((vo) => (
          <div key={vo.id} className="rounded border border-oo-light-stone bg-oo-cream/40 p-2 text-xs">
            <p className="font-sans font-medium text-oo-charcoal">{vo.vendor.name}</p>
            <p className="mt-1 break-all font-mono">Vendor order: {vo.id}</p>
            <p className="mt-0.5">
              routing {vo.routingStatus} · fulfillment {vo.fulfillmentStatus}
            </p>
            {vo.deliverectOrderId && (
              <p className="mt-0.5 break-all font-mono">Deliverect: {vo.deliverectOrderId}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
