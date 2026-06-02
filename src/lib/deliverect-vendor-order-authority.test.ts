import { describe, expect, it } from "vitest";
import {
  canVendorDashboardMutateVendorOrder,
  isDeliverectAuthoritativeVendorOrder,
  isOpenOrderAuthoritativeVendorOrder,
} from "./deliverect-vendor-order-authority";

const deliverectVo = {
  statusAuthority: "pos" as const,
  lastStatusSource: "deliverect_webhook" as const,
  deliverectChannelLinkId: "ch_1",
  vendor: { deliverectChannelLinkId: "ch_1" },
  routingStatus: "confirmed",
  manuallyRecoveredAt: null,
};

const manualVo = {
  statusAuthority: "vendor_manual" as const,
  lastStatusSource: null,
  deliverectChannelLinkId: null,
  vendor: { deliverectChannelLinkId: null },
  routingStatus: "sent",
  manuallyRecoveredAt: null,
};

describe("deliverect-vendor-order-authority", () => {
  it("treats channel-linked orders as Deliverect-authoritative", () => {
    expect(isDeliverectAuthoritativeVendorOrder(deliverectVo)).toBe(true);
    expect(canVendorDashboardMutateVendorOrder(deliverectVo)).toBe(false);
  });

  it("treats manual vendors without channel link as Open Order–authoritative", () => {
    expect(isOpenOrderAuthoritativeVendorOrder(manualVo)).toBe(true);
    expect(canVendorDashboardMutateVendorOrder(manualVo)).toBe(true);
  });

  it("admin manual recovery returns Open Order authority even with channel link", () => {
    const recovered = {
      ...deliverectVo,
      manuallyRecoveredAt: new Date(),
      statusAuthority: "admin_override" as const,
    };
    expect(isDeliverectAuthoritativeVendorOrder(recovered)).toBe(false);
    expect(canVendorDashboardMutateVendorOrder(recovered)).toBe(true);
  });

  it("channel-linked sent/pending infers vendor_manual but remains Deliverect-authoritative", () => {
    const sent = {
      ...deliverectVo,
      statusAuthority: null,
      routingStatus: "sent",
    };
    expect(isDeliverectAuthoritativeVendorOrder(sent)).toBe(true);
  });
});
