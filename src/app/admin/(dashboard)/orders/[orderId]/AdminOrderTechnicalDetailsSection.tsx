import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import type { AdminOrderPaymentSummary } from "@/services/admin-order-payment-summary.service";
import { ADMIN_DETAILS_SECTION } from "@/lib/admin-order-detail-ui";

export function AdminOrderTechnicalDetailsSection({
  adminOrder,
  paymentSummary,
}: {
  adminOrder: AdminOrderDetail;
  paymentSummary: AdminOrderPaymentSummary | null;
}) {
  const payment = paymentSummary?.payment;

  return (
    <details className={`${ADMIN_DETAILS_SECTION} px-5 py-4`}>
      <summary className="cursor-pointer text-sm font-semibold text-oo-charcoal">
        Technical details
      </summary>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Internal IDs and provider references — collapsed by default.
      </p>
      <div className="mt-4 space-y-4 border-t border-oo-light-stone pt-4 font-mono text-xs text-oo-charcoal">
        <div>
          <p className="text-oo-stone-gray">Order ID</p>
          <p className="break-all">{adminOrder.id}</p>
        </div>
        {payment && (
          <dl className="grid gap-2 sm:grid-cols-2">
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
          <div key={vo.id} className="rounded border border-oo-light-stone bg-oo-cream/40 p-2">
            <p className="font-sans text-xs font-medium text-oo-charcoal">{vo.vendor.name}</p>
            <p className="mt-1 break-all">Vendor order: {vo.id}</p>
            <p className="mt-0.5">
              routing {vo.routingStatus} · fulfillment {vo.fulfillmentStatus}
            </p>
            {vo.deliverectOrderId && (
              <p className="mt-0.5 break-all">Deliverect: {vo.deliverectOrderId}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
