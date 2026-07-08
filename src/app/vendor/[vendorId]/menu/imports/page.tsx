import { notFound } from "next/navigation";
import {
  gateMenuImportsRoutes,
  requireVendorMenuSourceContext,
} from "@/lib/vendor-menu-route-guard.server";
import {
  getProviderDisplayProfile,
  integratedOrderRoutingLabel,
  vendorMenuImportsPageSubtitle,
} from "@/lib/integrations/provider-display";
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
  const profile = getProviderDisplayProfile(vendor.orderRoutingMode);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-oo-charcoal">Menu management</h2>
        <p className="mt-1 max-w-3xl text-sm text-oo-stone-gray">
          {vendorMenuImportsPageSubtitle(vendor.orderRoutingMode)}
        </p>
        <p className="mt-2 text-xs text-oo-stone-gray">
          Order route: <span className="font-medium text-oo-charcoal">{routeLabel}</span>
          {profile.menuImportLabel ? (
            <>
              {" "}
              · Import source:{" "}
              <span className="font-medium text-oo-charcoal">{profile.menuImportLabel}</span>
            </>
          ) : null}
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
