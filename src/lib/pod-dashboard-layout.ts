import type { PodAdoptionAttentionRow } from "@/lib/pod-vendor-adoption";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

/** Pod checklist keys handled elsewhere on dedicated pages. */
const POD_SETUP_KEYS_EXCLUDED_FROM_SECTION = new Set(["vendor_ready", "pod_active", "qr_signage"]);

export type PodDashboardLayoutState = {
  hasVendors: boolean;
  hasPodSetupIssues: boolean;
  hasVendorSetupIssues: boolean;
  shouldShowPodSetupSection: boolean;
  shouldShowVendorSetupSection: boolean;
  shouldShowVendorRoster: boolean;
  shouldPromoteInviteSection: boolean;
  actionablePodSetupItems: ReadinessChecklistItem[];
};

export function filterActionablePodSetupItems(items: ReadinessChecklistItem[]): ReadinessChecklistItem[] {
  return items.filter(
    (item) =>
      !item.complete && item.owner === "pod_owner" && !POD_SETUP_KEYS_EXCLUDED_FROM_SECTION.has(item.key)
  );
}

export function derivePodDashboardLayoutState(input: {
  vendorCount: number;
  podSetupChecklist: ReadinessChecklistItem[];
  adoptionAttentionRows: PodAdoptionAttentionRow[];
}): PodDashboardLayoutState {
  const hasVendors = input.vendorCount > 0;
  const actionablePodSetupItems = filterActionablePodSetupItems(input.podSetupChecklist);
  const hasPodSetupIssues = actionablePodSetupItems.length > 0;
  const hasVendorSetupIssues = hasVendors && input.adoptionAttentionRows.length > 0;

  return {
    hasVendors,
    hasPodSetupIssues,
    hasVendorSetupIssues,
    shouldShowPodSetupSection: hasPodSetupIssues,
    shouldShowVendorSetupSection: hasVendorSetupIssues,
    shouldShowVendorRoster: hasVendors,
    shouldPromoteInviteSection: !hasVendors,
    actionablePodSetupItems,
  };
}
