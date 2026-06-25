"use client";

import type { AdminPodDetailLayoutState } from "@/lib/admin-pod-detail-layout";
import {
  podRevenueShareBpsToPercentLabel,
} from "@/lib/pod-payout-settings";
import type { PodPayoutAllocationSummary } from "@/services/pod-payout-settings.service";
import type { PodPayoutConnectStatusView } from "@/lib/pod-payout-connect-status";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function payoutAccountStatusLabel(
  connectReady: boolean,
  recipientConnectStatus: PodPayoutConnectStatusView | null,
  recipientId: string | null
): string {
  if (connectReady) return "Ready";
  if (recipientConnectStatus?.adminLabel) return recipientConnectStatus.adminLabel;
  return recipientId ? "Not started" : "No owner selected";
}

export function PodPayoutSummaryCard({
  podId,
  settings,
  allocationSummary,
  recipientConnectStatus,
  layout,
  onManageSettings,
  onViewDetails,
}: {
  podId: string;
  settings: {
    podPayoutsEnabled: boolean;
    podRevenueShareBps: number;
    podPayoutRecipientUserId: string | null;
    minimumPayoutCents: number;
  } | null;
  allocationSummary: PodPayoutAllocationSummary;
  recipientConnectStatus: PodPayoutConnectStatusView | null;
  layout: AdminPodDetailLayoutState;
  onManageSettings: () => void;
  onViewDetails: () => void;
}) {
  const enabled = settings?.podPayoutsEnabled ?? false;
  const bps = settings?.podRevenueShareBps ?? 0;
  const minimumCents = settings?.minimumPayoutCents ?? 0;
  const recipientId = settings?.podPayoutRecipientUserId ?? null;
  const connectReady = recipientConnectStatus?.ready ?? false;
  const payoutAccountStatus = payoutAccountStatusLabel(connectReady, recipientConnectStatus, recipientId);

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-oo-charcoal">Pod payouts</h2>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Pod payouts are calculated from eligible food sales. Transfers are not active yet.
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

      {layout.hasPayoutIssues ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          This pod has payout items that need attention. Open payout details to review.
        </p>
      ) : null}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-oo-stone-gray">Pod share</dt>
          <dd className="mt-0.5 text-sm font-medium text-oo-charcoal">
            {enabled && bps > 0 ? podRevenueShareBpsToPercentLabel(bps) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Minimum payout</dt>
          <dd className="mt-0.5 text-sm font-medium text-oo-charcoal">
            {minimumCents > 0 ? formatMoney(minimumCents) : "No minimum"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Payout account</dt>
          <dd className="mt-0.5 text-sm font-medium text-oo-charcoal">{payoutAccountStatus}</dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Needs review</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {formatMoney(allocationSummary.blocked.amountCents)}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({allocationSummary.blocked.count})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Pending</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {formatMoney(allocationSummary.pending.amountCents)}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({allocationSummary.pending.count})
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onManageSettings}
          className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-warm-white"
        >
          Manage payout settings
        </button>
        <button
          type="button"
          onClick={onViewDetails}
          className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-warm-white"
        >
          View payout details
        </button>
      </div>

      <input type="hidden" name="podId" value={podId} readOnly />
    </section>
  );
}
