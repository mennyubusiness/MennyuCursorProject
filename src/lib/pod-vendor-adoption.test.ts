import { describe, expect, it } from "vitest";

import {
  buildPodAdoptionAttentionRows,
  buildVendorAdoptionReminderMessage,
  buildVendorSetupSettingsPath,
  computePodLaunchReadinessSummary,
  podOwnerVendorDisplayStatus,
  vendorNeedsAdoptionAttention,
} from "./pod-vendor-adoption";

describe("podOwnerVendorDisplayStatus", () => {
  it("shows Live for orderable vendors", () => {
    expect(podOwnerVendorDisplayStatus("active", true)).toBe("Live");
  });

  it("maps setup blockers to owner-facing labels", () => {
    expect(podOwnerVendorDisplayStatus("needs_payment", false)).toBe("Needs Stripe");
    expect(podOwnerVendorDisplayStatus("needs_menu", false)).toBe("Needs menu");
    expect(podOwnerVendorDisplayStatus("needs_pos", false)).toBe("Needs POS connection");
    expect(podOwnerVendorDisplayStatus("needs_profile", false)).toBe("Needs profile");
  });

  it("maps pause and platform states", () => {
    expect(podOwnerVendorDisplayStatus("paused_in_pod", false)).toBe("Paused in pod");
    expect(podOwnerVendorDisplayStatus("pod_inactive", false)).toBe("Not orderable");
  });
});

describe("vendorNeedsAdoptionAttention", () => {
  it("surfaces vendors with blockers and excludes live vendors", () => {
    expect(vendorNeedsAdoptionAttention("needs_payment", false)).toBe(true);
    expect(vendorNeedsAdoptionAttention("active", true)).toBe(false);
  });
});

describe("computePodLaunchReadinessSummary", () => {
  it("reports orderable counts for active vendors", () => {
    const summary = computePodLaunchReadinessSummary([
      {
        podVendorActive: true,
        vendorGloballyActive: true,
        readiness: { canAcceptOrders: true },
      },
      {
        podVendorActive: true,
        vendorGloballyActive: true,
        readiness: { canAcceptOrders: false },
      },
    ]);

    expect(summary.headline).toBe("1 of 2 active vendors are orderable");
    expect(summary.allOrderable).toBe(false);
    expect(summary.detail).toContain("Some vendors still need setup");
  });

  it("reports when all active vendors are orderable", () => {
    const summary = computePodLaunchReadinessSummary([
      {
        podVendorActive: true,
        vendorGloballyActive: true,
        readiness: { canAcceptOrders: true },
      },
    ]);

    expect(summary.allOrderable).toBe(true);
    expect(summary.detail).toBe("All active vendors are ready for customer orders.");
  });
});

describe("buildVendorAdoptionReminderMessage", () => {
  it("includes blocker-specific copy without fake metrics", () => {
    const message = buildVendorAdoptionReminderMessage("Taco Lab", "needs_payment", "stripe");
    expect(message).toContain("Hi Taco Lab");
    expect(message).toContain("Open Order pod page ready");
    expect(message).toContain("Stripe setup still needs to be completed");
    expect(message).not.toMatch(/\$\d|revenue|payout/i);
  });

  it("uses generic copy when blocker is unknown", () => {
    const message = buildVendorAdoptionReminderMessage("Taco Lab", "paused_in_pod", "paused_in_pod");
    expect(message).toContain("paused in our pod");
  });
});

describe("buildVendorSetupSettingsPath", () => {
  it("returns vendor settings paths for setup blockers", () => {
    expect(buildVendorSetupSettingsPath("vendor_1", "needs_payment", "stripe")).toBe(
      "/vendor/vendor_1/settings?section=payouts"
    );
    expect(buildVendorSetupSettingsPath("vendor_1", "needs_menu", "menu")).toBe("/vendor/vendor_1/menu");
  });

  it("skips setup link when pod owner must act", () => {
    expect(buildVendorSetupSettingsPath("vendor_1", "paused_in_pod", "paused_in_pod")).toBeNull();
  });
});

describe("buildPodAdoptionAttentionRows", () => {
  it("prioritizes setup blockers ahead of paused vendors", () => {
    const rows = buildPodAdoptionAttentionRows([
      {
        vendorId: "v1",
        vendorSlug: "paused",
        name: "Paused Cart",
        imageUrl: null,
        readiness: {
          status: "paused_in_pod",
          canAcceptOrders: false,
          primaryBlocker: { code: "paused_in_pod" },
        },
      },
      {
        vendorId: "v2",
        vendorSlug: "stripe",
        name: "Stripe Cart",
        imageUrl: null,
        readiness: {
          status: "needs_payment",
          canAcceptOrders: false,
          primaryBlocker: { code: "stripe" },
        },
      },
    ]);

    expect(rows.map((row) => row.name)).toEqual(["Stripe Cart", "Paused Cart"]);
    expect(rows[0]?.displayStatus).toBe("Needs Stripe");
  });

  it("excludes live vendors from needs attention", () => {
    const rows = buildPodAdoptionAttentionRows([
      {
        vendorId: "v1",
        vendorSlug: "live",
        name: "Live Cart",
        imageUrl: null,
        readiness: {
          status: "active",
          canAcceptOrders: true,
          primaryBlocker: null,
        },
      },
    ]);

    expect(rows).toHaveLength(0);
  });
});
