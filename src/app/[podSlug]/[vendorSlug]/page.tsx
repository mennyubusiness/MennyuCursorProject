import { renderVendorMenuCustomerPage } from "@/lib/vendor-menu-customer-page-render";

export default async function VendorSlugPage({
  params,
}: {
  params: Promise<{ podSlug: string; vendorSlug: string }>;
}) {
  const { podSlug, vendorSlug } = await params;
  return renderVendorMenuCustomerPage(podSlug, vendorSlug);
}
