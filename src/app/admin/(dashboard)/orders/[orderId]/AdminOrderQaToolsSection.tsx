import type { AdminOrderDetail } from "@/lib/admin-order-detail-query";
import { evaluateSimulateRoutingFailureEligibility } from "@/lib/admin-simulate-routing-failure";
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

  const anyEligible = vendorOrders.some((vo) =>
    evaluateSimulateRoutingFailureEligibility({
      orderStatus,
      fulfillmentStatus: vo.fulfillmentStatus,
    }).eligible
  );

  return (
    <section className="rounded-lg border border-dashed border-amber-300/50 bg-amber-50/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold text-oo-charcoal">Admin QA tools</h2>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-900">
          Dev / staging
        </span>
      </div>
      {!anyEligible && (
        <p className="mt-1 text-xs text-oo-stone-gray">
          Simulate routing failure is unavailable for current vendor order states.
        </p>
      )}
      <ul className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {vendorOrders.map((vo) => {
          const sim = evaluateSimulateRoutingFailureEligibility({
            orderStatus,
            fulfillmentStatus: vo.fulfillmentStatus,
          });
          return (
            <li
              key={vo.id}
              className="flex min-w-[200px] flex-1 flex-wrap items-center justify-between gap-2 rounded border border-amber-200/40 bg-oo-warm-white/60 px-2 py-1.5"
            >
              <span className="text-xs font-medium text-oo-charcoal">{vo.vendor.name}</span>
              <AdminSimulateRoutingFailureButton
                vendorOrderId={vo.id}
                vendorName={vo.vendor.name}
                disabled={!sim.eligible}
                disabledReason={sim.eligible ? undefined : sim.message}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
