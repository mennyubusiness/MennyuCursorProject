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

export function derivePodAttentionItems(input: {
  podId: string;
  orderableVendorCount: number;
  vendorCount: number;
  addressSet: boolean;
  pendingInviteCount: number;
  pendingRequestCount: number;
  adoptionAttentionRows: PodAdoptionAttentionRow[];
  incompleteSetupItems: ReadinessChecklistItem[];
}): PodAttentionItem[] {
  const items: PodAttentionItem[] = [];

  if (input.vendorCount === 0) {
    items.push({
      id: "no_vendors",
      title: "No vendors in pod",
      description: "Invite vendors so customers can order from your pod page.",
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "Invite vendor",
      severity: "warning",
    });
  } else if (input.orderableVendorCount === 0) {
    items.push({
      id: "no_orderable_vendors",
      title: "No vendors are currently orderable",
      description: "Help vendors finish setup or unpause them in your pod.",
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "Manage vendors",
      severity: "warning",
    });
  }

  if (!input.addressSet) {
    items.push({
      id: "location",
      title: "Pod location not set",
      description: "Add an address so customers know where to pick up orders.",
      actionHref: `/pod/${input.podId}/settings?section=profile`,
      actionLabel: "Edit pod profile",
      severity: "info",
    });
  }

  const hoursBlocked = input.adoptionAttentionRows.filter(
    (row) => row.status === "needs_hours" || row.primaryBlockerCode === "hours"
  );
  if (hoursBlocked.length === 1) {
    items.push({
      id: "vendor_hours",
      title: "Vendor needs customer ordering hours",
      description: `${hoursBlocked[0]!.name} needs customer ordering hours before accepting orders.`,
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "View vendor",
      severity: "warning",
    });
  } else if (hoursBlocked.length > 1) {
    items.push({
      id: "vendor_hours",
      title: "Vendors need customer ordering hours",
      description: `${hoursBlocked.length} vendors need customer ordering hours before accepting orders.`,
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "Manage vendors",
      severity: "warning",
    });
  }

  const stripeBlocked = input.adoptionAttentionRows.filter(
    (row) => row.status === "needs_payment" || row.primaryBlockerCode === "stripe"
  );
  if (stripeBlocked.length === 1) {
    items.push({
      id: "vendor_stripe",
      title: "Vendor payment setup incomplete",
      description: `${stripeBlocked[0]!.name} still needs Stripe payout setup.`,
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "View vendor",
      severity: "warning",
    });
  } else if (stripeBlocked.length > 1) {
    items.push({
      id: "vendor_stripe",
      title: "Vendor payment setup incomplete",
      description: `${stripeBlocked.length} vendors still need payment setup.`,
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "Manage vendors",
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
          : `${menuBlocked.length} vendors need menu setup before customers can order.`,
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "Manage vendors",
      severity: "warning",
    });
  }

  const pausedInPod = input.adoptionAttentionRows.filter((row) => row.status === "paused_in_pod");
  if (pausedInPod.length === 1) {
    items.push({
      id: "paused_in_pod",
      title: "Vendor paused in pod",
      description: `${pausedInPod[0]!.name} is hidden from your public pod page.`,
      actionHref: `/pod/${input.podId}/vendors`,
      actionLabel: "Manage vendors",
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
      actionHref: item.actionHref,
      actionLabel: item.actionLabel,
      severity: item.owner === "open_order" ? "info" : "warning",
    });
  }

  return items;
}

export function isPodSetupComplete(checklistCompleteKeys: string[]): boolean {
  return POD_SETUP_REQUIRED_CHECKLIST_KEYS.every((key) => checklistCompleteKeys.includes(key));
}
