import { describe, expect, it } from "vitest";
import { deriveVendorAttentionItems } from "./vendor-dashboard-attention";

describe("deriveVendorAttentionItems manual hours", () => {
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

  it("warns when manual customer ordering hours are not set", () => {
    const items = deriveVendorAttentionItems({
      ...base,
      hoursSummary: {
        needsHoursAttention: true,
        sourceLabel: "Hours need setup",
      },
    });
    expect(items.some((item) => item.id === "hours_setup")).toBe(true);
    expect(items.some((item) => item.title.includes("Deliverect"))).toBe(false);
  });
});
