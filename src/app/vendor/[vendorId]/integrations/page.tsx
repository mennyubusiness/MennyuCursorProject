import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardCard, DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { VendorIntegrationReadinessCard } from "@/components/vendor/VendorIntegrationReadinessCard";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { canViewVendor } from "@/lib/permissions";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";
import {
  getProviderDisplayProfile,
  vendorIntegrationsHubDescription,
} from "@/lib/integrations/provider-display";
import { getVendorIntegrationObservability } from "@/lib/integrations/provider-observability.service";
import {
  isDeliverectRoutingMode,
  isManualDashboardRoutingMode,
  isSquareRoutingMode,
} from "@/lib/vendor-order-routing-mode";

export default async function VendorIntegrationsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildLoginHrefWithReturn(`/vendor/${vendorId}/integrations`));
  }
  if (!(await canViewVendor(session.user.id, vendorId))) notFound();

  const ctx = await loadVendorDashboardContext(vendorId);
  if (!ctx) notFound();

  const routingMode = ctx.vendorRecord.orderRoutingMode;
  const profile = getProviderDisplayProfile(routingMode);
  const observability = await getVendorIntegrationObservability(vendorId);

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Integrations"
        description={vendorIntegrationsHubDescription(routingMode)}
        actions={
          <Link
            href={`/vendor/${vendorId}/setup`}
            className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Back to setup
          </Link>
        }
      />

      <div className="mt-8 space-y-6">
        <DashboardCard className="max-w-3xl">
          <h3 className="text-sm font-semibold text-oo-charcoal">Active routing</h3>
          <p className="mt-1 text-sm text-oo-stone-gray">{profile.routingDescription}</p>
          <p className="mt-2 text-xs text-oo-stone-gray">
            Connected as: <span className="font-medium text-oo-charcoal">{profile.connectedLabel}</span>
          </p>
        </DashboardCard>

        {observability ? (
          <VendorIntegrationReadinessCard
            observability={observability}
            squareOrderRoutingEnabled={ctx.vendorRecord.squareOrderRoutingEnabled ?? false}
          />
        ) : null}

        <section className="max-w-3xl space-y-3">
          <h3 className="text-sm font-semibold text-oo-charcoal">Provider connections</h3>

          {isSquareRoutingMode(routingMode) ? (
            <DashboardCard>
              <h4 className="text-sm font-medium text-oo-charcoal">Square</h4>
              <p className="mt-1 text-xs text-oo-stone-gray">
                OAuth connection, location selection, and catalog import.
              </p>
              <Link
                href={`/vendor/${vendorId}/integrations/square`}
                className="mt-3 inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
              >
                Manage Square integration
              </Link>
            </DashboardCard>
          ) : null}

          {isDeliverectRoutingMode(routingMode) ? (
            <DashboardCard>
              <h4 className="text-sm font-medium text-oo-charcoal">Deliverect</h4>
              <p className="mt-1 text-xs text-oo-stone-gray">
                Channel link, POS mapping, and menu sync through Deliverect.
              </p>
              <Link
                href={`/vendor/${vendorId}/connect-pos`}
                className="mt-3 inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
              >
                Manage Deliverect connection
              </Link>
            </DashboardCard>
          ) : null}

          {isManualDashboardRoutingMode(routingMode) ? (
            <DashboardCard>
              <h4 className="text-sm font-medium text-oo-charcoal">Open Order Dashboard</h4>
              <p className="mt-1 text-xs text-oo-stone-gray">
                Orders appear in Kitchen mode and the vendor dashboard. No POS connection is required.
              </p>
              <Link
                href={`/vendor/${vendorId}/kitchen`}
                className="mt-3 inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
              >
                Open kitchen mode
              </Link>
            </DashboardCard>
          ) : null}
        </section>
      </div>
    </DashboardShell>
  );
}
