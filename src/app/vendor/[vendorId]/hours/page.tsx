import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";
import { VENDOR_POS_HOURS_MANAGED_COPY } from "@/lib/vendor-operational-copy";
import { VendorOrdersOperationsBar } from "../dashboard/VendorOrdersOperationsBar";
import { VendorStoreStatusCard } from "../dashboard/VendorStoreStatusCard";

export default async function VendorHoursPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const ctx = await loadVendorDashboardContext(vendorId);
  if (!ctx) notFound();

  const isClosed = ctx.intakeLabel === "Closed" || ctx.intakeLabel === "Not ready";

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Hours"
        description="See whether you are accepting orders, pause intake, and understand your store status."
      />

      <div className="mt-8 space-y-6">
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
        />

        {isClosed ? (
          <p className="rounded-xl border border-oo-light-stone bg-oo-cream/60 px-4 py-3 text-sm text-oo-stone-gray">
            This vendor is currently closed for new orders.
            {ctx.intakeLabel === "Not ready" ? " Finish setup on the Setup page first." : null}
          </p>
        ) : null}

        <section className="rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-oo-charcoal">Order intake</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Pause when you need a break. Customers cannot start new orders while paused.
          </p>
          {ctx.posManaged ? (
            <p className="mt-4 text-sm text-oo-stone-gray">{VENDOR_POS_HOURS_MANAGED_COPY}</p>
          ) : null}
          <div className="mt-4">
            <VendorOrdersOperationsBar
              vendorId={vendorId}
              initialPaused={ctx.vendorRecord.mennyuOrdersPaused ?? false}
              posOpen={undefined}
              layout="default"
              posManaged={ctx.posManaged}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-oo-light-stone bg-oo-cream/50 p-5 text-sm text-oo-stone-gray">
          <h2 className="text-base font-semibold text-oo-charcoal">Regular weekly hours</h2>
          <p className="mt-2">No regular hours have been set in Open Order yet.</p>
          {ctx.posManaged ? (
            <p className="mt-2">Availability is managed by your POS.</p>
          ) : (
            <p className="mt-2">
              Contact your pod owner if customers should see different hours on the menu page.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-dashed border-oo-light-stone bg-oo-warm-white/80 p-5 text-sm text-oo-stone-gray">
          <h2 className="text-base font-semibold text-oo-charcoal">Temporary closures</h2>
          <p className="mt-2">
            Holiday hours and one-off closures are not editable here yet. Use pause orders above for short breaks.
          </p>
          <Link
            href={`/vendor/${vendorId}/settings?section=profile`}
            className="mt-3 inline-block font-medium text-oo-charcoal underline"
          >
            Update business profile in settings
          </Link>
        </section>
      </div>
    </DashboardShell>
  );
}
