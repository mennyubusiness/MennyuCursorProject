import type { PodRosterVendorRow } from "@/app/pod/[podId]/dashboard/PodVendorRosterPanel";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

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

export function vendorReadinessBadge(row: PodRosterVendorRow): {
  label: string;
  className: string;
} {
  if (row.readiness.canAcceptOrders) {
    return { label: "Ready", className: "bg-emerald-50 text-emerald-900" };
  }
  if (!row.podVendorActive) {
    return { label: "Not visible on pod page", className: "bg-zinc-100 text-zinc-800" };
  }
  if (row.readiness.status === "paused_in_pod") {
    return { label: "Paused in pod", className: "bg-amber-50 text-amber-900" };
  }
  if (row.readiness.primaryBlocker?.owner === "pod_owner") {
    return { label: "Needs your action", className: "bg-amber-50 text-amber-900" };
  }
  return { label: "Needs vendor action", className: "bg-amber-50 text-amber-900" };
}

export function deriveVendorMissingLines(row: PodRosterVendorRow): string[] {
  const lines: string[] = [];
  const { readiness, podVendorActive } = row;
  const setup = readiness.setupSummary as {
    profile: boolean;
    stripe: boolean;
    pos: boolean;
    menu: boolean;
    hours?: boolean;
  };

  if (!podVendorActive) {
    lines.push("Not visible on pod page.");
  }

  if (readiness.canAcceptOrders) {
    return lines;
  }

  if (!setup.profile) lines.push("Vendor needs to complete profile.");
  if (!setup.stripe) lines.push("Vendor needs to finish payment setup.");
  if (!setup.pos) lines.push("Vendor needs to connect POS.");
  if (!setup.menu) lines.push("Vendor needs to sync menu.");
  if (setup.hours === false) lines.push("Vendor needs to set customer ordering hours.");

  if (readiness.status === "paused_by_vendor") {
    lines.push("Vendor paused new orders.");
  } else if (readiness.status === "paused_in_pod" && podVendorActive) {
    lines.push("Paused in this pod.");
  } else if (readiness.status === "inactive_by_open_order") {
    lines.push("Vendor is not active on Open Order.");
  } else if (readiness.status === "pod_inactive") {
    lines.push("Pod is not active for customer ordering.");
  }

  if (lines.length === 0 && readiness.primaryBlocker) {
    if (readiness.primaryBlocker.owner === "vendor") {
      lines.push(`Vendor needs to ${readiness.primaryBlocker.label.toLowerCase()}.`);
    } else {
      lines.push(readiness.primaryBlocker.description);
    }
  }

  return [...new Set(lines)];
}

export function vendorReadinessPrimaryAction(input: {
  podId: string;
  podSlug: string;
  row: PodRosterVendorRow;
}): { href: string; label: string; external?: boolean } {
  const { podId, podSlug, row } = input;
  const publicHref = `/${podSlug}/${row.vendorSlug}`;

  if (!row.podVendorActive || row.readiness.status === "paused_in_pod") {
    return { href: `/pod/${podId}/vendors`, label: "Manage visibility" };
  }

  return { href: publicHref, label: "View vendor", external: true };
}
