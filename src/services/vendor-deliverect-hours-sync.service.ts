/**
 * Fetch Deliverect opening hours for a vendor and persist normalized customer ordering hours.
 */
import "server-only";
import { prisma } from "@/lib/db";
import {
  fetchDeliverectLocationOpeningHours,
  normalizeDeliverectOpeningHoursResponse,
} from "@/integrations/deliverect/opening-hours-api";
import { serializeVendorCustomerOrderingWeek } from "@/lib/vendor-customer-ordering-hours";

export const DELIVERECT_HOURS_SYNC_STALE_MS = 12 * 60 * 60 * 1000;

export type VendorDeliverectHoursSyncResult =
  | {
      ok: true;
      syncedAt: string;
      hadPreviousHours: boolean;
    }
  | {
      ok: false;
      error: string;
      keptPreviousHours: boolean;
      httpStatus?: number;
    };

export type VendorDeliverectHoursSyncSkipReason =
  | "sync_disabled"
  | "pos_not_connected"
  | "missing_location_id";

function resolveDeliverectLocationId(vendor: {
  deliverectLocationId: string | null;
  id: string;
}): string | null {
  const location = vendor.deliverectLocationId?.trim();
  if (location) return location;
  return null;
}

export function isDeliverectHoursSyncStale(
  syncedAt: Date | string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!syncedAt) return true;
  const at = syncedAt instanceof Date ? syncedAt.getTime() : new Date(syncedAt).getTime();
  if (!Number.isFinite(at)) return true;
  return nowMs - at >= DELIVERECT_HOURS_SYNC_STALE_MS;
}

export async function syncVendorCustomerOrderingHoursFromDeliverect(
  vendorId: string
): Promise<VendorDeliverectHoursSyncResult | { skipped: true; reason: VendorDeliverectHoursSyncSkipReason }> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      deliverectLocationId: true,
      deliverectChannelLinkId: true,
      posConnectionStatus: true,
      syncCustomerOrderingHoursFromDeliverect: true,
      deliverectSyncedCustomerOrderingHours: true,
    },
  });

  if (!vendor) {
    return { ok: false, error: "Vendor not found", keptPreviousHours: false };
  }

  if (!vendor.syncCustomerOrderingHoursFromDeliverect) {
    return { skipped: true, reason: "sync_disabled" };
  }

  const posConnected = Boolean(
    vendor.deliverectChannelLinkId?.trim() && vendor.posConnectionStatus === "connected"
  );
  if (!posConnected) {
    return { skipped: true, reason: "pos_not_connected" };
  }

  const locationId = resolveDeliverectLocationId(vendor);
  if (!locationId) {
    const hadPrevious = vendor.deliverectSyncedCustomerOrderingHours != null;
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        deliverectSyncedCustomerOrderingHoursSyncStatus: "failed",
        deliverectSyncedCustomerOrderingHoursLastError:
          "Deliverect location ID is not configured for this vendor.",
      },
    });
    return {
      ok: false,
      error: "Deliverect location ID is not configured for this vendor.",
      keptPreviousHours: hadPrevious,
    };
  }

  const hadPreviousHours = vendor.deliverectSyncedCustomerOrderingHours != null;
  const fetchResult = await fetchDeliverectLocationOpeningHours({
    locationId,
    channelLinkId: vendor.deliverectChannelLinkId,
  });

  if (!fetchResult.ok) {
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        deliverectSyncedCustomerOrderingHoursSyncStatus: "failed",
        deliverectSyncedCustomerOrderingHoursLastError: fetchResult.error ?? "Deliverect hours fetch failed",
      },
    });
    return {
      ok: false,
      error: fetchResult.error ?? "Deliverect hours fetch failed",
      keptPreviousHours: hadPreviousHours,
      httpStatus: fetchResult.httpStatus,
    };
  }

  const normalized = normalizeDeliverectOpeningHoursResponse(
    fetchResult.body,
    vendor.deliverectChannelLinkId
  );

  if (!normalized) {
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        deliverectSyncedCustomerOrderingHoursSyncStatus: "failed",
        deliverectSyncedCustomerOrderingHoursLastError:
          "Deliverect returned no usable opening hours for this location.",
      },
    });
    return {
      ok: false,
      error: "Deliverect returned no usable opening hours for this location.",
      keptPreviousHours: hadPreviousHours,
      httpStatus: fetchResult.httpStatus,
    };
  }

  const syncedAt = new Date();
  const weekJson = serializeVendorCustomerOrderingWeek(normalized.week);

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      deliverectSyncedCustomerOrderingHours: weekJson,
      deliverectSyncedCustomerOrderingHoursAt: syncedAt,
      deliverectSyncedCustomerOrderingHoursSyncStatus: "ok",
      deliverectSyncedCustomerOrderingHoursLastError: null,
    },
  });

  return {
    ok: true,
    syncedAt: syncedAt.toISOString(),
    hadPreviousHours,
  };
}

/**
 * Best-effort background refresh when sync is on and hours are missing or stale.
 */
export async function maybeAutoSyncVendorDeliverectHours(vendorId: string): Promise<void> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      syncCustomerOrderingHoursFromDeliverect: true,
      deliverectChannelLinkId: true,
      posConnectionStatus: true,
      deliverectSyncedCustomerOrderingHours: true,
      deliverectSyncedCustomerOrderingHoursAt: true,
    },
  });
  if (!vendor?.syncCustomerOrderingHoursFromDeliverect) return;

  const posConnected = Boolean(
    vendor.deliverectChannelLinkId?.trim() && vendor.posConnectionStatus === "connected"
  );
  if (!posConnected) return;

  const missing = vendor.deliverectSyncedCustomerOrderingHours == null;
  const stale = isDeliverectHoursSyncStale(vendor.deliverectSyncedCustomerOrderingHoursAt);
  if (!missing && !stale) return;

  try {
    await syncVendorCustomerOrderingHoursFromDeliverect(vendorId);
  } catch (e) {
    console.warn(
      `[vendor deliverect hours auto-sync] vendorId=${vendorId} error=${e instanceof Error ? e.message : String(e)}`
    );
  }
}
