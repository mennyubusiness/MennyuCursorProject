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
import { maybeAutoSyncVendorDeliverectHours } from "@/services/vendor-deliverect-hours-sync.service";

export type VendorHoursPageData = {
  vendorId: string;
  vendorName: string;
  posConnected: boolean;
  syncFromDeliverect: boolean;
  customHours: VendorCustomerOrderingWeek;
  syncedHours: VendorCustomerOrderingWeek | null;
  syncedHoursAt: string | null;
  syncStatus: "ok" | "failed" | null;
  syncLastError: string | null;
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
      deliverectSyncedCustomerOrderingHoursSyncStatus: true,
      deliverectSyncedCustomerOrderingHoursLastError: true,
    },
  });
  if (!vendor) return null;

  const posConnected = Boolean(
    vendor.deliverectChannelLinkId?.trim() && vendor.posConnectionStatus === "connected"
  );

  if (vendor.syncCustomerOrderingHoursFromDeliverect && posConnected) {
    await maybeAutoSyncVendorDeliverectHours(vendorId);
  }

  const refreshed = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      customerOrderingHours: true,
      deliverectSyncedCustomerOrderingHours: true,
      deliverectSyncedCustomerOrderingHoursAt: true,
      deliverectSyncedCustomerOrderingHoursSyncStatus: true,
      deliverectSyncedCustomerOrderingHoursLastError: true,
    },
  });

  const hoursRow = refreshed ?? vendor;
  const parsedCustom =
    parseVendorCustomerOrderingWeek(hoursRow.customerOrderingHours) ?? defaultVendorCustomerOrderingWeek();
  const parsedSynced = parseVendorCustomerOrderingWeek(hoursRow.deliverectSyncedCustomerOrderingHours);
  const syncStatusRaw = hoursRow.deliverectSyncedCustomerOrderingHoursSyncStatus;
  const syncStatus = syncStatusRaw === "ok" || syncStatusRaw === "failed" ? syncStatusRaw : null;

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    posConnected,
    syncFromDeliverect: vendor.syncCustomerOrderingHoursFromDeliverect,
    customHours: parsedCustom,
    syncedHours: parsedSynced,
    syncedHoursAt: hoursRow.deliverectSyncedCustomerOrderingHoursAt?.toISOString() ?? null,
    syncStatus,
    syncLastError: hoursRow.deliverectSyncedCustomerOrderingHoursLastError ?? null,
  };
});

export function formatSyncedHoursList(week: VendorCustomerOrderingWeek): Array<{ day: string; hours: string }> {
  return week.map((row) => ({
    day: VENDOR_WEEKDAY_LABELS[row.day],
    hours: formatDayHoursLabel(row),
  }));
}
