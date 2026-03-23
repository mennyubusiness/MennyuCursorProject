import type { CanonicalMenuDiff } from "@/domain/menu-import/canonical-diff";
import { buildPublishSummaryRows, type PublishSummaryMode } from "@/domain/menu-import/publish-summary-rows";

export function MenuImportWhatChanged({
  summary,
  summaryMode,
}: {
  summary: CanonicalMenuDiff["summary"] | null;
  summaryMode: PublishSummaryMode;
}) {
  if (!summary) {
    return <p className="text-sm text-stone-600">No draft summary available.</p>;
  }
  const rows = buildPublishSummaryRows(summary, summaryMode).filter((r) => r.value > 0);
  if (rows.length === 0) {
    return (
      <p className="text-sm text-stone-600">
        No structural changes compared to your live menu (or counts are zero).
      </p>
    );
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-stone-800">
      {rows.slice(0, 10).map((r) => (
        <li key={r.label}>
          <strong>{r.value}</strong> {r.label.toLowerCase()}
        </li>
      ))}
    </ul>
  );
}
