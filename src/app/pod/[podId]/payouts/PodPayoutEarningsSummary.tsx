import { DashboardMetricCard, DashboardMetricGrid } from "@/components/dashboard";
import type { PodOwnerPayoutSummary } from "@/services/pod-payout-summary.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function PodPayoutEarningsSummary({ summary }: { summary: PodOwnerPayoutSummary }) {
  if (!summary.enabled) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-oo-charcoal">Earnings summary</h2>
        <p className="text-sm text-oo-stone-gray">Pod payouts are not enabled for this pod yet.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Earnings summary</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Your pod revenue share from eligible Open Order sales.
        </p>
      </div>

      <DashboardMetricGrid>
        <DashboardMetricCard
          label="Pending payout"
          value={formatMoney(summary.pendingAllocationAmountCents)}
          helper={
            summary.pendingAllocationCount > 0
              ? `${summary.pendingAllocationCount} payment${summary.pendingAllocationCount === 1 ? "" : "s"} waiting`
              : "Nothing pending right now"
          }
        />
        <DashboardMetricCard
          label="Paid to date"
          value={formatMoney(summary.sentAmountCents)}
          helper={
            summary.sentCount > 0
              ? `${summary.sentCount} payout${summary.sentCount === 1 ? "" : "s"} sent`
              : "No payouts sent yet"
          }
          tone={summary.sentAmountCents > 0 ? "success" : "default"}
        />
        <DashboardMetricCard
          label="Eligible sales"
          value={formatMoney(summary.eligibleSalesCents)}
          helper="Food sales used to calculate your pod share"
        />
      </DashboardMetricGrid>

      <p className="text-sm text-oo-stone-gray">
        Total pod revenue share:{" "}
        <span className="font-semibold tabular-nums text-oo-charcoal">
          {formatMoney(summary.podRevenueShareCents)}
        </span>
      </p>

      {summary.needsReviewCount > 0 ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-sm text-amber-950">
          {summary.needsReviewCount} payout{summary.needsReviewCount === 1 ? "" : "s"} need review
          {summary.blockedAmountCents > 0
            ? ` (${formatMoney(summary.blockedAmountCents)} affected)`
            : ""}
          .
        </p>
      ) : null}

      {!summary.payoutSetupReady ? (
        <p className="text-sm text-oo-stone-gray">
          Finish payout account setup below before pending amounts can be sent.
        </p>
      ) : null}
    </section>
  );
}
