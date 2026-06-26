import { vendorPayoutTransferStatusLabel } from "@/lib/vendor-payout-vendor-display";
import type { VendorPayoutSummary } from "@/services/vendor-payout-summary.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(iso)
    );
  } catch {
    return "—";
  }
}

export function VendorPayoutTransferHistory({ summary }: { summary: VendorPayoutSummary }) {
  const hasTransfers = summary.transfers.length > 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Estimated earnings", value: formatMoney(summary.estimatedEarningsCents) },
          { label: "Tips (completed orders)", value: formatMoney(summary.tipsCents) },
          { label: "Pending transfers", value: formatMoney(summary.pendingTransferCents) },
          { label: "Paid transfers", value: formatMoney(summary.paidTransferCents) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-medium text-oo-stone-gray">{card.label}</p>
            <p className="mt-1 text-lg font-bold text-oo-charcoal">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-oo-charcoal">Transfer history</h2>
        {!hasTransfers ? (
          <p className="mt-3 text-sm text-oo-stone-gray">No transfers yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-oo-light-stone">
            {summary.transfers.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium text-oo-charcoal">{formatMoney(row.amountCents)}</p>
                  <p className="mt-0.5 text-xs text-oo-stone-gray">
                    {formatDate(row.submittedAt ?? row.createdAt)}
                    {row.pickupHint ? ` · ${row.pickupHint}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-oo-cream px-2.5 py-0.5 text-xs font-medium text-oo-charcoal">
                  {vendorPayoutTransferStatusLabel(row.status, row.blockedReason)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
