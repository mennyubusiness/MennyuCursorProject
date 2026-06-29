import type { VendorOrderRoutingMode } from "@prisma/client";
import {
  isDeliverectRoutingMode,
  isVendorRoutingOperationalReady,
  VENDOR_ROUTING_MODE_COPY,
  vendorOrderRoutingModeAdminLabel,
} from "@/lib/vendor-order-routing-mode";
import type { VendorPosReadinessSummary } from "@/lib/vendor-readiness-states";

export function VendorOrderRoutingSection({
  orderRoutingMode,
  posSummary,
}: {
  orderRoutingMode: VendorOrderRoutingMode;
  posSummary: VendorPosReadinessSummary;
}) {
  const deliverectMode = isDeliverectRoutingMode(orderRoutingMode);
  const routingReady = isVendorRoutingOperationalReady(posSummary);

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <h2 className="text-sm font-semibold text-oo-charcoal">Order routing</h2>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Current mode:{" "}
        <span className="font-medium text-oo-charcoal">{vendorOrderRoutingModeAdminLabel(orderRoutingMode)}</span>
      </p>
      <p className="mt-3 text-sm text-oo-charcoal">
        {deliverectMode
          ? VENDOR_ROUTING_MODE_COPY.deliverect.vendorHelper
          : VENDOR_ROUTING_MODE_COPY.manualDashboard.vendorHelper}
      </p>
      {deliverectMode && !routingReady ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {VENDOR_ROUTING_MODE_COPY.deliverect.incompleteWarning}
        </p>
      ) : null}
      {!deliverectMode ? (
        <p className="mt-3 text-xs text-oo-stone-gray">
          {VENDOR_ROUTING_MODE_COPY.manualDashboard.serviceReminder}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-oo-stone-gray">
        Routing mode is managed by Open Order. Contact support if you need to switch between dashboard and Deliverect
        routing.
      </p>
    </section>
  );
}
