import "server-only";

import { prisma } from "@/lib/db";
import type { EntityDeletionGuardDeps } from "@/lib/entity-deletion/entity-deletion-guards";
import {
  ACTIVE_ORDER_ISSUE_STATUS_FILTER,
  ACTIVE_ORDER_STATUS_FILTER,
  ACTIVE_VENDOR_FULFILLMENT_FILTER,
  BLOCKING_POD_PAYOUT_STATUS_FILTER,
  BLOCKING_VENDOR_PAYOUT_STATUS_FILTER,
} from "@/lib/entity-deletion/entity-deletion-guards";

export function createEntityDeletionGuardDeps(): EntityDeletionGuardDeps {
  return {
    countActiveCustomerOrdersForUser: async (userId) => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          customerProfile: { select: { phone: true } },
          customerAccount: { select: { phoneE164: true } },
        },
      });
      if (!user) return 0;

      const phones = new Set<string>();
      if (user.customerAccount?.phoneE164?.trim()) phones.add(user.customerAccount.phoneE164.trim());
      if (user.customerProfile?.phone?.trim()) phones.add(user.customerProfile.phone.trim());

      const orFilters: Array<Record<string, unknown>> = [{ customerEmail: user.email }];
      for (const phone of phones) {
        orFilters.push({ customerPhone: phone });
      }

      return prisma.order.count({
        where: {
          OR: orFilters,
          status: ACTIVE_ORDER_STATUS_FILTER,
        },
      });
    },
    countOwnedVendors: (userId) =>
      prisma.vendorMembership.count({
        where: { userId, role: "owner", vendor: { deletedAt: null } },
      }),
    countOwnedPods: (userId) =>
      prisma.podMembership.count({
        where: { userId, role: "owner", pod: { deletedAt: null } },
      }),
    countActiveVendorOrders: (vendorId) =>
      prisma.vendorOrder.count({
        where: {
          vendorId,
          fulfillmentStatus: ACTIVE_VENDOR_FULFILLMENT_FILTER,
          order: { status: ACTIVE_ORDER_STATUS_FILTER },
        },
      }),
    countBlockingVendorPayoutTransfers: (vendorId) =>
      prisma.vendorPayoutTransfer.count({
        where: { vendorId, status: BLOCKING_VENDOR_PAYOUT_STATUS_FILTER },
      }),
    countActiveVendorIssues: (vendorId) =>
      prisma.orderIssue.count({
        where: {
          vendorOrder: { vendorId },
          status: ACTIVE_ORDER_ISSUE_STATUS_FILTER,
        },
      }),
    countActivePodOrders: (podId) =>
      prisma.order.count({
        where: { podId, status: ACTIVE_ORDER_STATUS_FILTER },
      }),
    countBlockingPodPayoutTransfers: (podId) =>
      prisma.podPayoutTransfer.count({
        where: { podId, status: BLOCKING_POD_PAYOUT_STATUS_FILTER },
      }),
    countActivePodVendorMemberships: (podId) =>
      prisma.podVendor.count({
        where: { podId, isActive: true, vendor: { deletedAt: null, isActive: true } },
      }),
  };
}
