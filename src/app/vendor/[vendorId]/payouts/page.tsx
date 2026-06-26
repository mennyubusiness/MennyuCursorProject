import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import { env } from "@/lib/env";
import { retrieveAndSyncVendorConnectedAccount } from "@/services/stripe-connect.service";
import { prisma } from "@/lib/db";
import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { VENDOR_STRIPE_COPY } from "@/lib/vendor-operational-copy";
import { VendorStripePayoutCard } from "../settings/VendorStripePayoutCard";

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

  const vendor = await prisma.vendor.findUnique({
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
  });
  if (!vendor) notFound();

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Payouts"
        description="Payment setup and Stripe account status. This stays out of your daily order flow on purpose."
      />

      <div className="mt-8 space-y-6">
        <p className="text-sm text-oo-stone-gray">{VENDOR_STRIPE_COPY}</p>
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
      </div>
    </DashboardShell>
  );
}
