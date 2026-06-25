"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updatePodPayoutSettingsAction } from "@/actions/admin-pod-payout-settings.actions";
import {
  formatMinimumPayoutDollarsForInput,
  formatPodSharePercentForInput,
  minimumPayoutDollarsToCents,
  podRevenueShareBpsToPercentLabel,
  podRevenueSharePercentToBps,
} from "@/lib/pod-payout-settings";
import type {
  PodPayoutAllocationSummary,
  PodPayoutRecipientOption,
} from "@/services/pod-payout-settings.service";
import type { PodPayoutConnectStatusView } from "@/lib/pod-payout-connect-status";

function payoutAccountStatusLabel(
  connectReady: boolean,
  recipientConnectStatus: PodPayoutConnectStatusView | null,
  recipientId: string
): string {
  if (connectReady) return "Ready";
  if (recipientConnectStatus?.adminLabel) return recipientConnectStatus.adminLabel;
  return recipientId ? "Not started" : "No owner selected";
}

export type PodPayoutSettingsCardProps = {
  podId: string;
  settings: {
    podPayoutsEnabled: boolean;
    podRevenueShareBps: number;
    podPayoutRecipientUserId: string | null;
    minimumPayoutCents: number;
  } | null;
  recipientOptions: PodPayoutRecipientOption[];
  allocationSummary: PodPayoutAllocationSummary;
  recipientConnectStatus: PodPayoutConnectStatusView | null;
  showSettingsForm?: boolean;
};

export function PodPayoutSettingsCard({
  podId,
  settings,
  recipientOptions,
  allocationSummary,
  recipientConnectStatus,
  showSettingsForm = true,
}: PodPayoutSettingsCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const enabled = settings?.podPayoutsEnabled ?? false;
  const bps = settings?.podRevenueShareBps ?? 0;
  const recipientId = settings?.podPayoutRecipientUserId ?? "";
  const minimumCents = settings?.minimumPayoutCents ?? 0;
  const payoutAccountOwner = recipientOptions.find((opt) => opt.userId === recipientId);
  const connectReady = recipientConnectStatus?.ready ?? false;
  const showOwnerActionRequired =
    enabled && Boolean(recipientId) && recipientConnectStatus != null && !connectReady;
  const showPayoutAccountReady =
    enabled && Boolean(recipientId) && recipientConnectStatus != null && connectReady;
  const payoutAccountStatus = payoutAccountStatusLabel(connectReady, recipientConnectStatus, recipientId);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const podSharePercent = Number(fd.get("podSharePercent"));
    const minimumPayoutDollars = Number(fd.get("minimumPayoutDollars"));
    const result = await updatePodPayoutSettingsAction({
      podId,
      podPayoutsEnabled: fd.get("podPayoutsEnabled") === "on",
      podRevenueShareBps: podRevenueSharePercentToBps(podSharePercent),
      podPayoutRecipientUserId: String(fd.get("podPayoutRecipientUserId") ?? "") || null,
      minimumPayoutCents: minimumPayoutDollarsToCents(minimumPayoutDollars),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-oo-charcoal">Payout settings</h3>
        <p className="mt-1 text-xs text-oo-stone-gray">
          Configure pod share, minimum payout, and the connected Stripe account for this pod.
        </p>
      </div>

      {showOwnerActionRequired ? (
        <div
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-4"
          data-testid="pod-payout-recipient-action-required"
        >
          <p className="text-sm font-semibold text-amber-950">Payout account owner action required</p>
          <p className="mt-1 text-sm text-amber-900/90">
            Pod payouts are sent to the pod payout account. This owner manages the Stripe payout account
            for the pod and must sign in to finish setup from pod settings. Admins can view status here
            only.
          </p>
          {payoutAccountOwner ? (
            <p className="mt-2 text-sm text-amber-950">
              <span className="font-medium">Account owner:</span> {payoutAccountOwner.displayName} ·{" "}
              {payoutAccountOwner.email}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-amber-950">
            <span className="font-medium">Payout account:</span> {payoutAccountStatus}
          </p>
          <p className="mt-3 text-xs text-amber-900/90">
            Ask the payout account owner to visit{" "}
            <Link
              href={`/pod/${podId}/settings#payout-setup`}
              className="font-medium text-amber-950 underline hover:text-amber-900"
            >
              Pod settings → Payout account
            </Link>{" "}
            while signed in as the payout account owner.
          </p>
        </div>
      ) : null}

      {showPayoutAccountReady ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-sm font-medium text-emerald-900">Payout account ready</p>
          {payoutAccountOwner ? (
            <p className="mt-1 text-xs text-emerald-800/90">
              {payoutAccountOwner.displayName} · {payoutAccountOwner.email}
            </p>
          ) : null}
        </div>
      ) : null}

      {showSettingsForm ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <label className="flex items-center gap-2 text-sm text-oo-charcoal">
            <input
              type="checkbox"
              name="podPayoutsEnabled"
              defaultChecked={enabled}
              className="rounded border-oo-light-stone"
            />
            <span className="font-medium">Enable pod payouts for new orders</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-oo-charcoal">Pod share</span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  name="podSharePercent"
                  type="number"
                  min={0}
                  max={5}
                  step={0.01}
                  required
                  defaultValue={formatPodSharePercentForInput(bps)}
                  className="w-full rounded border border-oo-light-stone px-2 py-1.5 text-oo-charcoal"
                />
                <span className="text-oo-stone-gray">%</span>
              </div>
              <p className="mt-1 text-xs text-oo-stone-gray">
                Percentage of eligible food subtotal paid to the pod. Max 5.00%.
                {bps > 0 ? ` Current: ${podRevenueShareBpsToPercentLabel(bps)}.` : null}
              </p>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-oo-charcoal">Minimum payout</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-oo-stone-gray">$</span>
                <input
                  name="minimumPayoutDollars"
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  defaultValue={formatMinimumPayoutDollarsForInput(minimumCents)}
                  className="w-full rounded border border-oo-light-stone px-2 py-1.5 text-oo-charcoal"
                />
              </div>
              <p className="mt-1 text-xs text-oo-stone-gray">
                Pod payouts below this amount will wait until they are eligible to send.
              </p>
            </label>
          </div>

          <label className="block text-sm">
            <span className="font-medium text-oo-charcoal">Account owner</span>
            <select
              name="podPayoutRecipientUserId"
              defaultValue={recipientId}
              className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 text-oo-charcoal"
            >
              <option value="">— Select pod owner —</option>
              {recipientOptions.map((opt) => (
                <option key={opt.userId} value={opt.userId}>
                  {opt.displayName} · {opt.email}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-oo-stone-gray">
              The connected Stripe account for this pod&apos;s payouts.
            </p>
            {recipientOptions.length === 0 ? (
              <p className="mt-1 text-xs text-amber-800">No pod owners found — add an owner membership first.</p>
            ) : null}
          </label>

          <dl className="grid gap-3 rounded-lg border border-oo-light-stone bg-oo-cream/40 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-oo-stone-gray">Pending</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
                {allocationSummary.pending.count}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-oo-stone-gray">Needs review</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
                {allocationSummary.blocked.count}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-oo-stone-gray">Cancelled</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
                {allocationSummary.cancelledDueToRefund.count}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-oo-stone-gray">Calculated total</dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
                {allocationSummary.total.count}
              </dd>
            </div>
          </dl>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save pod payout settings"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
