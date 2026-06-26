import { DashboardCard } from "@/components/dashboard";
import type { PodOwnerPayoutHistoryRow } from "@/services/pod-payout-summary.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function statusTone(statusLabel: string): string {
  switch (statusLabel) {
    case "Paid":
      return "bg-emerald-50 text-emerald-900";
    case "Pending":
      return "bg-sky-50 text-sky-900";
    case "Cancelled":
      return "bg-oo-cream text-oo-stone-gray";
    case "Failed":
      return "bg-red-50 text-red-800";
    default:
      return "bg-amber-50 text-amber-950";
  }
}

export function PodPayoutHistorySection({
  enabled,
  payoutHistory,
}: {
  enabled: boolean;
  payoutHistory: PodOwnerPayoutHistoryRow[];
}) {
  return (
    <DashboardCard
      title="Payout history"
      description="Track pod owner payments from eligible Open Order sales."
      as="section"
    >
      {!enabled ? (
        <p className="text-sm text-oo-stone-gray">Payout history will appear when pod payouts are enabled.</p>
      ) : payoutHistory.length === 0 ? (
        <div className="rounded-xl border border-dashed border-oo-light-stone bg-oo-cream/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-oo-charcoal">No payouts yet.</p>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Payouts will appear here after Open Order sends pod owner payments.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-oo-light-stone text-oo-stone-gray">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payoutHistory.map((row) => (
                <tr key={row.id} className="border-b border-oo-light-stone/70">
                  <td className="px-3 py-2.5 text-oo-charcoal">{formatDate(row.date)}</td>
                  <td className="px-3 py-2.5 font-medium tabular-nums text-oo-charcoal">
                    {formatMoney(row.amountCents)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone(row.statusLabel)}`}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {enabled ? (
        <p className="mt-4 text-xs text-oo-stone-gray">
          Payouts are sent manually by Open Order during beta.
        </p>
      ) : null}
    </DashboardCard>
  );
}
