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
      requestedPickupAt: null,
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

  it("ASAP orders keep isASAP true even when preparation time exceeds 30 minutes", () => {
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: minimalVendorOrder(),
      channelLinkId: "ch-link-cert",
      preparationTimeMinutes: 45,
    });

    expect(payload.preparationTime).toBe(45);
    expect(payload.isASAP).toBe(true);
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

  it("scheduled pickup: isASAP false and pickupTime from order.requestedPickupAt", () => {
    const base = minimalVendorOrder();
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: minimalVendorOrder({
        order: {
          ...base.order,
          requestedPickupAt: new Date("2025-06-03T16:45:00.000Z"),
        },
      }),
      channelLinkId: "ch-link-cert",
      preparationTimeMinutes: 15,
    });

    expect(payload.isASAP).toBe(false);
    expect(payload.pickupTime).toBe("2025-06-03T16:45:00Z");
    expect(payload.orderType).toBe(1);
    expect(payload.preparationTime).toBe(15);
    expect(payload.pickupTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("scheduled pickupTime is the stored instant, not shifted by fake timers", () => {
    const base = minimalVendorOrder();
    const stored = new Date("2026-12-24T20:00:00.000Z");
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: minimalVendorOrder({
        order: { ...base.order, requestedPickupAt: stored },
      }),
      channelLinkId: "ch-link-cert",
      preparationTimeMinutes: 20,
    });
    expect(payload.pickupTime).toBe("2026-12-24T20:00:00Z");
    expect(payload.isASAP).toBe(false);
  });
});
