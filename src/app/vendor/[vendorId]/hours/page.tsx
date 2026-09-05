import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { loadVendorDashboardOrderingMode } from "@/lib/vendor-dashboard-ordering-mode.server";
import { loadVendorHoursPageData } from "@/lib/vendor-hours-page-data.server";
import { VendorCustomerOrderingHoursForm } from "./VendorCustomerOrderingHoursForm";

export default async function VendorHoursPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const [data, orderingMode] = await Promise.all([
    loadVendorHoursPageData(vendorId),
    loadVendorDashboardOrderingMode(vendorId),
  ]);
  if (!data) notFound();

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Hours"
        description={
          orderingMode.menuOnly
            ? "Set the hours shown on this vendor's public menu page."
            : "Set the customer ordering hours for this vendor."
        }
      />

      <div className="mt-8">
        <VendorCustomerOrderingHoursForm
          vendorId={data.vendorId}
          initialCustomHours={data.customHours}
          menuOnly={orderingMode.menuOnly}
        />
      </div>
    </DashboardShell>
  );
}
