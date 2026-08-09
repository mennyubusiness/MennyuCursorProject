import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { VendorIntegrationsSection } from "@/components/vendor/VendorSetupIntegrationsSection";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { canViewVendor } from "@/lib/permissions";
import { vendorIntegrationsHubDescription } from "@/lib/integrations/provider-display";
import { loadVendorIntegrationsViewModel } from "@/lib/vendor-integrations-view.server";
import { vendorMayConfigurePosOrderRouting } from "@/lib/vendor-routing-availability";

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

  const integrations = await loadVendorIntegrationsViewModel(vendorId, "hub");
  if (!integrations) notFound();

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title={vendorMayConfigurePosOrderRouting() ? "Integrations" : "Orders & menu"}
        description={
          vendorMayConfigurePosOrderRouting()
            ? vendorIntegrationsHubDescription(integrations.orderRoutingMode)
            : "Orders appear in your Open Order dashboard. Build and publish your menu in Menu Builder."
        }
        actions={
          <Link
            href={`/vendor/${vendorId}/setup`}
            className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Back to setup
          </Link>
        }
      />

      <div className="mt-8">
        {integrations.model ? (
          <VendorIntegrationsSection
            model={integrations.model}
            surface="hub"
            showHeading={false}
          />
        ) : null}
      </div>
    </DashboardShell>
  );
}
