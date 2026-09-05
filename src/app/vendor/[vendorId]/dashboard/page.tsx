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

  const hasActiveOrders =
    ctx.activeCounts.new + ctx.activeCounts.preparing + ctx.activeCounts.ready > 0;

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Dashboard"
        description={
          ctx.menuOnly
            ? "Your menu, hours, and public listing."
            : "Store status, live orders, and what needs your attention today."
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
              {ctx.menuOnly
                ? "— finish the checklist so your menu appears on the pod page."
                : "— finish the checklist so customers can order without surprises."}
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
          menuOnly={ctx.menuOnly}
        />

        {/* Menu-only keeps live-order tooling only while a ticket still needs finishing. */}
        {!ctx.menuOnly || hasActiveOrders ? (
          <VendorDashboardActiveOrdersSection
            vendorId={vendorId}
            vendorDeliverectChannelLinkId={ctx.vendor.deliverectChannelLinkId}
            initialVendorOrders={ctx.initialVendorOrdersForClient}
            initialNowMs={ctx.initialNowMs}
            isDeliverectLive={ctx.isDeliverectLive}
            squareStatusSyncConfigured={ctx.squareStatusSyncConfigured}
            orderRoutingMode={ctx.vendorRecord.orderRoutingMode}
            posManaged={ctx.posManaged}
            activeCounts={ctx.activeCounts}
          />
        ) : null}

        <VendorNeedsAttentionSection
          vendorId={vendorId}
          items={ctx.attentionItems}
          setupComplete={ctx.setupComplete}
        />

        {!ctx.menuOnly ? <VendorTodayPerformanceSection stats={ctx.todayStats} /> : null}

        <VendorQuickLinksSection vendorId={vendorId} menuOnly={ctx.menuOnly} />
      </div>
    </DashboardShell>
  );
}
