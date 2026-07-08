import { notFound } from "next/navigation";
import {
  gateMenuImportsRoutes,
  integratedOrderRoutingLabel,
  requireVendorMenuSourceContext,
} from "@/lib/vendor-menu-route-guard.server";
import { VendorDeliverectMenuImportsPanel } from "@/components/vendor/menu-imports/VendorDeliverectMenuImportsPanel";
import { VendorSquareMenuImportsPanel } from "@/components/vendor/menu-imports/VendorSquareMenuImportsPanel";

export default async function VendorMenuImportsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const vendor = await requireVendorMenuSourceContext(vendorId);
  gateMenuImportsRoutes(vendor, vendorId);

  const routeLabel = integratedOrderRoutingLabel(vendor.orderRoutingMode);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-oo-charcoal">Menu Imports</h2>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          Import and manage your menu from your connected POS or ordering integration.
        </p>
        <p className="mt-2 text-xs text-oo-stone-gray">
          Order route: <span className="font-medium text-oo-charcoal">{routeLabel}</span>
        </p>
      </div>

      {vendor.orderRoutingMode === "deliverect" ? (
        <VendorDeliverectMenuImportsPanel vendorId={vendorId} />
      ) : null}

      {vendor.orderRoutingMode === "square" ? (
        <VendorSquareMenuImportsPanel vendorId={vendorId} />
      ) : null}

      {vendor.orderRoutingMode !== "deliverect" && vendor.orderRoutingMode !== "square"
        ? notFound()
        : null}
    </div>
  );
}
