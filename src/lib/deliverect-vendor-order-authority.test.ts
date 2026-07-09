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
  it("treats channel-linked orders as Deliverect-authoritative in deliverect routing mode", () => {
    expect(isDeliverectAuthoritativeVendorOrder(deliverectVo, "deliverect")).toBe(true);
    expect(canVendorDashboardMutateVendorOrder(deliverectVo, "deliverect")).toBe(false);
  });

  it("treats manual_dashboard vendors as Open Order–authoritative even with channel link", () => {
    expect(isDeliverectAuthoritativeVendorOrder(deliverectVo, "manual_dashboard")).toBe(false);
    expect(canVendorDashboardMutateVendorOrder(deliverectVo, "manual_dashboard")).toBe(true);
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

  it("Square-routed order with squareOrderId is not Deliverect-authoritative and blocks vendor mutate", () => {
    const squareVo = {
      statusAuthority: "pos" as const,
      lastStatusSource: "square_webhook" as const,
      deliverectChannelLinkId: null,
      vendor: { deliverectChannelLinkId: null },
      routingStatus: "sent",
      squareOrderId: "sq_1",
      manuallyRecoveredAt: null,
    };
    expect(isDeliverectAuthoritativeVendorOrder(squareVo, "square")).toBe(false);
    expect(canVendorDashboardMutateVendorOrder(squareVo, "square")).toBe(false);
  });

  it("channel-linked sent/pending infers vendor_manual but remains Deliverect-authoritative in deliverect mode", () => {
    const sent = {
      ...deliverectVo,
      statusAuthority: null,
      routingStatus: "sent",
    };
    expect(isDeliverectAuthoritativeVendorOrder(sent, "deliverect")).toBe(true);
  });
});
