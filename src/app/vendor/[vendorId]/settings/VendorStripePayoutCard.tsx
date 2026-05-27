"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { startVendorStripeConnectOnboarding, syncVendorStripeConnectStatusAction } from "@/actions/vendor-stripe-connect.actions";

export type VendorStripePayoutCardProps = {
  vendorId: string;
  stripeConnectConfigured: boolean;
  stripeConnectedAccountId: string | null;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeOnboardingCompletedAt: string | null;
  requirementsPendingCount: number;
  payoutNotice: "link_expired" | null;
};

export function VendorStripePayoutCard({
  vendorId,
  stripeConnectConfigured,
  stripeConnectedAccountId,
  stripeChargesEnabled,
  stripePayoutsEnabled,
  stripeOnboardingCompletedAt,
  requirementsPendingCount,
  payoutNotice,
}: VendorStripePayoutCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const payoutReady = stripeChargesEnabled && stripePayoutsEnabled;
  const hasAccount = Boolean(stripeConnectedAccountId?.trim());
  const needsFinishVerification = hasAccount && !payoutReady && requirementsPendingCount > 0;

  async function goToStripe() {
    setError(null);
    setPending(true);
    try {
      const r = await startVendorStripeConnectOnboarding(vendorId);
      if (r.ok) {
        window.location.assign(r.url);
        return;
      }
      setError(r.error);
    } finally {
      setPending(false);
    }
  }

  async function refreshStatus() {
    setError(null);
    setPending(true);
    try {
      const r = await syncVendorStripeConnectStatusAction(vendorId);
      if (r.ok) router.refresh();
      else setError(r.error);
    } finally {
      setPending(false);
    }
  }

  if (!stripeConnectConfigured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
        <h4 className="text-base font-semibold text-oo-charcoal">Payouts</h4>
        <p className="mt-2 text-sm text-oo-stone-gray">
          Stripe is not configured on this server. Add <code className="rounded bg-oo-warm-white px-1">STRIPE_SECRET_KEY</code> to
          enable Connect onboarding for testing.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
      <h4 className="text-base font-semibold text-oo-charcoal">Payouts</h4>
      <p className="mt-1 text-sm text-oo-stone-gray">
        Connect a Stripe account so Open Order can pay you for orders (test mode supported).
      </p>

      {payoutNotice === "link_expired" && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          That onboarding link expired. Use the button below to open a fresh one.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {payoutReady ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
            <p className="text-sm font-medium text-emerald-900">Payouts enabled</p>
            <p className="mt-1 text-xs text-emerald-800/90">
              Charges: {stripeChargesEnabled ? "on" : "off"} · Payouts: {stripePayoutsEnabled ? "on" : "off"}
              {stripeOnboardingCompletedAt && (
                <>
                  {" "}
                  · Completed{" "}
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                    new Date(stripeOnboardingCompletedAt)
                  )}
                </>
              )}
            </p>
          </div>
        ) : hasAccount ? (
          <div className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-2">
            <p className="text-sm font-medium text-oo-charcoal">
              {needsFinishVerification ? "Finish verification" : "Continue Stripe onboarding"}
            </p>
            <p className="mt-1 text-xs text-oo-stone-gray">
              {requirementsPendingCount > 0
                ? "Additional information is required before payouts can be enabled."
                : "Complete the steps Stripe needs to enable payouts for this account."}
            </p>
            <p className="mt-1 text-xs text-oo-stone-gray">
              Status: charges {stripeChargesEnabled ? "on" : "off"}, payouts {stripePayoutsEnabled ? "on" : "off"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-oo-stone-gray">Connect your Stripe account to receive payouts from Open Order.</p>
        )}

        {error && (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {!payoutReady && (
            <button
              type="button"
              onClick={() => void goToStripe()}
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {hasAccount ? "Continue in Stripe" : "Set up payouts"}
            </button>
          )}
          {hasAccount && (
            <button
              type="button"
              onClick={() => void refreshStatus()}
              disabled={pending}
              className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
            >
              Refresh status
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
