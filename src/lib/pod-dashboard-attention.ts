import type { PodAdoptionAttentionRow } from "@/lib/pod-vendor-adoption";
import {
  POD_SETUP_REQUIRED_CHECKLIST_KEYS,
  type ReadinessChecklistItem,
} from "@/lib/vendor-pod-readiness";

export type PodAttentionItem = {
  id: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  severity: "warning" | "info";
};

function readinessHref(podId: string): string {
  return `/pod/${podId}/setup`;
}

export function derivePodAttentionItems(input: {
  podId: string;
  orderableVendorCount: number;
  vendorCount: number;
  addressSet: boolean;
  pendingInviteCount: number;
  pendingRequestCount: number;
  adoptionAttentionRows: PodAdoptionAttentionRow[];
  incompleteSetupItems: ReadinessChecklistItem[];
  /** Active vendors that are intentionally menu-only. */
  menuOnlyVendorCount?: number;
  /** Pod-wide ordering is off: zero orderable vendors is the configured outcome. */
  podMenuOnly?: boolean;
}): PodAttentionItem[] {
  const items: PodAttentionItem[] = [];
  const menuOnlyVendorCount = input.menuOnlyVendorCount ?? 0;
  /** No vendor in this pod is meant to take orders, so ordering gaps are not problems. */
  const noOrderingIntent =
    Boolean(input.podMenuOnly) ||
    (input.vendorCount > 0 && menuOnlyVendorCount === input.vendorCount);

  if (input.vendorCount === 0) {
    items.push({
      id: "no_vendors",
      title: "No vendors in pod",
      description: noOrderingIntent
        ? "Invite vendors so customers can browse menus on your pod page."
        : "Invite vendors so customers can order from your pod page.",
      actionHref: `/pod/${input.podId}/vendors#invite`,
      actionLabel: "Invite vendors",
      severity: "warning",
    });
  } else if (input.orderableVendorCount === 0 && !noOrderingIntent) {
    items.push({
      id: "no_orderable_vendors",
      title: "No vendors are currently orderable",
      description: "Help vendors finish setup or unpause them in your pod.",
      actionHref: readinessHref(input.podId),
      actionLabel: "View readiness",
      severity: "warning",
    });
  }

  if (!input.addressSet) {
    items.push({
      id: "location",
      title: "Pod location not set",
      description: noOrderingIntent
        ? "Add an address so customers know where to find your pod."
        : "Add an address so customers know where to pick up orders.",
      actionHref: readinessHref(input.podId),
      actionLabel: "View readiness",
      severity: "info",
    });
  }

  const hoursBlocked = input.adoptionAttentionRows.filter(
    (row) => row.status === "needs_hours" || row.primaryBlockerCode === "hours"
  );
  /** Hours gate public visibility too, so the ask survives menu-only — only the reason changes. */
  const hoursConsequence = noOrderingIntent
    ? "before appearing on your pod page"
    : "before accepting orders";
  if (hoursBlocked.length === 1) {
    items.push({
      id: "vendor_hours",
      title: "Vendor needs customer ordering hours",
      description: `${hoursBlocked[0]!.name} needs customer ordering hours ${hoursConsequence}.`,
      actionHref: readinessHref(input.podId),
      actionLabel: "View readiness",
      severity: "warning",
    });
  } else if (hoursBlocked.length > 1) {
    items.push({
      id: "vendor_hours",
      title: "Vendors need customer ordering hours",
      description: `${hoursBlocked.length} vendors need customer ordering hours ${hoursConsequence}.`,
      actionHref: readinessHref(input.podId),
      actionLabel: "View readiness",
      severity: "warning",
    });
  }

  /** Payment setup is never chased when nothing in this pod is meant to take orders. */
  const stripeBlocked = noOrderingIntent
    ? []
    : input.adoptionAttentionRows.filter(
        (row) => row.status === "needs_payment" || row.primaryBlockerCode === "stripe"
      );
  if (stripeBlocked.length === 1) {
    items.push({
      id: "vendor_stripe",
      title: "Vendor payment setup incomplete",
      description: `${stripeBlocked[0]!.name} still needs payment setup.`,
      actionHref: readinessHref(input.podId),
      actionLabel: "View readiness",
      severity: "warning",
    });
  } else if (stripeBlocked.length > 1) {
    items.push({
      id: "vendor_stripe",
      title: "Vendor payment setup incomplete",
      description: `${stripeBlocked.length} vendors still need payment setup.`,
      actionHref: readinessHref(input.podId),
      actionLabel: "View readiness",
      severity: "warning",
    });
  }

  const menuBlocked = input.adoptionAttentionRows.filter(
    (row) => row.status === "needs_menu" || row.primaryBlockerCode === "menu"
  );
  if (menuBlocked.length > 0) {
    items.push({
      id: "vendor_menu",
      title: menuBlocked.length === 1 ? "Vendor menu not ready" : "Vendor menus not ready",
      description:
        menuBlocked.length === 1
          ? `${menuBlocked[0]!.name} needs at least one available menu item.`
          : noOrderingIntent
            ? `${menuBlocked.length} vendors need menu setup before they appear on your pod page.`
            : `${menuBlocked.length} vendors need menu setup before customers can order.`,
      actionHref: readinessHref(input.podId),
      actionLabel: "View readiness",
      severity: "warning",
    });
  }

  const pausedInPod = input.adoptionAttentionRows.filter((row) => row.status === "paused_in_pod");
  if (pausedInPod.length === 1) {
    items.push({
      id: "paused_in_pod",
      title: "Vendor paused in pod",
      description: `${pausedInPod[0]!.name} is hidden from your public pod page.`,
      actionHref: readinessHref(input.podId),
      actionLabel: "View readiness",
      severity: "info",
    });
  }

  if (input.pendingInviteCount > 0) {
    items.push({
      id: "pending_invites",
      title: "Pending vendor invitations",
      description: `${input.pendingInviteCount} vendor invitation${input.pendingInviteCount === 1 ? "" : "s"} waiting for a response.`,
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "View invitations",
      severity: "info",
    });
  }

  if (input.pendingRequestCount > 0) {
    items.push({
      id: "pending_requests",
      title: "Vendor membership requests",
      description: `${input.pendingRequestCount} vendor${input.pendingRequestCount === 1 ? "" : "s"} requested to join your pod.`,
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "Review requests",
      severity: "info",
    });
  }

  for (const item of input.incompleteSetupItems) {
    if (items.some((existing) => existing.id === item.key)) continue;
    items.push({
      id: item.key,
      title: item.label,
      description: item.description ?? item.label,
      actionHref: item.actionHref ?? readinessHref(input.podId),
      actionLabel: item.actionLabel ?? "View readiness",
      severity: item.owner === "open_order" ? "info" : "warning",
    });
  }

  return items;
}

export function isPodSetupComplete(checklistCompleteKeys: string[]): boolean {
  return POD_SETUP_REQUIRED_CHECKLIST_KEYS.every((key) => checklistCompleteKeys.includes(key));
}
