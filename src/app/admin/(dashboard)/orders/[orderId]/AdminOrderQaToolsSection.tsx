import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import { evaluateSimulateDeliverectStatusEligibility } from "@/lib/admin-simulate-deliverect-status";
import { evaluateSimulateRoutingFailureEligibility } from "@/lib/admin-simulate-routing-failure";
import { hasDeliverectChannelLink } from "@/lib/deliverect-vendor-order-authority";
import { AdminSimulateDeliverectStatusButton } from "./AdminSimulateDeliverectStatusButton";
import { AdminSimulateRoutingFailureButton } from "./AdminSimulateRoutingFailureButton";

export function AdminOrderQaToolsSection({
  orderStatus,
  vendorOrders,
}: {
  orderStatus: string;
  vendorOrders: AdminOrderDetail["vendorOrders"];
}) {
  if (vendorOrders.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-amber-300/50 bg-amber-50/20 px-3 py-2.5">
        <p className="text-xs font-semibold text-oo-charcoal">Admin QA tools</p>
        <p className="mt-1 text-xs text-oo-stone-gray">No vendor orders on this order.</p>
      </section>
    );
  }

  const anyRoutingEligible = vendorOrders.some((vo) =>
    evaluateSimulateRoutingFailureEligibility({
      orderStatus,
      fulfillmentStatus: vo.fulfillmentStatus,
    }).eligible
  );

  const anyDeliverectStatusEligible = vendorOrders.some((vo) => {
    const linked = hasDeliverectChannelLink({
      deliverectChannelLinkId: vo.deliverectChannelLinkId,
      vendor: vo.vendor,
    });
    if (!linked && !vo.deliverectOrderId) return false;
    return evaluateSimulateDeliverectStatusEligibility({
      orderStatus,
      fulfillmentStatus: vo.fulfillmentStatus,
      routingStatus: vo.routingStatus,
      statusCode: 20,
      deliverectChannelLinkId: vo.deliverectChannelLinkId,
      vendorDeliverectChannelLinkId: vo.vendor.deliverectChannelLinkId,
      deliverectOrderId: vo.deliverectOrderId,
    }).eligible;
  });

  return (
    <section className="rounded-lg border border-dashed border-amber-300/50 bg-amber-50/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold text-oo-charcoal">Admin QA tools</h2>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-900">
          Dev / staging
        </span>
      </div>
      {!anyRoutingEligible && !anyDeliverectStatusEligible && (
        <p className="mt-1 text-xs text-oo-stone-gray">
          QA simulations are unavailable for current vendor order states.
        </p>
      )}
      <ul className="mt-2 flex flex-col gap-2">
        {vendorOrders.map((vo) => {
          const simRouting = evaluateSimulateRoutingFailureEligibility({
            orderStatus,
            fulfillmentStatus: vo.fulfillmentStatus,
          });
          const deliverectLinked =
            hasDeliverectChannelLink({
              deliverectChannelLinkId: vo.deliverectChannelLinkId,
              vendor: vo.vendor,
            }) || Boolean(vo.deliverectOrderId?.trim());
          const simDeliverect = evaluateSimulateDeliverectStatusEligibility({
            orderStatus,
            fulfillmentStatus: vo.fulfillmentStatus,
            routingStatus: vo.routingStatus,
            statusCode: 20,
            deliverectChannelLinkId: vo.deliverectChannelLinkId,
            vendorDeliverectChannelLinkId: vo.vendor.deliverectChannelLinkId,
            deliverectOrderId: vo.deliverectOrderId,
          });

          return (
            <li
              key={vo.id}
              className="flex flex-col gap-2 rounded border border-amber-200/40 bg-oo-warm-white/60 px-2 py-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
            >
              <span className="text-xs font-medium text-oo-charcoal">{vo.vendor.name}</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
                <AdminSimulateRoutingFailureButton
                  vendorOrderId={vo.id}
                  vendorName={vo.vendor.name}
                  disabled={!simRouting.eligible}
                  disabledReason={simRouting.eligible ? undefined : simRouting.message}
                />
                {deliverectLinked ? (
                  <AdminSimulateDeliverectStatusButton
                    vendorOrderId={vo.id}
                    vendorName={vo.vendor.name}
                    disabled={!simDeliverect.eligible}
                    disabledReason={
                      simDeliverect.eligible ? undefined : simDeliverect.message
                    }
                  />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
