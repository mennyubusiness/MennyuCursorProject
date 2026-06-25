"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  openPodPayoutAccountManagement,
  startPodPayoutConnectOnboarding,
  syncPodPayoutConnectStatusAction,
} from "@/actions/pod-payout-connect.actions";
import type { PodPayoutConnectStatusView } from "@/lib/pod-payout-connect-status";

export type PodPayoutSetupCardProps = {
  podId: string;
  podPayoutsEnabled: boolean;
  isDesignatedRecipient: boolean;
  stripeConnectConfigured: boolean;
  connectStatus: PodPayoutConnectStatusView | null;
  payoutNotice: "link_expired" | null;
  podSharePercentLabel?: string | null;
  minimumPayoutLabel?: string | null;
};

export function PodPayoutSetupCard({
  podId,
  podPayoutsEnabled,
  isDesignatedRecipient,
  stripeConnectConfigured,
  connectStatus,
  payoutNotice,
  podSharePercentLabel,
  minimumPayoutLabel,
}: PodPayoutSetupCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!podPayoutsEnabled) {
    return (
      <DashboardPayoutSetupShell>
        <p className="text-sm text-oo-stone-gray">
          Pod payouts are not enabled for this pod yet. An Open Order admin will turn this on when your
          pod is ready.
        </p>
      </DashboardPayoutSetupShell>
    );
  }

  if (!isDesignatedRecipient) {
    return (
      <DashboardPayoutSetupShell>
        <p className="text-sm text-oo-stone-gray">
          This pod&apos;s payout account is managed by the payout account owner. Only they can set up or
          manage the Stripe payout account here when signed in with their account.
        </p>
      </DashboardPayoutSetupShell>
    );
  }

  async function goToSetup() {
    setError(null);
    setPending(true);
    try {
      const r = await startPodPayoutConnectOnboarding(podId);
      if (r.ok) {
        window.location.assign(r.url);
        return;
      }
      setError(r.error);
    } finally {
      setPending(false);
    }
  }

  async function goToManage() {
    setError(null);
    setPending(true);
    try {
      const r = await openPodPayoutAccountManagement(podId);
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
      const r = await syncPodPayoutConnectStatusAction(podId);
      if (r.ok) router.refresh();
      else setError(r.error);
    } finally {
      setPending(false);
    }
  }

  if (!stripeConnectConfigured) {
    return (
      <DashboardPayoutSetupShell>
        <p className="text-sm text-oo-stone-gray">
          Payout setup is not available in this environment yet. Contact Open Order support if you need
          help.
        </p>
      </DashboardPayoutSetupShell>
    );
  }

  const ready = connectStatus?.ready ?? false;
  const hasAccount = connectStatus?.hasAccount ?? false;
  const needsAttention = connectStatus?.code === "needs_attention";
  const canManageAccount = ready || needsAttention;

  return (
    <DashboardPayoutSetupShell>
      <p className="text-sm text-oo-stone-gray">
        Set up the payout account used for this pod&apos;s future payout transfers. Pod payout transfers
        are not active yet.
      </p>

      {podSharePercentLabel ? (
        <dl className="mt-4 grid gap-3 rounded-lg border border-oo-light-stone bg-oo-cream/40 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Pod share</dt>
            <dd className="mt-1 text-sm font-medium text-oo-charcoal">{podSharePercentLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
              Minimum payout
            </dt>
            <dd className="mt-1 text-sm font-medium text-oo-charcoal">
              {minimumPayoutLabel ?? "No minimum"}
            </dd>
          </div>
        </dl>
      ) : null}

      <p className="mt-4 text-xs text-oo-stone-gray">
        Transfers are sent manually during beta.
      </p>

      {payoutNotice === "link_expired" && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          That setup link expired. Use the button below to open a fresh one.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {ready ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2">
            <p className="text-sm font-medium text-emerald-900">Payout account ready</p>
            <p className="mt-1 text-xs text-emerald-800/90">
              Your payout account is ready. Pod payout transfers are not active yet.
            </p>
          </div>
        ) : hasAccount ? (
          <div className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-2">
            <p className="text-sm font-medium text-oo-charcoal">
              {needsAttention ? "Additional information required" : "Continue payout setup"}
            </p>
            <p className="mt-1 text-xs text-oo-stone-gray">
              {connectStatus?.requirementsPendingCount
                ? "A few details are still needed before your payout account can be marked ready."
                : "Complete the remaining steps to finish payout setup."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-oo-stone-gray">Payout account setup has not been started yet.</p>
        )}

        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canManageAccount ? (
            <>
              <button
                type="button"
                onClick={() => void goToManage()}
                disabled={pending}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                Manage payout account
              </button>
              <p className="w-full text-xs text-oo-stone-gray">
                Update bank details, business information, or payout account requirements in Stripe.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void goToSetup()}
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
            >
              {hasAccount ? "Continue payout setup" : "Set up payout account"}
            </button>
          )}
          {hasAccount ? (
            <button
              type="button"
              onClick={() => void refreshStatus()}
              disabled={pending}
              className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
            >
              Refresh status
            </button>
          ) : null}
        </div>
      </div>
    </DashboardPayoutSetupShell>
  );
}

function DashboardPayoutSetupShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">{children}</div>
  );
}
