import { describe, expect, it } from "vitest";
import {
  resolveVendorDashboardPresenceStatus,
  vendorDashboardPresenceLabel,
  VENDOR_DASHBOARD_PRESENCE_ONLINE_MS,
  VENDOR_DASHBOARD_PRESENCE_RECENT_MS,
} from "./vendor-dashboard-presence";

describe("vendor-dashboard-presence", () => {
  const now = Date.parse("2026-06-04T12:00:00.000Z");

  it("marks vendor online within 2 minutes", () => {
    const lastSeen = new Date(now - 60_000).toISOString();
    expect(resolveVendorDashboardPresenceStatus(lastSeen, now)).toBe("online");
    expect(vendorDashboardPresenceLabel(lastSeen, now)).toBe("Dashboard online");
  });

  it("marks vendor recently active within 10 minutes", () => {
    const lastSeen = new Date(now - VENDOR_DASHBOARD_PRESENCE_ONLINE_MS - 60_000).toISOString();
    expect(resolveVendorDashboardPresenceStatus(lastSeen, now)).toBe("recent");
    expect(vendorDashboardPresenceLabel(lastSeen, now)).toBe("Recently active");
  });

  it("marks vendor offline after 10 minutes", () => {
    const lastSeen = new Date(now - VENDOR_DASHBOARD_PRESENCE_RECENT_MS - 1).toISOString();
    expect(resolveVendorDashboardPresenceStatus(lastSeen, now)).toBe("offline");
    expect(vendorDashboardPresenceLabel(lastSeen, now)).toBe("Dashboard offline");
  });
});
