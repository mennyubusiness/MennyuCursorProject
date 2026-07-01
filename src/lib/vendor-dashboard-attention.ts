import {
  VENDOR_ACCEPTING_ORDERS_CHECKLIST_KEYS,
  VENDOR_PUBLIC_APPEARANCE_CHECKLIST_KEYS,
  type ReadinessChecklistItem,
  VENDOR_SETUP_REQUIRED_CHECKLIST_KEYS,
} from "@/lib/vendor-pod-readiness";
import {
  VENDOR_HIDDEN_FROM_POD_BODY,
  VENDOR_HIDDEN_FROM_POD_TITLE,
  VENDOR_HOURS_PUBLIC_COPY,
  VENDOR_NO_POD_COPY,
  VENDOR_ORDERING_CLOSED_BODY,
  VENDOR_ORDERING_CLOSED_TITLE,
} from "@/lib/vendor-operational-copy";
import type { VendorPosUiState } from "@/lib/vendor-pos-ui-state";

export type VendorAttentionItemKind = "summary" | "item";

export type VendorAttentionItem = {
  id: string;
  kind?: VendorAttentionItemKind;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  severity: "warning" | "info";
};

const PUBLIC_CHECKLIST_KEYS = new Set<string>(VENDOR_PUBLIC_APPEARANCE_CHECKLIST_KEYS);
const OPERATIONAL_CHECKLIST_KEYS = new Set<string>(VENDOR_ACCEPTING_ORDERS_CHECKLIST_KEYS);

function checklistItemToAttention(item: ReadinessChecklistItem): VendorAttentionItem {
  if (item.key === "hours") {
    return {
      id: "hours",
      title: "Customer ordering hours",
      description: VENDOR_HOURS_PUBLIC_COPY,
      actionHref: item.actionHref,
      actionLabel: item.actionLabel ?? "Set hours",
      severity: "warning",
    };
  }

  return {
    id: item.key,
    title: item.label,
    description: item.description ?? item.label,
    actionHref: item.actionHref,
    actionLabel: item.actionLabel,
    severity: "warning",
  };
}

export function deriveVendorAttentionItems(input: {
  checklist: ReadinessChecklistItem[];
  publicProfileReady: boolean;
  canAcceptOrders: boolean;
  posState: VendorPosUiState;
  /** When false (manual dashboard routing), skip Deliverect/POS connection warnings. */
  deliverectRoutingMode?: boolean;
  hasPodMembership: boolean;
  pendingPodInviteCount: number;
  failedOrdersToday: number;
  vendorPaused: boolean;
  currentlyOpen: boolean;
}): VendorAttentionItem[] {
  const items: VendorAttentionItem[] = [];
  const incompletePublic = input.checklist.filter(
    (item) => PUBLIC_CHECKLIST_KEYS.has(item.key) && !item.complete
  );
  const incompleteOperational = input.checklist.filter(
    (item) => OPERATIONAL_CHECKLIST_KEYS.has(item.key) && !item.complete
  );

  if (!input.publicProfileReady) {
    items.push({
      id: "vendor_hidden",
      kind: "summary",
      title: VENDOR_HIDDEN_FROM_POD_TITLE,
      description: VENDOR_HIDDEN_FROM_POD_BODY,
      severity: "warning",
    });

    for (const item of incompletePublic) {
      items.push(checklistItemToAttention(item));
    }

    if (!input.hasPodMembership && input.pendingPodInviteCount === 0) {
      items.push({
        id: "no_pod",
        title: "No pod assignment",
        description: VENDOR_NO_POD_COPY,
        severity: "warning",
      });
    }

    if (input.pendingPodInviteCount > 0 && !input.hasPodMembership) {
      items.push({
        id: "pod_invite",
        title: "Pod membership pending",
        description: `You have ${input.pendingPodInviteCount} pod invitation${input.pendingPodInviteCount === 1 ? "" : "s"} waiting for a response.`,
        severity: "info",
      });
    }

    return items;
  }

  if (!input.canAcceptOrders) {
    items.push({
      id: "ordering_closed",
      kind: "summary",
      title: VENDOR_ORDERING_CLOSED_TITLE,
      description: VENDOR_ORDERING_CLOSED_BODY,
      severity: "warning",
    });

    for (const item of incompleteOperational) {
      items.push(checklistItemToAttention(item));
    }

    if (input.deliverectRoutingMode !== false) {
      if (input.posState === "needs_attention" && !items.some((item) => item.id === "pos")) {
        items.push({
          id: "pos_attention",
          title: "POS needs attention",
          description: "Your POS connection needs a fix before orders can route reliably.",
          severity: "warning",
        });
      } else if (input.posState === "not_connected" && !items.some((item) => item.id === "pos")) {
        items.push({
          id: "pos_disconnected",
          title: "POS not connected",
          description: "Connect your POS so kitchen orders can sync automatically.",
          severity: "info",
        });
      }
    }

    if (input.vendorPaused) {
      items.push({
        id: "not_paused",
        title: "Orders paused",
        description: "Unpause new orders from Kitchen mode or Orders to accept orders again.",
        severity: "warning",
      });
    } else if (!input.currentlyOpen) {
      items.push({
        id: "currently_closed",
        title: "Outside customer ordering hours",
        description: "Customers can browse your menu, but ordering opens during your set hours.",
        severity: "info",
      });
    }
  }

  if (input.failedOrdersToday > 0) {
    items.push({
      id: "failed_orders",
      title: "Orders need attention",
      description: `${input.failedOrdersToday} order${input.failedOrdersToday === 1 ? "" : "s"} failed routing or were cancelled today.`,
      severity: "warning",
    });
  }

  return items;
}

export function isVendorSetupComplete(checklistCompleteKeys: string[]): boolean {
  return VENDOR_SETUP_REQUIRED_CHECKLIST_KEYS.every((key) => checklistCompleteKeys.includes(key));
}

export function buildVendorOperationalSetupItems(input: {
  checklist: ReadinessChecklistItem[];
  vendorPaused: boolean;
  currentlyOpen: boolean;
  vendorId: string;
}): ReadinessChecklistItem[] {
  const base = input.checklist.filter((item) => OPERATIONAL_CHECKLIST_KEYS.has(item.key));
  const extras: ReadinessChecklistItem[] = [
    {
      key: "not_paused",
      label: "Not paused",
      complete: !input.vendorPaused,
      owner: "vendor",
      description: input.vendorPaused
        ? "New orders are paused — unpause from Kitchen mode or Orders."
        : "New orders are not paused.",
      actionHref: `/vendor/${input.vendorId}/kitchen`,
      actionLabel: "Open kitchen",
    },
    {
      key: "currently_open",
      label: "Currently open",
      complete: input.currentlyOpen,
      owner: "vendor",
      description: input.currentlyOpen
        ? "You are inside customer ordering hours."
        : "Outside customer ordering hours right now.",
      actionHref: `/vendor/${input.vendorId}/hours`,
      actionLabel: "Set hours",
    },
  ];

  return [...base, ...extras];
}
