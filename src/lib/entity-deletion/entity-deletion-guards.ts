import type { OrderStatus, VendorFulfillmentStatus } from "@prisma/client";
import {
  CHECKOUT_IN_PROGRESS_ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
} from "@/lib/order-terminal-status";
import { ACTIVE_ORDER_ISSUE_STATUSES } from "@/domain/order-support-issue";
import {
  BLOCKING_POD_PAYOUT_TRANSFER_STATUSES,
  BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES,
} from "@/lib/entity-deletion/entity-deletion.constants";

export type EntityDeletionBlocker = {
  code: string;
  message: string;
};

export type EntityDeletionPrecheck = {
  ok: boolean;
  blockers: EntityDeletionBlocker[];
};

export type EntityDeletionGuardDeps = {
  countActiveCustomerOrdersForUser: (userId: string) => Promise<number>;
  countOwnedVendors: (userId: string) => Promise<number>;
  countOwnedPods: (userId: string) => Promise<number>;
  countActiveVendorOrders: (vendorId: string) => Promise<number>;
  countBlockingVendorPayoutTransfers: (vendorId: string) => Promise<number>;
  countActiveVendorIssues: (vendorId: string) => Promise<number>;
  countActivePodOrders: (podId: string) => Promise<number>;
  countBlockingPodPayoutTransfers: (podId: string) => Promise<number>;
  countActivePodVendorMemberships: (podId: string) => Promise<number>;
};

function blocked(...blockers: EntityDeletionBlocker[]): EntityDeletionPrecheck {
  return { ok: false, blockers };
}

function allowed(): EntityDeletionPrecheck {
  return { ok: true, blockers: [] };
}

export async function precheckAccountDeletion(
  userId: string,
  deps: EntityDeletionGuardDeps
): Promise<EntityDeletionPrecheck> {
  const blockers: EntityDeletionBlocker[] = [];

  const [activeOrders, ownedVendors, ownedPods] = await Promise.all([
    deps.countActiveCustomerOrdersForUser(userId),
    deps.countOwnedVendors(userId),
    deps.countOwnedPods(userId),
  ]);

  if (activeOrders > 0) {
    blockers.push({
      code: "active_customer_orders",
      message: "Finish or cancel your active orders before deleting your account.",
    });
  }
  if (ownedVendors > 0) {
    blockers.push({
      code: "owned_vendors",
      message: "Delete or transfer your vendor profiles before deleting your account.",
    });
  }
  if (ownedPods > 0) {
    blockers.push({
      code: "owned_pods",
      message: "Delete or transfer your pods before deleting your account.",
    });
  }

  return blockers.length > 0 ? blocked(...blockers) : allowed();
}

export async function precheckVendorDeletion(
  vendorId: string,
  deps: EntityDeletionGuardDeps
): Promise<EntityDeletionPrecheck> {
  const blockers: EntityDeletionBlocker[] = [];

  const [activeOrders, pendingPayouts, activeIssues] = await Promise.all([
    deps.countActiveVendorOrders(vendorId),
    deps.countBlockingVendorPayoutTransfers(vendorId),
    deps.countActiveVendorIssues(vendorId),
  ]);

  if (activeOrders > 0) {
    blockers.push({
      code: "active_vendor_orders",
      message: "Complete or cancel active orders before deleting this vendor.",
    });
  }
  if (pendingPayouts > 0) {
    blockers.push({
      code: "pending_vendor_payouts",
      message: "This vendor has pending payout transfers. Contact support before deleting.",
    });
  }
  if (activeIssues > 0) {
    blockers.push({
      code: "active_vendor_issues",
      message: "Resolve open order issues before deleting this vendor.",
    });
  }

  return blockers.length > 0 ? blocked(...blockers) : allowed();
}

export async function precheckPodDeletion(
  podId: string,
  deps: EntityDeletionGuardDeps,
  options?: { acknowledgeActiveVendors?: boolean }
): Promise<EntityDeletionPrecheck> {
  const blockers: EntityDeletionBlocker[] = [];

  const [activeOrders, pendingPayouts, activeVendors] = await Promise.all([
    deps.countActivePodOrders(podId),
    deps.countBlockingPodPayoutTransfers(podId),
    deps.countActivePodVendorMemberships(podId),
  ]);

  if (activeOrders > 0) {
    blockers.push({
      code: "active_pod_orders",
      message: "Complete or cancel active orders before deleting this pod.",
    });
  }
  if (pendingPayouts > 0) {
    blockers.push({
      code: "pending_pod_payouts",
      message: "This pod has pending payout transfers. Contact support before deleting.",
    });
  }
  if (activeVendors > 0 && !options?.acknowledgeActiveVendors) {
    blockers.push({
      code: "active_pod_vendors",
      message: "Confirm removal of active vendors from this pod before deleting.",
    });
  }

  return blockers.length > 0 ? blocked(...blockers) : allowed();
}

export const ACTIVE_ORDER_STATUS_FILTER = {
  notIn: [...TERMINAL_ORDER_STATUSES, ...CHECKOUT_IN_PROGRESS_ORDER_STATUSES] as OrderStatus[],
};

export const ACTIVE_VENDOR_FULFILLMENT_FILTER = {
  notIn: ["completed", "cancelled"] as VendorFulfillmentStatus[],
};

export const ACTIVE_ORDER_ISSUE_STATUS_FILTER = {
  in: [...ACTIVE_ORDER_ISSUE_STATUSES],
};

export const BLOCKING_VENDOR_PAYOUT_STATUS_FILTER = {
  in: [...BLOCKING_VENDOR_PAYOUT_TRANSFER_STATUSES],
};

export const BLOCKING_POD_PAYOUT_STATUS_FILTER = {
  in: [...BLOCKING_POD_PAYOUT_TRANSFER_STATUSES],
};
