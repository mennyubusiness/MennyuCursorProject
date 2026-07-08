import { redirect } from "next/navigation";
import {
  gateMenuImportsRoutes,
  requireVendorMenuSourceContext,
} from "@/lib/vendor-menu-route-guard.server";
import { vendorMenuManagementPath } from "@/lib/vendor-menu-management";

/** Legacy Deliverect imports list — redirect to provider-neutral Menu Imports. */
export default async function VendorMenuImportsListRedirectPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const vendor = await requireVendorMenuSourceContext(vendorId);
  gateMenuImportsRoutes(vendor, vendorId);
  redirect(vendorMenuManagementPath(vendorId, vendor.orderRoutingMode));
}
