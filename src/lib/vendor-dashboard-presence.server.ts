import "server-only";

import { prisma } from "@/lib/db";
import { VENDOR_DASHBOARD_PRESENCE_WRITE_THROTTLE_MS } from "@/lib/vendor-dashboard-presence";

/**
 * Record vendor dashboard/kitchen poll activity. Throttled to at most once per minute per vendor.
 */
export async function touchVendorDashboardLastSeen(vendorId: string): Promise<void> {
  const cutoff = new Date(Date.now() - VENDOR_DASHBOARD_PRESENCE_WRITE_THROTTLE_MS);
  await prisma.vendor.updateMany({
    where: {
      id: vendorId,
      OR: [{ vendorDashboardLastSeenAt: null }, { vendorDashboardLastSeenAt: { lt: cutoff } }],
    },
    data: { vendorDashboardLastSeenAt: new Date() },
  });
}
