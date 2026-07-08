import { redirect } from "next/navigation";
import { loadVendorMenuPageData } from "@/lib/vendor-menu-page-data.server";
import {
  gateMenuImportsRoutes,
  requireVendorMenuSourceContext,
} from "@/lib/vendor-menu-route-guard.server";
import { vendorMenuManagementPath } from "@/lib/vendor-menu-management";
import { VendorMenuPageView } from "./VendorMenuPageView";

export default async function VendorCurrentMenuPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const vendor = await requireVendorMenuSourceContext(vendorId);
  gateMenuImportsRoutes(vendor, vendorId);

  // Primary integrated menu UX is Menu Imports; keep /menu as live-menu detail for Deliverect.
  if (vendor.orderRoutingMode === "square") {
    redirect(vendorMenuManagementPath(vendorId, vendor.orderRoutingMode));
  }

  const data = await loadVendorMenuPageData(vendorId);
  if (!data) redirect(vendorMenuManagementPath(vendorId, vendor.orderRoutingMode));

  return <VendorMenuPageView data={data} />;
}
