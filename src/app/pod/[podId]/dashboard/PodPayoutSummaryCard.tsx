import Link from "next/link";
import type { PodOwnerPayoutSummary } from "@/services/pod-payout-summary.service";
import { DashboardCard } from "@/components/dashboard";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function PodPayoutSummaryCard({
  podId,
  summary,
}: {
  podId: string;
  summary: PodOwnerPayoutSummary;
}) {
  const setupHref = `/pod/${podId}/payouts`;

  return (
    <DashboardCard
      title="Pod payouts"
      description="Track the pod share calculated from eligible food sales."
      className="h-full"
    >
      {!summary.enabled ? (
        <p className="text-sm text-oo-stone-gray">
          Pod payouts are not enabled for this pod yet.
        </p>
      ) : !summary.payoutSetupReady ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
            <p className="text-sm font-medium text-amber-950">Payout account setup needed</p>
            <p className="mt-1 text-xs text-amber-900/90">{summary.payoutSetupStatus}</p>
          </div>

          {summary.pendingAllocationCount > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
                Pending calculated payout
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-oo-charcoal">
                {formatMoney(summary.pendingAllocationAmountCents)}
              </p>
              <p className="mt-1 text-xs text-oo-stone-gray">
                Calculated from eligible food sales. Not ready to send until your payout account is
                set up.
              </p>
            </div>
          ) : null}

          <Link
            href={setupHref}
            className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
          >
            Set up payout account
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
                Pending calculated payout
              </dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-oo-charcoal">
                {formatMoney(summary.pendingAllocationAmountCents)}
              </dd>
              {summary.pendingAllocationCount > 0 ? (
                <dd className="mt-0.5 text-xs text-oo-stone-gray">
                  {summary.pendingAllocationCount} calculated record
                  {summary.pendingAllocationCount === 1 ? "" : "s"}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
                Pod share
              </dt>
              <dd className="mt-1 text-lg font-semibold text-oo-charcoal">
                {summary.podSharePercentLabel}
              </dd>
            </div>
            {summary.needsReviewCount > 0 ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
                  Needs review
                </dt>
                <dd className="mt-1 text-sm font-medium text-orange-900">
                  {summary.needsReviewCount} item{summary.needsReviewCount === 1 ? "" : "s"}
                </dd>
                {summary.blockedAmountCents > 0 ? (
                  <dd className="mt-0.5 text-xs text-oo-stone-gray">
                    {formatMoney(summary.blockedAmountCents)} affected
                  </dd>
                ) : null}
              </div>
            ) : null}
            {summary.lastTransferAmountCents != null && summary.lastTransferDate ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
                  Last payout
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-oo-charcoal">
                  {formatMoney(summary.lastTransferAmountCents)}
                </dd>
                <dd className="mt-0.5 text-xs text-oo-stone-gray">
                  {formatDate(summary.lastTransferDate)}
                  {summary.lastTransferStatus ? ` · ${summary.lastTransferStatus}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>

          {summary.recentTransfers.length > 0 ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
                Recent transfers
              </p>
              <ul className="mt-2 space-y-2">
                {summary.recentTransfers.slice(0, 5).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2 text-sm"
                  >
                    <span className="text-oo-stone-gray">{formatDate(row.date)}</span>
                    <span className="font-medium tabular-nums text-oo-charcoal">
                      {formatMoney(row.amountCents)}
                    </span>
                    <span className="text-xs text-oo-stone-gray">{row.statusLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-oo-stone-gray">
            Transfers are sent manually by Open Order during beta.
          </p>

          <Link
            href={setupHref}
            className="inline-flex text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Payout settings
          </Link>
        </div>
      )}
    </DashboardCard>
  );
}
