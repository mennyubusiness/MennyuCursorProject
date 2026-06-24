"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updatePodPayoutSettingsAction } from "@/actions/admin-pod-payout-settings.actions";
import { podRevenueShareBpsToPercentLabel } from "@/lib/pod-payout-settings";
import type {
  PodPayoutAllocationSummary,
  PodPayoutRecipientOption,
} from "@/services/pod-payout-settings.service";
import type { PodPayoutConnectStatusView } from "@/lib/pod-payout-connect-status";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
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
};

export function PodPayoutSettingsCard({
  podId,
  settings,
  recipientOptions,
  allocationSummary,
  recipientConnectStatus,
}: PodPayoutSettingsCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const enabled = settings?.podPayoutsEnabled ?? false;
  const bps = settings?.podRevenueShareBps ?? 0;
  const recipientId = settings?.podPayoutRecipientUserId ?? "";
  const minimumCents = settings?.minimumPayoutCents ?? 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const result = await updatePodPayoutSettingsAction({
      podId,
      podPayoutsEnabled: fd.get("podPayoutsEnabled") === "on",
      podRevenueShareBps: Number(fd.get("podRevenueShareBps")),
      podPayoutRecipientUserId: String(fd.get("podPayoutRecipientUserId") ?? "") || null,
      minimumPayoutCents: Number(fd.get("minimumPayoutCents")),
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
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Pod payouts</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Revenue share on eligible food subtotal at this pod. Calculation records only — payouts are not sent yet.
          </p>
        </div>
        <span
          className={`mt-2 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium sm:mt-0 ${
            enabled ? "bg-emerald-100 text-emerald-900" : "bg-stone-200 text-oo-charcoal"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 border-b border-oo-light-stone pb-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <dt className="text-xs text-oo-stone-gray">Recipient payout setup</dt>
          <dd className="mt-0.5 text-sm font-medium text-oo-charcoal">
            {recipientConnectStatus?.adminLabel ?? (recipientId ? "Not started" : "No recipient")}
          </dd>
          {recipientId && recipientConnectStatus && !recipientConnectStatus.ready ? (
            <p className="mt-0.5 text-[10px] text-oo-stone-gray">
              Recipient must complete payout setup from pod settings.
            </p>
          ) : null}
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Pending allocations</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {allocationSummary.pending.count}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({formatMoney(allocationSummary.pending.amountCents)})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Blocked allocations</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {allocationSummary.blocked.count}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({formatMoney(allocationSummary.blocked.amountCents)})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Cancelled (refund)</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {allocationSummary.cancelledDueToRefund.count}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Total allocated</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {allocationSummary.total.count}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({formatMoney(allocationSummary.total.amountCents)})
            </span>
          </dd>
        </div>
      </dl>

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
            <span className="font-medium text-oo-charcoal">Revenue share (basis points)</span>
            <input
              name="podRevenueShareBps"
              type="number"
              min={0}
              max={500}
              step={1}
              required
              defaultValue={bps}
              className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 text-oo-charcoal"
            />
            <p className="mt-1 text-xs text-oo-stone-gray">
              {bps > 0 ? podRevenueShareBpsToPercentLabel(bps) : "0.00%"} of eligible food subtotal · max 500 bps (5.00%)
            </p>
          </label>

          <label className="block text-sm">
            <span className="font-medium text-oo-charcoal">Minimum payout (¢)</span>
            <input
              name="minimumPayoutCents"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={minimumCents}
              className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 text-oo-charcoal"
            />
            <p className="mt-1 text-xs text-oo-stone-gray">Used when batch payouts ship (not enforced yet).</p>
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Designated recipient</span>
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
            Must be a pod owner. Required when payouts are enabled.
          </p>
          {recipientOptions.length === 0 ? (
            <p className="mt-1 text-xs text-amber-800">No pod owners found — add an owner membership first.</p>
          ) : null}
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save pod payout settings"}
        </button>
      </form>
    </section>
  );
}
