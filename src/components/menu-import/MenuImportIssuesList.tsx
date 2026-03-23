import { MenuImportIssueSeverity } from "@prisma/client";

function severityBadgeClass(sev: string): string {
  switch (sev) {
    case MenuImportIssueSeverity.blocking:
      return "bg-red-100 text-red-900 border-red-200";
    case MenuImportIssueSeverity.warning:
      return "bg-amber-100 text-amber-900 border-amber-200";
    case MenuImportIssueSeverity.info:
      return "bg-sky-100 text-sky-900 border-sky-200";
    default:
      return "bg-stone-100 text-stone-800 border-stone-200";
  }
}

function friendlySeverity(sev: string): string {
  switch (sev) {
    case MenuImportIssueSeverity.blocking:
      return "Blocking";
    case MenuImportIssueSeverity.warning:
      return "Warning";
    case MenuImportIssueSeverity.info:
      return "Info";
    default:
      return sev;
  }
}

export type MenuImportIssueRow = {
  id: string;
  severity: string;
  kind: string;
  code: string;
  message: string;
  entityPath: string | null;
  deliverectId: string | null;
  waived?: boolean;
};

export function MenuImportIssuesList({
  issues,
  showTechnicalMeta = false,
}: {
  issues: MenuImportIssueRow[];
  showTechnicalMeta?: boolean;
}) {
  if (issues.length === 0) {
    return <p className="text-sm text-stone-600">No issues detected for this import.</p>;
  }

  const blocking = issues.filter((i) => i.severity === MenuImportIssueSeverity.blocking);
  const nonBlocking = issues.filter((i) => i.severity !== MenuImportIssueSeverity.blocking);

  const renderIssue = (i: MenuImportIssueRow) => (
    <li key={i.id} className="py-3 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${severityBadgeClass(i.severity)}`}>
          {friendlySeverity(i.severity)}
          {i.waived && i.severity === MenuImportIssueSeverity.blocking && (
            <span className="ml-1 font-normal text-stone-600">(waived)</span>
          )}
        </span>
        {showTechnicalMeta && (
          <>
            <span className="font-mono text-xs text-stone-500">{i.kind}</span>
            <span className="font-mono text-sm font-medium text-stone-900">{i.code}</span>
          </>
        )}
      </div>
      <p className="mt-1 text-sm text-stone-800">{i.message}</p>
      {showTechnicalMeta && (i.entityPath || i.deliverectId) && (
        <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-stone-500">
          {i.entityPath && (
            <span>
              path: <span className="font-mono text-stone-700">{i.entityPath}</span>
            </span>
          )}
          {i.deliverectId && (
            <span>
              deliverectId: <span className="font-mono text-stone-700">{i.deliverectId}</span>
            </span>
          )}
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-6">
      {blocking.length > 0 && (
        <div>
          <p className="text-sm font-medium text-red-900">Blocking ({blocking.length})</p>
          <p className="mt-0.5 text-xs text-stone-600">Fix these in Deliverect (or discard this draft) before publishing.</p>
          <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-red-100 bg-red-50/30">
            {blocking.map(renderIssue)}
          </ul>
        </div>
      )}
      {nonBlocking.length > 0 && (
        <div>
          <p className="text-sm font-medium text-stone-800">Warnings &amp; notes ({nonBlocking.length})</p>
          <ul className="mt-2 divide-y divide-stone-100">{nonBlocking.map(renderIssue)}</ul>
        </div>
      )}
    </div>
  );
}
