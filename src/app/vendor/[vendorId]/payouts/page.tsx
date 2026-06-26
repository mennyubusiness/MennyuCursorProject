import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import { env } from "@/lib/env";
import { retrieveAndSyncVendorConnectedAccount } from "@/services/stripe-connect.service";
import { getVendorPayoutSummary } from "@/services/vendor-payout-summary.service";
import { prisma } from "@/lib/db";
import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { VENDOR_STRIPE_COPY } from "@/lib/vendor-operational-copy";
import { vendorStripeConnectionLabel } from "@/lib/vendor-payout-vendor-display";
import { VendorStripePayoutCard } from "../settings/VendorStripePayoutCard";
import { VendorPayoutTransferHistory } from "./VendorPayoutTransferHistory";

function countStripeRequirementsDue(value: unknown): number {
  if (value == null) return 0;
  return Array.isArray(value) ? value.length : 0;
}

export default async function VendorPayoutsPage({
  params,
  searchParams,
}: {
  params: Promise<{ vendorId: string }>;
  searchParams: Promise<{ stripe_connect?: string; payout_notice?: string }>;
}) {
  const { vendorId } = await params;
  const sp = await searchParams;
  const session = await auth();

  const connect = sp.stripe_connect;
  if (connect === "return" || connect === "refresh") {
    const userId = session?.user?.id;
    if (userId && (await canManageVendor(userId, vendorId))) {
      try {
        await retrieveAndSyncVendorConnectedAccount(vendorId);
      } catch (e) {
        console.error("[vendor payouts] Stripe Connect sync failed", e);
      }
    }
    const qs = connect === "refresh" ? "?payout_notice=link_expired" : "";
    redirect(`/vendor/${vendorId}/payouts${qs}`);
  }

  const [vendor, payoutSummary] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        stripeConnectedAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeOnboardingCompletedAt: true,
        stripeRequirementsCurrentlyDue: true,
      },
    }),
    getVendorPayoutSummary(vendorId),
  ]);
  if (!vendor) notFound();

  const requirementsPending = countStripeRequirementsDue(vendor.stripeRequirementsCurrentlyDue) > 0;
  const stripeStatus = vendorStripeConnectionLabel({
    chargesEnabled: vendor.stripeChargesEnabled ?? false,
    payoutsEnabled: vendor.stripePayoutsEnabled ?? false,
    hasAccount: Boolean(vendor.stripeConnectedAccountId?.trim()),
    requirementsPending,
  });

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Payouts"
        description="Payment setup and transfer history. This stays out of your daily order flow on purpose."
      />

      <div className="mt-8 space-y-8">
        <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
          <p className="text-sm text-oo-stone-gray">{VENDOR_STRIPE_COPY}</p>
          <p className="mt-2 text-sm font-medium text-oo-charcoal">{stripeStatus}</p>
          {!vendor.stripeChargesEnabled || !vendor.stripePayoutsEnabled ? (
            <p className="mt-2 text-sm text-amber-950">
              Finish payment setup before accepting paid orders.
            </p>
          ) : null}
        </section>

        <VendorStripePayoutCard
          vendorId={vendor.id}
          stripeConnectConfigured={Boolean(env.STRIPE_SECRET_KEY)}
          stripeConnectedAccountId={vendor.stripeConnectedAccountId ?? null}
          stripeChargesEnabled={vendor.stripeChargesEnabled ?? false}
          stripePayoutsEnabled={vendor.stripePayoutsEnabled ?? false}
          stripeOnboardingCompletedAt={vendor.stripeOnboardingCompletedAt?.toISOString() ?? null}
          requirementsPendingCount={countStripeRequirementsDue(vendor.stripeRequirementsCurrentlyDue)}
          payoutNotice={sp.payout_notice === "link_expired" ? "link_expired" : null}
        />

        <VendorPayoutTransferHistory summary={payoutSummary} />
      </div>
    </DashboardShell>
  );
}
