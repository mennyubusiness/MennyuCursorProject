import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

export type VendorSetupChecklistSummary = {
  readyCount: number;
  total: number;
  allReady: boolean;
  /** Expand by default when any item is incomplete. */
  defaultExpanded: boolean;
  incompleteLabels: string[];
};

function setupChecklistItems(items: ReadinessChecklistItem[]): ReadinessChecklistItem[] {
  return items.filter((item) => !item.informational);
}

export function vendorSetupChecklistSummary(
  items: ReadinessChecklistItem[]
): VendorSetupChecklistSummary {
  const setupItems = setupChecklistItems(items);
  const readyCount = setupItems.filter((item) => item.complete).length;
  const total = setupItems.length;
  const allReady = total > 0 && readyCount === total;
  return {
    readyCount,
    total,
    allReady,
    defaultExpanded: !allReady,
    incompleteLabels: setupItems.filter((item) => !item.complete).map((item) => item.label),
  };
}
