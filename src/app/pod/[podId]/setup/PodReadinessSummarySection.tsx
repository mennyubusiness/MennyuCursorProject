import type { PodReadinessPageSummary } from "@/lib/pod-readiness-page";

export function PodReadinessSummarySection({ summary }: { summary: PodReadinessPageSummary }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-oo-charcoal">Readiness summary</h2>
      <div
        className={`rounded-xl border px-4 py-3 ${
          summary.allReady
            ? "border-emerald-200/80 bg-emerald-50/40"
            : "border-oo-light-stone bg-oo-cream/40"
        }`}
      >
        <p className="text-sm font-medium text-oo-charcoal">{summary.headline}</p>
        <p className="mt-1 text-sm text-oo-stone-gray">{summary.detail}</p>
        {summary.vendorTotalCount > 0 ? (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-oo-stone-gray">Pod checks</dt>
              <dd className="font-medium text-oo-charcoal">
                {summary.podCompleteCount} of {summary.podTotalCount} complete
              </dd>
            </div>
            <div>
              <dt className="text-xs text-oo-stone-gray">Vendors ready</dt>
              <dd className="font-medium text-oo-charcoal">
                {summary.vendorsReadyCount} of {summary.vendorTotalCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-oo-stone-gray">Needs attention</dt>
              <dd className="font-medium text-oo-charcoal">{summary.needsAttentionCount}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
