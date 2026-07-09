import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { VendorSetupChecklist } from "@/components/vendor/VendorSetupChecklist";
import { VendorIntegrationsSection } from "@/components/vendor/VendorSetupIntegrationsSection";
import { VendorSetupStatusBanners } from "@/components/vendor/VendorSetupStatusBanners";
import { buildVendorOperationalSetupItems } from "@/lib/vendor-dashboard-attention";
import { loadVendorIntegrationsViewModel } from "@/lib/vendor-integrations-view.server";
import {
  vendorSetupOperationalLockedDescription,
  vendorSetupPageIncompleteDescription,
} from "@/lib/vendor-order-routing-mode";
import { VENDOR_PUBLIC_APPEARANCE_CHECKLIST_KEYS } from "@/lib/vendor-pod-readiness";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";

export default async function VendorSetupPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const [ctx, integrations] = await Promise.all([
    loadVendorDashboardContext(vendorId),
    loadVendorIntegrationsViewModel(vendorId, "setup"),
  ]);
  if (!ctx || !integrations) notFound();

  const publicProfileReady = ctx.readiness.setupSummary.publicProfile;
  const appearance = ctx.readiness.checklist.filter((item) =>
    (VENDOR_PUBLIC_APPEARANCE_CHECKLIST_KEYS as readonly string[]).includes(item.key)
  );
  const acceptingOrders = publicProfileReady
    ? buildVendorOperationalSetupItems({
        checklist: ctx.readiness.checklist,
        vendorPaused: Boolean(ctx.vendorRecord.mennyuOrdersPaused),
        currentlyOpen: Boolean(ctx.hoursSummary.posOpen) && !ctx.vendorRecord.mennyuOrdersPaused,
        vendorId,
      })
    : [];

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Setup"
        description={
          ctx.setupComplete
            ? "Readiness checklist — everything required before customers can order."
            : vendorSetupPageIncompleteDescription()
        }
        actions={
          ctx.setupComplete ? (
            <Link
              href={`/vendor/${vendorId}/dashboard`}
              className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Back to dashboard
            </Link>
          ) : null
        }
      />

      <div className="mt-8 space-y-8">
        {!ctx.setupComplete ? (
          <VendorSetupStatusBanners
            publicProfileReady={publicProfileReady}
            canAcceptOrders={ctx.readiness.canAcceptOrders}
          />
        ) : null}

        <VendorSetupChecklist items={appearance} title="Required to appear on pod page" />

        {publicProfileReady ? (
          <VendorSetupChecklist items={acceptingOrders} title="Required to accept orders" />
        ) : (
          <section className="rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/40 px-4 py-4 text-sm text-oo-stone-gray">
            <h3 className="font-semibold text-oo-charcoal">Required to accept orders</h3>
            <p className="mt-2">{vendorSetupOperationalLockedDescription()}</p>
          </section>
        )}

        {integrations.model ? (
          <VendorIntegrationsSection model={integrations.model} surface="setup" />
        ) : null}
      </div>
    </DashboardShell>
  );
}
