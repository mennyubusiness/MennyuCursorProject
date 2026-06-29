import type { PodRosterVendorRow } from "@/app/pod/[podId]/dashboard/PodVendorRosterPanel";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";
import {
  getVendorPodOwnerDisplayStateFromSetup,
  getVendorPodOwnerMissingLinesFromSetup,
} from "@/lib/vendor-readiness-states";

export type PodReadinessPageSummary = {
  podCompleteCount: number;
  podTotalCount: number;
  vendorsReadyCount: number;
  vendorTotalCount: number;
  needsAttentionCount: number;
  allReady: boolean;
  headline: string;
  detail: string;
};

export function derivePodReadinessPageSummary(input: {
  requiredPodItems: ReadinessChecklistItem[];
  rosterRows: PodRosterVendorRow[];
}): PodReadinessPageSummary {
  const podCompleteCount = input.requiredPodItems.filter((item) => item.complete).length;
  const podTotalCount = input.requiredPodItems.length;
  const vendorTotalCount = input.rosterRows.length;
  const vendorsReadyCount = input.rosterRows.filter((row) => row.readiness.canAcceptOrders).length;
  const vendorsNeedingAttention = input.rosterRows.filter(
    (row) => !row.readiness.canAcceptOrders
  ).length;
  const incompletePodChecks = podTotalCount - podCompleteCount;
  const needsAttentionCount = vendorsNeedingAttention + incompletePodChecks;

  const allReady =
    vendorTotalCount > 0 &&
    podCompleteCount === podTotalCount &&
    vendorsReadyCount === vendorTotalCount;

  let headline: string;
  let detail: string;

  if (vendorTotalCount === 0) {
    headline = "No vendors are assigned to this pod yet.";
    detail = "Invite vendors to start building your roster.";
  } else if (allReady) {
    headline = "All pod and vendor readiness checks are complete.";
    detail = "Your pod and vendors are ready for customers.";
  } else if (vendorsNeedingAttention === 1) {
    headline = "1 vendor needs attention before customers can order.";
    detail = `${vendorsReadyCount} of ${vendorTotalCount} vendors are ready for customers.`;
  } else if (vendorsNeedingAttention > 1) {
    headline = `${vendorsNeedingAttention} vendors need attention before customers can order.`;
    detail = `${vendorsReadyCount} of ${vendorTotalCount} vendors are ready for customers.`;
  } else if (incompletePodChecks > 0) {
    headline = "Pod readiness checks still need attention.";
    detail = `${podCompleteCount} of ${podTotalCount} pod checks are complete.`;
  } else {
    headline = "Some readiness checks still need attention.";
    detail = `${vendorsReadyCount} of ${vendorTotalCount} vendors are ready for customers.`;
  }

  return {
    podCompleteCount,
    podTotalCount,
    vendorsReadyCount,
    vendorTotalCount,
    needsAttentionCount,
    allReady,
    headline,
    detail,
  };
}

function rowDisplayState(row: PodRosterVendorRow) {
  return getVendorPodOwnerDisplayStateFromSetup({
    podVendorActive: row.podVendorActive,
    canAcceptOrders: row.readiness.canAcceptOrders,
    setupSummary: row.readiness.setupSummary,
  });
}

export function vendorReadinessBadge(row: PodRosterVendorRow): {
  label: string;
  className: string;
} {
  const state = rowDisplayState(row);
  if (state === "live") {
    return { label: "Live", className: "bg-emerald-50 text-emerald-900" };
  }
  if (state === "hidden") {
    return { label: "Hidden", className: "bg-zinc-100 text-zinc-800" };
  }
  return { label: "Visible", className: "bg-amber-50 text-amber-900" };
}

export function deriveVendorMissingLines(row: PodRosterVendorRow): string[] {
  return getVendorPodOwnerMissingLinesFromSetup({
    podVendorActive: row.podVendorActive,
    canAcceptOrders: row.readiness.canAcceptOrders,
    setupSummary: row.readiness.setupSummary,
    status: row.readiness.status,
  });
}

export function vendorReadinessPrimaryAction(input: {
  podId: string;
  podSlug: string;
  row: PodRosterVendorRow;
}): { href: string; label: string; external?: boolean } {
  const { podId, podSlug, row } = input;
  const publicHref = `/${podSlug}/${row.vendorSlug}`;
  const state = rowDisplayState(row);

  if (!row.podVendorActive || row.readiness.status === "paused_in_pod") {
    return { href: `/pod/${podId}/vendors`, label: "Manage visibility" };
  }

  if (state === "hidden") {
    return { href: `/pod/${podId}/vendors`, label: "View vendor setup" };
  }

  return { href: publicHref, label: "View vendor", external: true };
}
