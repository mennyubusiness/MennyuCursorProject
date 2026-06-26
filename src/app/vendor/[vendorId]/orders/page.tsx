import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
} from "@/components/dashboard";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";
import { VENDOR_POS_BOARD_READONLY_COPY } from "@/lib/vendor-operational-copy";
import { VendorDashboardLiveOrders } from "../dashboard/VendorDashboardLiveOrders";

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
        description="Your operational workbench — active board, history, and kitchen flow."
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
        {ctx.posManaged ? (
          <p className="rounded-xl border border-oo-light-stone bg-oo-cream/60 px-4 py-3 text-sm text-oo-stone-gray">
            {VENDOR_POS_BOARD_READONLY_COPY}
          </p>
        ) : null}

        <DashboardSection
          title="Active orders"
          description="New, preparing, ready, and completed orders from today."
          className="min-w-0"
          contentClassName="space-y-0"
        >
          <VendorDashboardLiveOrders
            vendorId={vendorId}
            vendorDeliverectChannelLinkId={ctx.vendor.deliverectChannelLinkId}
            initialVendorOrders={ctx.initialVendorOrdersForClient}
            initialNowMs={ctx.initialNowMs}
            isDeliverectLive={ctx.isDeliverectLive}
          />
        </DashboardSection>

        <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 text-sm text-oo-stone-gray shadow-sm">
          <h2 className="text-base font-semibold text-oo-charcoal">Order history filters</h2>
          <p className="mt-2">
            Use the completed and cancelled sections above to review past orders. Filter chips for
            today, refunds, and routing issues are coming next — check Issues for open problems.
          </p>
          <Link
            href={`/vendor/${vendorId}/issues`}
            className="mt-3 inline-block font-medium text-oo-charcoal underline"
          >
            View order issues
          </Link>
        </section>
      </div>
    </DashboardShell>
  );
}
