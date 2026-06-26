import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { loadVendorHoursPageData } from "@/lib/vendor-hours-page-data.server";
import { VendorCustomerOrderingHoursForm } from "./VendorCustomerOrderingHoursForm";

export default async function VendorHoursPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const data = await loadVendorHoursPageData(vendorId);
  if (!data) notFound();

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Hours"
        description="Choose how Open Order should determine when customers can place orders."
      />

      <div className="mt-8">
        <VendorCustomerOrderingHoursForm
          vendorId={data.vendorId}
          posConnected={data.posConnected}
          initialSyncFromDeliverect={data.syncFromDeliverect}
          initialCustomHours={data.customHours}
          syncedHours={data.syncedHours}
          syncedHoursAt={data.syncedHoursAt}
          syncStatus={data.syncStatus}
          syncLastError={data.syncLastError}
        />
      </div>
    </DashboardShell>
  );
}
