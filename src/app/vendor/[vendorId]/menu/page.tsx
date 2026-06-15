import { notFound } from "next/navigation";
import { loadVendorMenuPageData } from "@/lib/vendor-menu-page-data.server";
import { VendorMenuPageView } from "./VendorMenuPageView";

export default async function VendorCurrentMenuPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const data = await loadVendorMenuPageData(vendorId);
  if (!data) notFound();

  return <VendorMenuPageView data={data} />;
}
