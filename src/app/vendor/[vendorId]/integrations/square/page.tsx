import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { DashboardCard } from "@/components/dashboard";
import { VendorSquareConnectionCard } from "@/components/vendor/VendorSquareConnectionCard";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { canViewVendor } from "@/lib/permissions";
import { getSquareIntegrationUiState } from "@/actions/vendor-square-connect.actions";
import { resolveSquareOAuthUserMessage } from "@/lib/integrations/square/square-oauth-errors";
import { vendorMayConfigurePosOrderRouting } from "@/lib/vendor-routing-availability";

export default async function VendorSquareIntegrationPage({
  params,
  searchParams,
}: {
  params: Promise<{ vendorId: string }>;
  searchParams: Promise<{
    select_location?: string;
    square_connected?: string;
    square_error?: string;
  }>;
}) {
  const { vendorId } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(buildLoginHrefWithReturn(`/vendor/${vendorId}/integrations/square`));
  }
  if (!(await canViewVendor(session.user.id, vendorId))) notFound();

  if (!vendorMayConfigurePosOrderRouting()) {
    return (
      <DashboardShell tier="command" className="px-0 pb-0 pt-0">
        <DashboardPageHeader
          headingLevel={1}
          title="Square integration"
          description="Square order routing is not available. Orders appear in your Open Order dashboard."
          actions={
            <Link
              href={`/vendor/${vendorId}/setup`}
              className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Back to setup
            </Link>
          }
        />
        <DashboardCard className="mt-8 max-w-lg space-y-3">
          <p className="text-sm text-oo-stone-gray">
            Manage incoming orders in Kitchen mode and publish your menu from Menu Builder.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/vendor/${vendorId}/kitchen`}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover"
            >
              Open kitchen mode
            </Link>
            <Link
              href={`/vendor/${vendorId}/menu-builder`}
              className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Open Menu Builder
            </Link>
          </div>
        </DashboardCard>
      </DashboardShell>
    );
  }

  const { snap, connection, health, routingReadiness } = await getSquareIntegrationUiState(vendorId);

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Square integration"
        description="OAuth connection, location selection, and connection health."
        actions={
          <Link
            href={`/vendor/${vendorId}/integrations`}
            className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Back to integrations
          </Link>
        }
      />

      <div className="mt-8 space-y-4">
        {sp.square_connected === "1" ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Square connected successfully.
          </p>
        ) : null}
        {sp.square_error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            Square connection failed: {resolveSquareOAuthUserMessage(sp.square_error)}
          </p>
        ) : null}
        {sp.select_location === "1" && connection?.needsLocationSelection ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Multiple Square locations found — choose which location Open Order should use.
          </p>
        ) : null}

        <VendorSquareConnectionCard
          vendorId={vendorId}
          snap={snap}
          connection={connection}
          health={health}
          routingReadiness={routingReadiness}
        />

        <DashboardCard className="max-w-3xl">
          <h3 className="text-sm font-semibold text-oo-charcoal">Menu import</h3>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Preview and import your Square catalog from Menu Imports. Imports create a draft menu
            for review — they do not publish automatically. After changing Square location, re-import
            and publish before accepting orders.
          </p>
          <Link
            href={`/vendor/${vendorId}/menu/imports`}
            className="mt-4 inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Manage Square menu import
          </Link>
        </DashboardCard>
      </div>
    </DashboardShell>
  );
}
