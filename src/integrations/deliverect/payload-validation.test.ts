import { describe, expect, it } from "vitest";
import type { DeliverectOrderRequest } from "./payloads";
import {
  buildDeliverectPayloadValidationSnapshot,
  summarizeDeliverectPayloadValidationErrors,
  validateDeliverectPayload,
} from "./payload-validation";
import type { HydratedVendorOrder } from "./load";

function minimalVo(over: Partial<NonNullable<HydratedVendorOrder>> = {}): NonNullable<HydratedVendorOrder> {
  return {
    id: "vo1",
    orderId: "o1",
    vendorId: "v1",
    subtotalCents: 1000,
    tipCents: 0,
    taxCents: 0,
    serviceFeeCents: 0,
    totalCents: 1000,
    vendorProcessingFeeRecoveryCents: 0,
    deliverectAttempts: 0,
    routingStatus: "pending",
    fulfillmentStatus: "pending",
    lineItems: [
      {
        id: "li1",
        name: "Burger",
        quantity: 1,
        priceCents: 1000,
        menuItemId: "m1",
        menuItem: {
          id: "m1",
          name: "Burger",
          deliverectProductId: null,
          deliverectPlu: "PLU-B",
          deliverectVariantParentPlu: null,
          deliverectVariantParentName: null,
        },
        selections: [],
      },
    ],
    order: {
      stripePaymentIntentId: "pi_test",
      customerPhone: "+15555550100",
      customerEmail: null,
      orderNotes: null,
      requestedPickupAt: null,
    },
    vendor: { id: "v1", name: "V", deliverectChannelLinkId: "cl" },
    ...over,
  } as NonNullable<HydratedVendorOrder>;
}

function basePayload(over: Partial<DeliverectOrderRequest> = {}): DeliverectOrderRequest {
  return {
    channelLinkId: "cl",
    channelOrderId: "vo1",
    channelOrderDisplayId: "vo1",
    items: [
      {
        plu: "PLU-B",
        name: "Burger",
        quantity: 1,
        price: 1000,
      },
    ],
    orderType: 1,
    payment: { amount: 1000, type: 0 },
    ...over,
  };
}

describe("validateDeliverectPayload", () => {
  it("accepts a minimal consistent payload", () => {
    const vo = minimalVo();
    const payload = basePayload();
    const r = validateDeliverectPayload(payload, vo);
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects empty items", () => {
    const vo = minimalVo({ lineItems: [] });
    const payload = basePayload({ items: [] });
    const r = validateDeliverectPayload(payload, vo);
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.type === "empty_items")).toBe(true);
  });

  it("rejects payment amount mismatch", () => {
    const vo = minimalVo();
    const payload = basePayload({ payment: { amount: 1, type: 0 } });
    const r = validateDeliverectPayload(payload, vo);
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.type === "price_mismatch")).toBe(true);
  });

  it("accepts item sum vs item-only total when tax and platform fee are non-zero", () => {
    const vo = minimalVo({
      subtotalCents: 1700,
      taxCents: 140,
      serviceFeeCents: 60,
      tipCents: 0,
      totalCents: 1900,
      lineItems: [
        {
          id: "li1",
          vendorOrderId: "vo1",
          name: "Meal",
          quantity: 1,
          priceCents: 1700,
          specialInstructions: null,
          groupOrderParticipantId: null,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          menuItemId: "m1",
          menuItem: {
            id: "m1",
            name: "Meal",
            deliverectProductId: null,
            deliverectPlu: "PLU-M",
            deliverectVariantParentPlu: null,
            deliverectVariantParentName: null,
          },
          selections: [],
        },
      ],
    });
    const payload = basePayload({
      items: [{ plu: "PLU-M", name: "Meal", quantity: 1, price: 1700 }],
      payment: { amount: 1840, type: 0 },
    });
    const r = validateDeliverectPayload(payload, vo);
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects when payload item sum does not match item-only total (excluding tax/fees)", () => {
    const vo = minimalVo({
      subtotalCents: 1700,
      taxCents: 140,
      serviceFeeCents: 60,
      tipCents: 0,
      totalCents: 1900,
    });
    const payload = basePayload({
      items: [{ plu: "PLU-B", name: "Burger", quantity: 1, price: 1800 }],
      payment: { amount: 1840, type: 0 },
    });
    const r = validateDeliverectPayload(payload, vo);
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.type === "price_mismatch" && e.path === "items")).toBe(true);
  });

  it("uses total − tax − fee − tip for item subtotal so a stale subtotalCents field does not false-fail", () => {
    const vo = minimalVo({
      subtotalCents: 999,
      taxCents: 140,
      serviceFeeCents: 60,
      tipCents: 0,
      totalCents: 1900,
    });
    const payload = basePayload({
      items: [{ plu: "PLU-B", name: "Burger", quantity: 1, price: 1700 }],
      payment: { amount: 1840, type: 0 },
    });
    const r = validateDeliverectPayload(payload, vo);
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("flags missing externalProductId when menu item has deliverectProductId", () => {
    const vo = minimalVo({
      lineItems: [
        {
          id: "li1",
          vendorOrderId: "vo1",
          name: "Leaf",
          quantity: 1,
          priceCents: 500,
          specialInstructions: null,
          groupOrderParticipantId: null,
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          menuItemId: "m1",
          menuItem: {
            id: "m1",
            name: "Leaf",
            deliverectProductId: "mongo123",
            deliverectPlu: "PLU-LEAF",
            deliverectVariantParentPlu: "PARENT",
            deliverectVariantParentName: "Combo",
          },
          selections: [],
        },
      ],
    });
    const payload = basePayload({
      items: [
        {
          plu: "PARENT",
          name: "Combo",
          quantity: 1,
          price: 0,
          subItems: [
            {
              plu: "PLU-LEAF",
              name: "Leaf",
              quantity: 1,
              price: 500,
            },
          ],
        },
      ],
    });
    const r = validateDeliverectPayload(payload, vo);
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.type === "missing_external_product_id")).toBe(true);
  });

  it("snapshot helpers produce summary", () => {
    const vo = minimalVo();
    const payload = basePayload({ payment: { amount: 5, type: 0 } });
    const r = validateDeliverectPayload(payload, vo);
    const snap = buildDeliverectPayloadValidationSnapshot(r.errors);
    expect(snap.isValid).toBe(false);
    expect(snap.summary).toBeTruthy();
    expect(summarizeDeliverectPayloadValidationErrors(r.errors)).toBe(snap.summary);
  });
});
