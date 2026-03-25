import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mennyuVendorOrderToDeliverectPayload } from "./transform";
import type { HydratedVendorOrder } from "./load";

/** Minimal shape accepted by mennyuVendorOrderToDeliverectPayload (matches DB hydrate). */
function minimalVendorOrder(overrides?: Partial<NonNullable<HydratedVendorOrder>>): NonNullable<HydratedVendorOrder> {
  return {
    id: "vo_cert_test",
    taxCents: 50,
    totalCents: 1050,
    lineItems: [
      {
        id: "line-1",
        menuItemId: "menu-item-1",
        name: "Test item",
        quantity: 1,
        priceCents: 1000,
        specialInstructions: null,
        menuItem: { id: "menu-item-1", deliverectProductId: "dc-prod-1" },
        selections: [],
      },
    ],
    order: {
      customerPhone: "+15555550100",
      customerEmail: null,
      orderNotes: null,
      stripePaymentIntentId: "pi_cert_fixture",
    },
    ...overrides,
  } as NonNullable<HydratedVendorOrder>;
}

describe("mennyuVendorOrderToDeliverectPayload (ASAP / pickup certification)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T14:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets pickup channel, prep 15, isASAP true, and pickupTime = now + 15m (UTC, no ms)", () => {
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: minimalVendorOrder(),
      channelLinkId: "ch-link-cert",
      preparationTimeMinutes: 15,
    });

    expect(payload.orderType).toBe(1);
    expect(payload.preparationTime).toBe(15);
    expect(payload.isASAP).toBe(true);
    expect(payload.pickupTime).toBe("2025-06-01T14:15:00Z");
    expect(payload.pickupTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("sets isASAP false when preparation time exceeds 30 minutes", () => {
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: minimalVendorOrder(),
      channelLinkId: "ch-link-cert",
      preparationTimeMinutes: 45,
    });

    expect(payload.preparationTime).toBe(45);
    expect(payload.isASAP).toBe(false);
    expect(payload.pickupTime).toBe("2025-06-01T14:45:00Z");
  });

  it("defaults preparation to 15 when omitted", () => {
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: minimalVendorOrder(),
      channelLinkId: "ch-link-cert",
    });

    expect(payload.preparationTime).toBe(15);
    expect(payload.isASAP).toBe(true);
  });
});
