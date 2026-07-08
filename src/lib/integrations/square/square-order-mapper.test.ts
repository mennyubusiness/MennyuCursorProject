import { describe, expect, it, vi } from "vitest";

const mockGetMapping = vi.fn();

vi.mock("@/lib/integrations/provider-mapping.service", () => ({
  getProviderEntityMapping: (...args: unknown[]) => mockGetMapping(...args),
}));

import { mapVendorOrderToSquareCreateOrder } from "@/lib/integrations/square/square-order-mapper";

function vendorOrderFixture() {
  return {
    id: "vo_1",
    vendorId: "vendor_1",
    order: {
      id: "ord_1",
      orderNotes: "Extra napkins",
      customerPhone: "+15551212",
    },
    vendor: { id: "vendor_1", name: "Test Vendor" },
    lineItems: [
      {
        id: "li_1",
        menuItemId: "mi_1",
        name: "Latte",
        quantity: 2,
        specialInstructions: "Oat milk",
        menuItem: {
          id: "mi_1",
          name: "Latte",
          deliverectProductId: "sq:prod:VAR_1",
        },
        selections: [
          {
            modifierOption: {
              id: "mo_1",
              name: "Extra shot",
              deliverectModifierId: "sq:modopt:MOD_1",
            },
          },
        ],
      },
    ],
  };
}

describe("mapVendorOrderToSquareCreateOrder", () => {
  it("maps items and modifiers via ProviderEntityMapping", async () => {
    mockGetMapping.mockImplementation(async (input: { internalEntityType: string }) => {
      if (input.internalEntityType === "menu_item") {
        return { externalId: "VAR_1", isActive: true };
      }
      if (input.internalEntityType === "modifier_option") {
        return { externalId: "MOD_1", isActive: true };
      }
      return null;
    });

    const result = await mapVendorOrderToSquareCreateOrder({
      vendorOrder: vendorOrderFixture() as never,
      locationId: "LOC_1",
      idempotencyKey: "oo:sq:order:vo_1",
      customerDisplayName: "Sam",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.order.location_id).toBe("LOC_1");
    expect(result.request.order.source?.name).toBe("Open Order");
    expect(result.request.order.line_items[0]?.catalog_object_id).toBe("VAR_1");
    expect(result.request.order.line_items[0]?.quantity).toBe("2");
    expect(result.request.order.line_items[0]?.modifiers?.[0]?.catalog_object_id).toBe("MOD_1");
    expect(result.request.order.fulfillments?.[0]?.type).toBe("PICKUP");
    expect(result.request.order.fulfillments?.[0]?.pickup_details?.note).toMatch(/Pickup code/);
  });

  it("blocks routing when item mapping is missing", async () => {
    mockGetMapping.mockResolvedValue(null);

    const result = await mapVendorOrderToSquareCreateOrder({
      vendorOrder: vendorOrderFixture() as never,
      locationId: "LOC_1",
      idempotencyKey: "oo:sq:order:vo_1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "MISSING_ITEM_MAPPING")).toBe(true);
  });

  it("blocks routing when modifier mapping is missing", async () => {
    mockGetMapping.mockImplementation(async (input: { internalEntityType: string }) => {
      if (input.internalEntityType === "menu_item") {
        return { externalId: "VAR_1", isActive: true };
      }
      return null;
    });

    const result = await mapVendorOrderToSquareCreateOrder({
      vendorOrder: vendorOrderFixture() as never,
      locationId: "LOC_1",
      idempotencyKey: "oo:sq:order:vo_1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "MISSING_MODIFIER_MAPPING")).toBe(true);
  });
});
