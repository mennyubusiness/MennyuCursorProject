"use client";

import type { CustomerMenuBrowseExclusion } from "@/domain/menu-import/customer-menu-browse";

/**
 * Temporary safe diagnostics for draft items that the customer storefront would hide.
 * Does not show tokens or connection secrets.
 */
export function MenuImportBrowseExclusionDiagnostics({
  exclusions,
}: {
  exclusions: CustomerMenuBrowseExclusion[];
}) {
  if (exclusions.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
      role="status"
    >
      <p className="font-medium">
        {exclusions.length} draft item{exclusions.length === 1 ? "" : "s"} would be hidden on the
        customer menu after publish
      </p>
      <p className="mt-1 text-xs text-amber-900/80">
        Same browse rules as the live storefront (variant leaves and uncategorized modifier-only
        SKUs). Fix import mapping rather than relying on these items appearing as top-level tiles.
      </p>
      <ul className="mt-3 max-h-48 list-inside list-disc space-y-1 overflow-y-auto text-xs">
        {exclusions.slice(0, 20).map((e) => (
          <li key={e.productDeliverectId}>
            <span className="font-medium">{e.productName}</span>
            {" — "}
            {e.detail}
          </li>
        ))}
        {exclusions.length > 20 ? <li>…and {exclusions.length - 20} more</li> : null}
      </ul>
    </div>
  );
}
