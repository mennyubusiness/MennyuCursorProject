import { describe, expect, it } from "vitest";
import {
  derivePodDashboardLayoutState,
  filterActionablePodSetupItems,
} from "./pod-dashboard-layout";
import type { ReadinessChecklistItem } from "./vendor-pod-readiness";

function checklistItem(
  overrides: Partial<ReadinessChecklistItem> & Pick<ReadinessChecklistItem, "key" | "complete">
): ReadinessChecklistItem {
  return {
    label: overrides.key,
    owner: "pod_owner",
    ...overrides,
  };
}

describe("filterActionablePodSetupItems", () => {
  it("returns only incomplete pod-owner items excluding vendor and open-order checklist rows", () => {
    const items: ReadinessChecklistItem[] = [
      checklistItem({ key: "pod_profile", complete: false }),
      checklistItem({ key: "order_link", complete: true }),
      checklistItem({ key: "vendor_ready", complete: false }),
      checklistItem({ key: "pod_active", complete: false, owner: "open_order" }),
    ];

    expect(filterActionablePodSetupItems(items)).toEqual([
      checklistItem({ key: "pod_profile", complete: false }),
    ]);
  });
});

describe("derivePodDashboardLayoutState", () => {
  const completePodChecklist: ReadinessChecklistItem[] = [
    checklistItem({ key: "pod_profile", complete: true }),
    checklistItem({ key: "vendor_ready", complete: false }),
  ];

  it("promotes invite and hides vendor sections when the pod has no vendors", () => {
    const state = derivePodDashboardLayoutState({
      vendorCount: 0,
      podSetupChecklist: completePodChecklist,
      adoptionAttentionRows: [],
    });

    expect(state.hasVendors).toBe(false);
    expect(state.shouldPromoteInviteSection).toBe(true);
    expect(state.shouldShowVendorSetupSection).toBe(false);
    expect(state.shouldShowVendorRoster).toBe(false);
    expect(state.shouldShowPodSetupSection).toBe(false);
  });

  it("shows pod setup only when pod-owner checklist items remain incomplete", () => {
    const state = derivePodDashboardLayoutState({
      vendorCount: 0,
      podSetupChecklist: [checklistItem({ key: "pod_profile", complete: false })],
      adoptionAttentionRows: [],
    });

    expect(state.shouldShowPodSetupSection).toBe(true);
    expect(state.actionablePodSetupItems).toHaveLength(1);
  });

  it("shows vendor setup when vendors exist and at least one needs attention", () => {
    const state = derivePodDashboardLayoutState({
      vendorCount: 2,
      podSetupChecklist: completePodChecklist,
      adoptionAttentionRows: [
        {
          vendorId: "v1",
          vendorSlug: "v1",
          name: "Vendor One",
          imageUrl: null,
          displayStatus: "Needs Stripe",
          status: "needs_payment",
          primaryBlockerCode: "stripe",
          setupPath: "/vendor/v1/settings?section=payouts",
          reminderText: "Hi",
        },
      ],
    });

    expect(state.hasVendors).toBe(true);
    expect(state.shouldPromoteInviteSection).toBe(false);
    expect(state.shouldShowVendorSetupSection).toBe(true);
    expect(state.shouldShowVendorRoster).toBe(true);
    expect(state.shouldShowPodSetupSection).toBe(false);
  });

  it("hides vendor setup when every vendor is orderable", () => {
    const state = derivePodDashboardLayoutState({
      vendorCount: 1,
      podSetupChecklist: completePodChecklist,
      adoptionAttentionRows: [],
    });

    expect(state.shouldShowVendorSetupSection).toBe(false);
    expect(state.shouldShowVendorRoster).toBe(true);
  });
});
