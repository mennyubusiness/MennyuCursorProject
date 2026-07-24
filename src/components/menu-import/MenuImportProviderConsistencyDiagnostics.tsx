"use client";

import type { MenuProviderConsistencyIssue } from "@/domain/menu-import/menu-provider-consistency";

/**
 * Temporary safe diagnostics for provider/metadata mismatches on a draft menu.
 * Does not show tokens or connection secrets.
 */
export function MenuImportProviderConsistencyDiagnostics({
  issues,
}: {
  issues: MenuProviderConsistencyIssue[];
}) {
  if (issues.length === 0) return null;

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div
      className={`rounded-lg border p-4 text-sm ${
        errors.length > 0
          ? "border-red-200 bg-red-50 text-red-950"
          : "border-amber-200 bg-amber-50 text-amber-950"
      }`}
      role="status"
    >
      <p className="font-medium">
        Menu provider consistency: {errors.length} error{errors.length === 1 ? "" : "s"}
        {warnings.length > 0 ? `, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""}
      </p>
      <p className="mt-1 text-xs opacity-80">
        Flags cross-provider field misuse (e.g. Square items using Deliverect variant-leaf fields).
        No credentials are shown.
      </p>
      <ul className="mt-3 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-xs">
        {issues.slice(0, 20).map((i) => (
          <li key={`${i.code}-${i.productExternalId}`}>
            <span className="font-medium">{i.productName}</span>
            {" — "}
            {i.message}
          </li>
        ))}
        {issues.length > 20 ? <li>…and {issues.length - 20} more</li> : null}
      </ul>
    </div>
  );
}
