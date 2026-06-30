import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";
import { VendorDashboardActiveOrdersSection } from "./VendorDashboardActiveOrdersSection";
import { VendorNeedsAttentionSection } from "./VendorNeedsAttentionSection";
import { VendorQuickLinksSection } from "./VendorQuickLinksSection";
import { VendorStoreStatusCard } from "./VendorStoreStatusCard";
import { VendorTodayPerformanceSection } from "./VendorTodayPerformanceSection";

export default async function VendorDashboardPage({
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
        title="Dashboard"
        description="Store status, live orders, and what needs your attention today."
      />

      <div className="mt-8 space-y-8">
        {!ctx.setupComplete ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-oo-charcoal">
            <Link href={`/vendor/${vendorId}/setup`} className="font-semibold underline">
              Setup incomplete
            </Link>
            <span className="text-oo-stone-gray">
              {" "}
              — finish the checklist so customers can order without surprises.
            </span>
          </div>
        ) : null}

        <VendorStoreStatusCard
          vendorId={vendorId}
          vendorName={ctx.vendorRecord.name}
          intakeLabel={ctx.intakeLabel}
          podName={ctx.currentPod?.name ?? null}
          posConnectionLabel={ctx.posConnectionLabel}
          routingStatusFieldLabel={ctx.routingStatusFieldLabel}
          menuSyncLabel={ctx.menuSyncLabel}
          paymentsLabel={ctx.paymentsLabel}
          storefrontHref={ctx.storefrontHref}
          todayHoursLabel={ctx.hoursSummary.todayLabel}
          ordersPaused={ctx.vendorRecord.mennyuOrdersPaused ?? false}
          posManaged={ctx.posManaged}
        />

        <VendorDashboardActiveOrdersSection
          vendorId={vendorId}
          vendorDeliverectChannelLinkId={ctx.vendor.deliverectChannelLinkId}
          initialVendorOrders={ctx.initialVendorOrdersForClient}
          initialNowMs={ctx.initialNowMs}
          isDeliverectLive={ctx.isDeliverectLive}
          orderRoutingMode={ctx.vendorRecord.orderRoutingMode}
          posManaged={ctx.posManaged}
          activeCounts={ctx.activeCounts}
        />

        <VendorNeedsAttentionSection
          vendorId={vendorId}
          items={ctx.attentionItems}
          setupComplete={ctx.setupComplete}
        />

        <VendorTodayPerformanceSection stats={ctx.todayStats} />

        <VendorQuickLinksSection vendorId={vendorId} />
      </div>
    </DashboardShell>
  );
}
