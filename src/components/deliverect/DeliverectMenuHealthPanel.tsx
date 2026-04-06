import Link from "next/link";
import type { DeliverectMenuIntegrityReport } from "@/services/deliverect-menu-integrity.service";

function severityBadgeClass(s: string): string {
  switch (s) {
    case "critical":
      return "border-red-200 bg-red-50 text-red-900";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-950";
    default:
      return "border-stone-200 bg-stone-50 text-stone-800";
  }
}

export function DeliverectMenuHealthPanel({
  report,
  adminMappingHref,
  title = "Menu mapping health",
}: {
  report: DeliverectMenuIntegrityReport;
  /** When set, show admin link to Deliverect mapping tools. */
  adminMappingHref?: string;
  title?: string;
}) {
  const { deliverectReady, deliverectRouted, criticalCount, warningCount, findings } = report;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
          <p className="mt-1 text-sm text-stone-700">
            {deliverectRouted ? (
              <>
                <span className={deliverectReady ? "font-medium text-emerald-800" : "font-medium text-red-800"}>
                  {deliverectReady ? "Deliverect-ready" : "Not ready — fix critical issues"}
                </span>
                <span className="text-stone-500">
                  {" "}
                  · {criticalCount} critical · {warningCount} warning
                  {report.infoCount > 0 ? ` · ${report.infoCount} info` : ""}
                </span>
              </>
            ) : (
              <span className="font-medium text-stone-600">Deliverect routing not configured (no channel link)</span>
            )}
          </p>
        </div>
        {adminMappingHref ? (
          <Link
            href={adminMappingHref}
            className="shrink-0 text-xs font-medium text-stone-700 underline hover:text-stone-900"
          >
            ID mapping →
          </Link>
        ) : null}
      </div>

      {findings.length > 0 && (
        <details className="mt-3 border-t border-stone-100 pt-3">
          <summary className="cursor-pointer text-xs font-medium text-stone-600 hover:text-stone-900">
            View {findings.length} finding{findings.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto text-xs">
            {findings.map((f, i) => (
              <li
                key={i}
                className={`rounded border px-2 py-1.5 ${severityBadgeClass(f.severity)}`}
              >
                <div className="font-medium">
                  <span className="uppercase">{f.severity}</span> · {f.type}
                </div>
                <div className="mt-0.5 leading-snug">{f.message}</div>
                {f.suggestedFix ? (
                  <div className="mt-1 text-[11px] opacity-90">Fix: {f.suggestedFix}</div>
                ) : null}
                {(f.menuItemName || f.modifierOptionName) && (
                  <div className="mt-1 font-mono text-[10px] opacity-80">
                    {f.menuItemId ? `item ${f.menuItemId}` : null}
                    {f.modifierOptionId ? `option ${f.modifierOptionId}` : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {deliverectRouted && deliverectReady && findings.length === 0 && (
        <p className="mt-2 text-xs text-stone-500">No integrity issues detected for the current operational menu.</p>
      )}
    </div>
  );
}
