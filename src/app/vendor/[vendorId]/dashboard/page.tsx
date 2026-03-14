import { redirect } from "next/navigation";

/**
 * Legacy route: redirect to the main vendor Orders page.
 * Keeps existing links (e.g. from admin) working.
 */
export default async function VendorDashboardRedirect({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  redirect(`/vendor/${vendorId}/orders`);
}
