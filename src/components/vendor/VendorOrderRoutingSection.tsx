import type { VendorOrderRoutingMode } from "@prisma/client";
import {
  isDeliverectRoutingMode,
  VENDOR_ROUTING_MODE_COPY,
  vendorOrderRoutingModeAdminLabel,
} from "@/lib/vendor-order-routing-mode";

export function VendorOrderRoutingSection({
  orderRoutingMode,
}: {
  orderRoutingMode: VendorOrderRoutingMode;
}) {
  const deliverectMode = isDeliverectRoutingMode(orderRoutingMode);

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
    </section>
  );
}
