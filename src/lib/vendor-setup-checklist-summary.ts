import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

export type VendorSetupChecklistSummary = {
  readyCount: number;
  total: number;
  allReady: boolean;
  /** Expand by default when any item is incomplete. */
  defaultExpanded: boolean;
  incompleteLabels: string[];
};

export function vendorSetupChecklistSummary(
  items: ReadinessChecklistItem[]
): VendorSetupChecklistSummary {
  const readyCount = items.filter((item) => item.complete).length;
  const total = items.length;
  const allReady = total > 0 && readyCount === total;
  return {
    readyCount,
    total,
    allReady,
    defaultExpanded: !allReady,
    incompleteLabels: items.filter((item) => !item.complete).map((item) => item.label),
  };
}
