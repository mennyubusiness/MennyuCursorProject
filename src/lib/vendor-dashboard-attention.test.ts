import { describe, expect, it } from "vitest";
import { deriveVendorAttentionItems } from "./vendor-dashboard-attention";

describe("deriveVendorAttentionItems hours sync", () => {
  const base = {
    blockingReasons: [],
    posState: "connected" as const,
    paymentsReady: true,
    menuSynced: true,
    hasPodMembership: true,
    pendingPodInviteCount: 0,
    failedOrdersToday: 0,
    intakeLabel: "Accepting orders",
  };

  it("warns when Deliverect sync is enabled but no hours fetched", () => {
    const items = deriveVendorAttentionItems({
      ...base,
      hoursSummary: {
        needsHoursAttention: true,
        syncFailed: false,
        sourceLabel: "Hours sync needs attention",
        todayLabel: "No synced hours are available yet.",
      },
    });
    expect(items.some((item) => item.id === "hours_sync")).toBe(true);
  });

  it("warns when latest Deliverect sync failed", () => {
    const items = deriveVendorAttentionItems({
      ...base,
      hoursSummary: {
        needsHoursAttention: true,
        syncFailed: true,
        sourceLabel: "Synced from Deliverect · latest sync failed",
        todayLabel: "Open until 9:00 PM",
      },
    });
    expect(items.some((item) => item.title.includes("sync failed"))).toBe(true);
  });
});
