import { notFound } from "next/navigation";
import { loadVendorMenuPageData } from "@/lib/vendor-menu-page-data.server";
import {
  gateDeliverectMenuRoutes,
  requireVendorMenuSourceContext,
} from "@/lib/vendor-menu-route-guard.server";
import { VendorMenuPageView } from "./VendorMenuPageView";

export default async function VendorCurrentMenuPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const vendor = await requireVendorMenuSourceContext(vendorId);
  gateDeliverectMenuRoutes(vendor, vendorId);

  const data = await loadVendorMenuPageData(vendorId);
  if (!data) notFound();

  return <VendorMenuPageView data={data} />;
}
