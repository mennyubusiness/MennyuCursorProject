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
        actions={
          <Link
            href={`/vendor/${vendorId}/kitchen`}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-hover"
          >
            Kitchen mode
          </Link>
        }
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
          menuSyncLabel={ctx.menuSyncLabel}
          paymentsLabel={ctx.paymentsLabel}
          posManaged={ctx.posManaged}
          initialPaused={ctx.vendorRecord.mennyuOrdersPaused ?? false}
          storefrontHref={ctx.storefrontHref}
          todayHoursLabel={ctx.hoursSummary.todayLabel}
          nextOpeningLabel={ctx.hoursSummary.nextOpeningLabel}
          hoursSourceLabel={ctx.hoursSummary.sourceLabel}
        />

        <VendorDashboardActiveOrdersSection
          vendorId={vendorId}
          vendorDeliverectChannelLinkId={ctx.vendor.deliverectChannelLinkId}
          initialVendorOrders={ctx.initialVendorOrdersForClient}
          initialNowMs={ctx.initialNowMs}
          isDeliverectLive={ctx.isDeliverectLive}
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
