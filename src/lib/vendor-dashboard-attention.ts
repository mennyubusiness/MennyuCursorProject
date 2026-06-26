import type { ReadinessBlockingReason } from "@/lib/vendor-pod-readiness";
import type { VendorHoursStatusSummary } from "@/lib/vendor-customer-ordering-hours";
import {
  VENDOR_NO_POD_COPY,
  VENDOR_POS_MANAGED_COPY,
} from "@/lib/vendor-operational-copy";
import type { VendorPosUiState } from "@/lib/vendor-pos-ui-state";

export type VendorAttentionItem = {
  id: string;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  severity: "warning" | "info";
};

export function deriveVendorAttentionItems(input: {
  blockingReasons: ReadinessBlockingReason[];
  posState: VendorPosUiState;
  paymentsReady: boolean;
  menuSynced: boolean;
  hasPodMembership: boolean;
  pendingPodInviteCount: number;
  failedOrdersToday: number;
  intakeLabel: string;
  hoursSummary?: Pick<VendorHoursStatusSummary, "needsHoursAttention" | "syncFailed" | "sourceLabel" | "todayLabel">;
}): VendorAttentionItem[] {
  const items: VendorAttentionItem[] = [];

  if (!input.hasPodMembership && input.pendingPodInviteCount === 0) {
    items.push({
      id: "no_pod",
      title: "No pod assignment",
      description: VENDOR_NO_POD_COPY,
      actionHref: undefined,
      actionLabel: undefined,
      severity: "warning",
    });
  }

  if (input.pendingPodInviteCount > 0) {
    items.push({
      id: "pod_invite",
      title: "Pod membership pending",
      description: `You have ${input.pendingPodInviteCount} pod invitation${input.pendingPodInviteCount === 1 ? "" : "s"} waiting for a response.`,
      actionHref: undefined,
      actionLabel: undefined,
      severity: "info",
    });
  }

  if (!input.paymentsReady) {
    items.push({
      id: "stripe",
      title: "Payment setup incomplete",
      description: "Finish payment setup before accepting orders.",
      severity: "warning",
    });
  }

  if (input.posState === "needs_attention") {
    items.push({
      id: "pos_attention",
      title: "POS needs attention",
      description: "Your POS connection needs a fix before orders can route reliably.",
      severity: "warning",
    });
  } else if (input.posState === "not_connected") {
    items.push({
      id: "pos_disconnected",
      title: "POS not connected",
      description: "Connect your POS so kitchen orders can sync automatically.",
      severity: "info",
    });
  }

  if (!input.menuSynced) {
    items.push({
      id: "menu_sync",
      title: "Menu sync needs attention",
      description: "Customers need at least one available menu item before they can order.",
      severity: "warning",
    });
  }

  for (const reason of input.blockingReasons) {
    if (reason.code === "vendor_paused") continue;
    if (items.some((item) => item.id === reason.code)) continue;
    items.push({
      id: reason.code,
      title: reason.label,
      description: reason.description,
      actionHref: reason.actionHref,
      actionLabel: reason.actionLabel,
      severity: "warning",
    });
  }

  if (input.failedOrdersToday > 0) {
    items.push({
      id: "failed_orders",
      title: "Orders need attention",
      description: `${input.failedOrdersToday} order${input.failedOrdersToday === 1 ? "" : "s"} failed routing or were cancelled today.`,
      severity: "warning",
    });
  }

  if (input.hoursSummary?.needsHoursAttention) {
    if (input.hoursSummary.sourceLabel === "Hours sync needs attention") {
      items.push({
        id: "hours_sync",
        title: "Hours sync needs attention",
        description:
          "Deliverect hour sync is enabled but Open Order has not fetched usable hours yet. Refresh from the Hours page or enter custom hours.",
        severity: "warning",
      });
    } else if (input.hoursSummary.syncFailed) {
      items.push({
        id: "hours_sync",
        title: "Deliverect hours sync failed",
        description:
          "The latest Deliverect hours sync failed. Open Order will keep using the last synced hours until you refresh.",
        severity: "warning",
      });
    } else if (input.hoursSummary.sourceLabel === "Custom hours not set") {
      items.push({
        id: "hours_sync",
        title: "Customer ordering hours not set",
        description: "Set customer ordering hours so customers know when they can place orders.",
        severity: "info",
      });
    }
  }

  if (input.intakeLabel === "Closed" && input.posState === "connected") {
    items.push({
      id: "pos_closed",
      title: "Store appears closed",
      description: VENDOR_POS_MANAGED_COPY,
      severity: "info",
    });
  }

  return items;
}

export function isVendorSetupComplete(checklistCompleteKeys: string[]): boolean {
  const required = ["profile", "stripe", "pos", "menu", "pod_invite"];
  return required.every((key) => checklistCompleteKeys.includes(key));
}
