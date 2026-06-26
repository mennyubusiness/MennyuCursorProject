import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  defaultVendorCustomerOrderingWeek,
  formatDayHoursLabel,
  parseVendorCustomerOrderingWeek,
  VENDOR_WEEKDAY_LABELS,
  type VendorCustomerOrderingWeek,
} from "@/lib/vendor-customer-ordering-hours";

export type VendorHoursPageData = {
  vendorId: string;
  vendorName: string;
  posConnected: boolean;
  syncFromDeliverect: boolean;
  customHours: VendorCustomerOrderingWeek;
  syncedHours: VendorCustomerOrderingWeek | null;
  syncedHoursAt: string | null;
};

export const loadVendorHoursPageData = cache(async (vendorId: string): Promise<VendorHoursPageData | null> => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      deliverectChannelLinkId: true,
      posConnectionStatus: true,
      syncCustomerOrderingHoursFromDeliverect: true,
      customerOrderingHours: true,
      deliverectSyncedCustomerOrderingHours: true,
      deliverectSyncedCustomerOrderingHoursAt: true,
    },
  });
  if (!vendor) return null;

  const posConnected = Boolean(
    vendor.deliverectChannelLinkId?.trim() && vendor.posConnectionStatus === "connected"
  );

  const parsedCustom =
    parseVendorCustomerOrderingWeek(vendor.customerOrderingHours) ?? defaultVendorCustomerOrderingWeek();
  const parsedSynced = parseVendorCustomerOrderingWeek(vendor.deliverectSyncedCustomerOrderingHours);

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    posConnected,
    syncFromDeliverect: vendor.syncCustomerOrderingHoursFromDeliverect,
    customHours: parsedCustom,
    syncedHours: parsedSynced,
    syncedHoursAt: vendor.deliverectSyncedCustomerOrderingHoursAt?.toISOString() ?? null,
  };
});

export function formatSyncedHoursList(week: VendorCustomerOrderingWeek): Array<{ day: string; hours: string }> {
  return week.map((row) => ({
    day: VENDOR_WEEKDAY_LABELS[row.day],
    hours: formatDayHoursLabel(row),
  }));
}
