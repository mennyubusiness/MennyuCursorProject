import { describe, expect, it } from "vitest";

import {
  deriveVendorAttentionItems,
  isVendorSetupComplete,
} from "@/lib/vendor-dashboard-attention";
import {
  vendorIntakeStatusLabel,
  VENDOR_ALL_READY_COPY,
} from "@/lib/vendor-operational-copy";

describe("vendorIntakeStatusLabel", () => {
  it("returns plain operational labels", () => {
    expect(
      vendorIntakeStatusLabel({
        availabilityStatus: "open",
        setupComplete: true,
        canAcceptOrders: true,
      })
    ).toBe("Accepting orders");
    expect(
      vendorIntakeStatusLabel({
        availabilityStatus: "mennyu_paused",
        setupComplete: true,
        canAcceptOrders: false,
      })
    ).toBe("Paused");
  });
});

describe("deriveVendorAttentionItems", () => {
  it("returns empty when everything is ready", () => {
    const items = deriveVendorAttentionItems({
      blockingReasons: [],
      posState: "connected",
      paymentsReady: true,
      menuSynced: true,
      hasPodMembership: true,
      pendingPodInviteCount: 0,
      failedOrdersToday: 0,
      intakeLabel: "Accepting orders",
    });
    expect(items).toHaveLength(0);
  });

  it("surfaces payment and menu issues in plain English", () => {
    const items = deriveVendorAttentionItems({
      blockingReasons: [],
      posState: "not_connected",
      paymentsReady: false,
      menuSynced: false,
      hasPodMembership: false,
      pendingPodInviteCount: 0,
      failedOrdersToday: 0,
      intakeLabel: "Not ready",
    });
    expect(items.some((item) => item.title.includes("Payment"))).toBe(true);
    expect(items.some((item) => item.title.includes("Menu"))).toBe(true);
    expect(items.some((item) => item.title.includes("pod"))).toBe(true);
  });
});

describe("isVendorSetupComplete", () => {
  it("requires core checklist keys", () => {
    expect(isVendorSetupComplete(["profile", "stripe", "pos", "menu", "pod_invite"])).toBe(true);
    expect(isVendorSetupComplete(["profile", "stripe"])).toBe(false);
  });
});

describe("empty state copy", () => {
  it("uses calm ready messaging", () => {
    expect(VENDOR_ALL_READY_COPY).toMatch(/Everything looks ready/i);
  });
});
