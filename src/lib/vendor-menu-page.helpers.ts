import type { CustomerVendorMenuCategorySection } from "@/services/vendor-customer-menu.service";
import type { PublishEligibility } from "@/services/menu-publish-from-canonical.service";

export type LiveMenuSummary = {
  categoryCount: number;
  itemCount: number;
  availableCount: number;
  unavailableCount: number;
};

export type VendorMenuDisplayItem = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  isAvailable: boolean;
  hasMappingWarning: boolean;
};

export function summarizeLiveMenuSections(sections: CustomerVendorMenuCategorySection[]): LiveMenuSummary {
  let itemCount = 0;
  let availableCount = 0;

  for (const section of sections) {
    for (const item of section.items) {
      itemCount += 1;
      if (item.isAvailable) availableCount += 1;
    }
  }

  return {
    categoryCount: sections.length,
    itemCount,
    availableCount,
    unavailableCount: itemCount - availableCount,
  };
}

export function flattenMenuSectionsForDisplay(
  sections: CustomerVendorMenuCategorySection[],
  mappingWarningItemIds: Set<string> = new Set()
): VendorMenuDisplayItem[] {
  const rows: VendorMenuDisplayItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      rows.push({
        id: item.id,
        categoryId: section.id,
        categoryName: section.name,
        name: item.name,
        description: item.description,
        priceCents: item.priceCents,
        imageUrl: item.imageUrl,
        isAvailable: item.isAvailable,
        hasMappingWarning: mappingWarningItemIds.has(item.id),
      });
    }
  }
  return rows;
}

export type MenuSourceLabel = "published_deliverect" | "legacy_active";

export function formatLiveMenuSourceLabel(source: "published_canonical" | "fallback_active_with_deliverect_id"): MenuSourceLabel {
  return source === "published_canonical" ? "published_deliverect" : "legacy_active";
}

export function liveMenuSourceCopy(label: MenuSourceLabel): string {
  return label === "published_deliverect" ? "Deliverect" : "Active items (no published snapshot yet)";
}

export function formatLiveMenuStatusLine(summary: LiveMenuSummary, published: boolean): string {
  const parts = [
    published ? "Published" : "Live items",
    `${summary.categoryCount} categor${summary.categoryCount === 1 ? "y" : "ies"}`,
    `${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"}`,
    `${summary.availableCount} available`,
  ];
  if (summary.unavailableCount > 0) {
    parts.push(`${summary.unavailableCount} unavailable`);
  }
  return parts.join(" · ");
}

export type LatestImportSummary = {
  jobId: string;
  importedAtIso: string;
  sourceLabel: string;
  categoryCount: number | null;
  itemCount: number | null;
  blockingIssueCount: number;
  warningIssueCount: number;
  status: string;
};

export function countMenuImportIssues(
  issues: Array<{ severity: string; waived: boolean }>
): { blocking: number; warning: number } {
  let blocking = 0;
  let warning = 0;
  for (const issue of issues) {
    if (issue.waived) continue;
    if (issue.severity === "blocking") blocking += 1;
    else if (issue.severity === "warning") warning += 1;
  }
  return { blocking, warning };
}

export type VendorMenuPublishGateInput = {
  hasLatestImport: boolean;
  publishEligibility: PublishEligibility;
  posConnected: boolean;
  canManage: boolean;
};

export type VendorMenuPublishGate = {
  canPublish: boolean;
  disabledReasons: string[];
};

export function buildVendorMenuPublishGate(input: VendorMenuPublishGateInput): VendorMenuPublishGate {
  const disabledReasons: string[] = [];

  if (!input.hasLatestImport) {
    disabledReasons.push("No unpublished menu import waiting to publish.");
  }
  if (!input.canManage) {
    disabledReasons.push("You do not have permission to publish menu changes.");
  }
  if (!input.posConnected) {
    disabledReasons.push("POS is not connected — connect Deliverect before publishing.");
  }
  if (!input.publishEligibility.canPublish) {
    disabledReasons.push(...input.publishEligibility.reasons);
  }

  const unique = [...new Set(disabledReasons)];
  return {
    canPublish: unique.length === 0,
    disabledReasons: unique,
  };
}

export type MenuItemFilter = "all" | "available" | "unavailable" | "warnings";

export function filterVendorMenuDisplayItems(
  items: VendorMenuDisplayItem[],
  query: string,
  filter: MenuItemFilter
): VendorMenuDisplayItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter === "available" && !item.isAvailable) return false;
    if (filter === "unavailable" && item.isAvailable) return false;
    if (filter === "warnings" && !item.hasMappingWarning) return false;
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false) ||
      item.categoryName.toLowerCase().includes(q)
    );
  });
}

export function groupFilteredMenuItemsByCategory(
  items: VendorMenuDisplayItem[]
): Array<{ categoryId: string; categoryName: string; items: VendorMenuDisplayItem[] }> {
  const byCategory = new Map<string, { categoryId: string; categoryName: string; items: VendorMenuDisplayItem[] }>();
  for (const item of items) {
    const existing = byCategory.get(item.categoryId);
    if (existing) {
      existing.items.push(item);
    } else {
      byCategory.set(item.categoryId, {
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        items: [item],
      });
    }
  }
  return [...byCategory.values()];
}
