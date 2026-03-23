import type { CanonicalMenuDiff } from "@/domain/menu-import/canonical-diff";

export type PublishSummaryMode = "diff" | "firstPublish" | "draftCounts";

export type SummaryRow = { label: string; value: number };

/** Friendly labels for “what changed” (shared by publish dialog + review summary). */
export function buildPublishSummaryRows(
  summary: CanonicalMenuDiff["summary"],
  mode: PublishSummaryMode
): SummaryRow[] {
  const rows: SummaryRow[] =
    mode === "draftCounts"
      ? [
          { label: "Categories", value: summary.addedCategories },
          { label: "Products", value: summary.addedProducts },
          { label: "Modifier groups", value: summary.addedModifierGroups },
          { label: "Modifier options", value: summary.addedModifierOptions },
        ]
      : [
          { label: "Categories added", value: summary.addedCategories },
          { label: "Categories removed", value: summary.removedCategories },
          { label: "Categories changed", value: summary.changedCategories },
          { label: "Products added", value: summary.addedProducts },
          { label: "Products removed", value: summary.removedProducts },
          { label: "Price changes", value: summary.changedPrices },
          { label: "Other product changes", value: summary.changedProductsOther },
          { label: "Modifier groups added", value: summary.addedModifierGroups },
          { label: "Modifier groups removed", value: summary.removedModifierGroups },
          { label: "Modifier groups changed", value: summary.changedModifierGroups },
          { label: "Modifier options added", value: summary.addedModifierOptions },
          { label: "Modifier options removed", value: summary.removedModifierOptions },
          { label: "Modifier options changed", value: summary.changedModifierOptions },
        ];
  if (mode === "firstPublish") {
    return rows.filter((r) => !r.label.includes("removed") && !r.label.includes("changed"));
  }
  return rows;
}
