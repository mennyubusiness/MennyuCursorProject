import { redirect } from "next/navigation";

export default async function VendorAreaIndex({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  redirect(`/vendor/${vendorId}/orders`);
}
