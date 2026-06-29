import { describe, expect, it } from "vitest";
import {
  buildVendorOperationalSetupItems,
  deriveVendorAttentionItems,
  isVendorSetupComplete,
} from "./vendor-dashboard-attention";
import { VENDOR_HOURS_PUBLIC_COPY } from "./vendor-operational-copy";
import type { ReadinessChecklistItem } from "./vendor-pod-readiness";

describe("deriveVendorAttentionItems", () => {
  const completePublicChecklist: ReadinessChecklistItem[] = [
    { key: "name", label: "Vendor name", complete: true, owner: "vendor" },
    { key: "menu", label: "Publish menu", complete: true, owner: "vendor" },
    { key: "hours", label: "Customer ordering hours", complete: true, owner: "vendor" },
  ];

  const base = {
    checklist: completePublicChecklist,
    publicProfileReady: true,
    canAcceptOrders: true,
    posState: "connected" as const,
    hasPodMembership: true,
    pendingPodInviteCount: 0,
    failedOrdersToday: 0,
    vendorPaused: false,
    currentlyOpen: true,
  };

  it("shows a single hours warning with public visibility copy when hours are missing", () => {
    const items = deriveVendorAttentionItems({
      ...base,
      publicProfileReady: false,
      canAcceptOrders: false,
      checklist: [
        ...completePublicChecklist.filter((item) => item.key !== "hours"),
        {
          key: "hours",
          label: "Customer ordering hours",
          complete: false,
          owner: "vendor",
          actionHref: "/vendor/v1/hours",
          actionLabel: "Set hours",
        },
      ],
    });

    const hourItems = items.filter((item) => item.id === "hours" || item.id === "hours_setup");
    expect(hourItems).toHaveLength(1);
    expect(hourItems[0]?.title).toBe("Customer ordering hours");
    expect(hourItems[0]?.description).toBe(VENDOR_HOURS_PUBLIC_COPY);
    expect(hourItems[0]?.actionLabel).toBe("Set hours");
    expect(items.some((item) => item.id === "vendor_hidden")).toBe(true);
    expect(items.some((item) => item.title.includes("not set"))).toBe(false);
  });

  it("does not show operational blockers while public profile is incomplete", () => {
    const items = deriveVendorAttentionItems({
      ...base,
      publicProfileReady: false,
      canAcceptOrders: false,
      checklist: [
        {
          key: "hours",
          label: "Customer ordering hours",
          complete: false,
          owner: "vendor",
        },
        {
          key: "stripe",
          label: "Connect Stripe payouts",
          complete: false,
          owner: "vendor",
        },
      ],
    });

    expect(items.some((item) => item.id === "stripe")).toBe(false);
    expect(items.some((item) => item.id === "ordering_closed")).toBe(false);
  });

  it("shows ordering closed summary when public profile is complete but orders are blocked", () => {
    const items = deriveVendorAttentionItems({
      ...base,
      canAcceptOrders: false,
      checklist: [
        ...completePublicChecklist,
        {
          key: "stripe",
          label: "Connect Stripe payouts",
          complete: false,
          owner: "vendor",
          description: "Stripe Connect account with charges and payouts enabled.",
        },
      ],
    });

    expect(items.some((item) => item.id === "ordering_closed")).toBe(true);
    expect(items.some((item) => item.id === "vendor_hidden")).toBe(false);
    expect(items.some((item) => item.id === "stripe")).toBe(true);
  });

  it("does not show Deliverect POS warnings in manual dashboard routing mode", () => {
    const items = deriveVendorAttentionItems({
      ...base,
      canAcceptOrders: false,
      deliverectRoutingMode: false,
      posState: "not_connected",
      checklist: [
        ...completePublicChecklist,
        {
          key: "stripe",
          label: "Connect Stripe payouts",
          complete: false,
          owner: "vendor",
        },
      ],
    });

    expect(items.some((item) => item.id === "pos_disconnected")).toBe(false);
    expect(items.some((item) => item.id === "pos_attention")).toBe(false);
  });
});

describe("isVendorSetupComplete", () => {
  it("requires customer ordering hours before setup is complete", () => {
    const withoutHours = [
      "name",
      "description",
      "banner",
      "cuisine",
      "menu",
      "stripe",
      "pos",
      "menu_available",
      "pod_invite",
    ];
    expect(isVendorSetupComplete(withoutHours)).toBe(false);

    const withHours = [...withoutHours, "hours"];
    expect(isVendorSetupComplete(withHours)).toBe(true);
  });
});

describe("buildVendorOperationalSetupItems", () => {
  it("includes pause and open-state rows for the operational checklist", () => {
    const items = buildVendorOperationalSetupItems({
      vendorId: "vendor_1",
      vendorPaused: true,
      currentlyOpen: false,
      checklist: [
        {
          key: "stripe",
          label: "Connect Stripe payouts",
          complete: false,
          owner: "vendor",
        },
      ],
    });

    expect(items.some((item) => item.key === "not_paused" && !item.complete)).toBe(true);
    expect(items.some((item) => item.key === "currently_open" && !item.complete)).toBe(true);
  });
});
