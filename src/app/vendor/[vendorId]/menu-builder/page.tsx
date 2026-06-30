import { notFound } from "next/navigation";
import {
  gateOpenOrderMenuBuilderRoutes,
  requireVendorMenuSourceContext,
} from "@/lib/vendor-menu-route-guard.server";
import { loadVendorMenuBuilderPageData } from "@/lib/vendor-menu-builder-data.server";
import { VendorMenuBuilderView } from "./VendorMenuBuilderView";

export default async function VendorMenuBuilderPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const vendor = await requireVendorMenuSourceContext(vendorId);
  gateOpenOrderMenuBuilderRoutes(vendor, vendorId);

  const data = await loadVendorMenuBuilderPageData(vendorId);
  if (!data) notFound();

  return <VendorMenuBuilderView data={data} />;
}
