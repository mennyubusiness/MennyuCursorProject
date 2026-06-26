import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";
import { VendorOrdersWorkbench } from "./VendorOrdersWorkbench";

export default async function VendorOrdersPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const ctx = await loadVendorDashboardContext(vendorId);
  if (!ctx) notFound();

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        eyebrow={ctx.vendorRecord.name}
        title="Orders"
        description="Your operational workbench — active board, history, and order details."
      />

      <div className="mt-8">
        <VendorOrdersWorkbench
          vendorId={vendorId}
          vendorName={ctx.vendorRecord.name}
          vendorDeliverectChannelLinkId={ctx.vendor.deliverectChannelLinkId}
          initialVendorOrders={ctx.initialVendorOrdersForClient}
          initialNowMs={ctx.initialNowMs}
          isDeliverectLive={ctx.isDeliverectLive}
          posManaged={ctx.posManaged}
        />
      </div>
    </DashboardShell>
  );
}
