/**
 * Vendor dashboard/tablet presence — last-seen tracking for admin monitoring.
 * Server-only writes live in vendor-dashboard-presence.server.ts.
 */

export const VENDOR_DASHBOARD_PRESENCE_ONLINE_MS = 2 * 60 * 1000;
export const VENDOR_DASHBOARD_PRESENCE_RECENT_MS = 10 * 60 * 1000;
/** Minimum interval between DB writes from poll/presence endpoints. */
export const VENDOR_DASHBOARD_PRESENCE_WRITE_THROTTLE_MS = 60 * 1000;

export type VendorDashboardPresenceStatus = "online" | "recent" | "offline";

export function resolveVendorDashboardPresenceStatus(
  lastSeenAt: Date | string | null | undefined,
  nowMs: number = Date.now()
): VendorDashboardPresenceStatus {
  if (lastSeenAt == null) return "offline";
  const ts = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(ts)) return "offline";
  const ageMs = nowMs - ts;
  if (ageMs <= VENDOR_DASHBOARD_PRESENCE_ONLINE_MS) return "online";
  if (ageMs <= VENDOR_DASHBOARD_PRESENCE_RECENT_MS) return "recent";
  return "offline";
}

export function vendorDashboardPresenceLabel(
  lastSeenAt: Date | string | null | undefined,
  nowMs: number = Date.now()
): string {
  const status = resolveVendorDashboardPresenceStatus(lastSeenAt, nowMs);
  switch (status) {
    case "online":
      return "Dashboard online";
    case "recent":
      return "Recently active";
    default:
      return "Dashboard offline";
  }
}

export function vendorDashboardPresenceDetail(
  lastSeenAt: Date | string | null | undefined,
  nowMs: number = Date.now()
): string | null {
  if (lastSeenAt == null) return "No dashboard activity recorded yet.";
  const ts = new Date(lastSeenAt);
  if (!Number.isFinite(ts.getTime())) return null;
  return `Last seen ${ts.toLocaleString()}`;
}
