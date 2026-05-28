import { VendorOrderIssuesPanel } from "./VendorOrderIssuesPanel";

export default async function VendorOrderIssuesPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  return <VendorOrderIssuesPanel vendorId={vendorId} />;
}
