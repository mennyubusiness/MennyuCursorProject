import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db";
import type { VendorDashboardNavMode } from "@/lib/vendor-dashboard-nav-mode";
import { resolveVendorOrderingIntent, type VendorOrderingIntent } from "@/lib/vendor-ordering-mode";

export type VendorDashboardOrderingMode = VendorOrderingIntent & VendorDashboardNavMode;

/**
 * Ordering intent plus the order-work signals the dashboard chrome needs.
 *
 * Kept deliberately small so the vendor layout can resolve nav on every request without
 * pulling the full dashboard context.
 */
export const loadVendorDashboardOrderingMode = cache(
  async (vendorId: string): Promise<VendorDashboardOrderingMode> => {
    const [vendor, podVendor, activeOrderCount, orderCount] = await Promise.all([
      prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { orderingEnabled: true },
      }),
      prisma.podVendor.findFirst({
        where: { vendorId },
        select: { pod: { select: { orderingEnabled: true } } },
      }),
      prisma.vendorOrder.count({
        where: {
          vendorId,
          fulfillmentStatus: { notIn: ["completed", "cancelled"] },
          order: { status: { not: "pending_payment" } },
        },
      }),
      prisma.vendorOrder.count({ where: { vendorId } }),
    ]);

    const intent = resolveVendorOrderingIntent({
      podOrderingEnabled: podVendor?.pod.orderingEnabled,
      vendorOrderingEnabled: vendor?.orderingEnabled,
    });

    return {
      ...intent,
      menuOnly: intent.menuOnly,
      hasActiveOrders: activeOrderCount > 0,
      hasOrderHistory: orderCount > 0,
    };
  }
);
