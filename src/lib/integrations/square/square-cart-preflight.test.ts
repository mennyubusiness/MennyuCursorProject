import { beforeEach, describe, expect, it, vi } from "vitest";

const mockVendorFindMany = vi.fn();
const mockModifierFindMany = vi.fn();
const mockConnection = vi.fn();
const mockReadiness = vi.fn();
const mockCartLines = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: { findMany: (...args: unknown[]) => mockVendorFindMany(...args) },
    modifierOption: { findMany: (...args: unknown[]) => mockModifierFindMany(...args) },
  },
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  getActiveSquareConnectionForVendor: (...args: unknown[]) => mockConnection(...args),
}));

vi.mock("@/lib/integrations/square/square-order-routing-readiness", () => ({
  loadSquareOrderRoutingReadiness: (...args: unknown[]) => mockReadiness(...args),
}));

vi.mock("@/lib/integrations/square/square-mapping-coverage.server", () => ({
  evaluateSquareCartLinesRoutability: (...args: unknown[]) => mockCartLines(...args),
  evaluateSquareMenuMappingCoverage: vi.fn(),
}));

import { validateSquareCartPreflight } from "@/lib/integrations/square/square-cart-preflight.server";
import {
  SQUARE_CART_PREFLIGHT_CUSTOMER_MESSAGE,
  SQUARE_CART_PREFLIGHT_FAILED,
} from "@/lib/integrations/square/square-routing-failure";

describe("validateSquareCartPreflight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockModifierFindMany.mockResolvedValue([]);
  });

  it("passes for non-Square vendors without creating Square orders", async () => {
    mockVendorFindMany.mockResolvedValue([
      { id: "v_manual", orderRoutingMode: "manual_dashboard" },
    ]);

    const result = await validateSquareCartPreflight([
      {
        id: "ci_1",
        menuItemId: "mi_1",
        vendorId: "v_manual",
        menuItem: { name: "Burger", isAvailable: true, deliverectProductId: null },
      },
    ]);

    expect(result).toEqual({ valid: true });
    expect(mockConnection).not.toHaveBeenCalled();
    expect(mockCartLines).not.toHaveBeenCalled();
  });

  it("fails before payment when Square vendor readiness is incomplete", async () => {
    mockVendorFindMany.mockResolvedValue([{ id: "v_sq", orderRoutingMode: "square" }]);
    mockReadiness.mockResolvedValue({
      prerequisitesReady: false,
      locationId: "LOC_NEW",
      prerequisiteBlockers: ["1 of 9 sellable items…"],
      mappingCoverage: {
        missingItemIds: ["mi_1"],
        missingRequiredModifierOptionIds: [],
        alternateLocationIds: ["LOC_OLD"],
      },
    });

    const result = await validateSquareCartPreflight([
      {
        id: "ci_1",
        menuItemId: "mi_1",
        vendorId: "v_sq",
        menuItem: {
          name: "Poke",
          isAvailable: true,
          deliverectProductId: "sq:prod:1",
        },
      },
    ]);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe(SQUARE_CART_PREFLIGHT_FAILED);
      expect(result.message).toBe(SQUARE_CART_PREFLIGHT_CUSTOMER_MESSAGE);
    }
    expect(mockCartLines).not.toHaveBeenCalled();
  });

  it("fails multi-vendor cart when one Square vendor fails preflight", async () => {
    mockVendorFindMany.mockResolvedValue([
      { id: "v_iron", orderRoutingMode: "square" },
      { id: "v_poke", orderRoutingMode: "square" },
    ]);
    mockReadiness.mockImplementation(async (vendorId: string) => ({
      prerequisitesReady: true,
      locationId: vendorId === "v_poke" ? "LOC_NEW" : "LOC_IRON",
      prerequisiteBlockers: [],
      mappingCoverage: {
        missingItemIds: [],
        missingRequiredModifierOptionIds: [],
        alternateLocationIds: [],
      },
    }));
    mockConnection.mockImplementation(async (vendorId: string) => ({
      id: `conn_${vendorId}`,
      externalLocationId: vendorId === "v_poke" ? "LOC_NEW" : "LOC_IRON",
      externalMerchantId: vendorId === "v_poke" ? "M_POKE" : "M_IRON",
    }));
    mockCartLines.mockImplementation(async (input: { vendorId: string }) => {
      if (input.vendorId === "v_poke") {
        return {
          ok: false,
          selectedLocationId: "LOC_NEW",
          missingMenuItemIds: ["mi_poke"],
          missingModifierOptionIds: [],
          alternateLocationIds: ["LOC_OLD"],
          blockers: [
            {
              code: "MAPPING_AT_DIFFERENT_LOCATION",
              entityType: "menu_item",
              internalId: "mi_poke",
              selectedLocationId: "LOC_NEW",
              message: "mapped elsewhere",
            },
          ],
        };
      }
      return {
        ok: true,
        selectedLocationId: "LOC_IRON",
        missingMenuItemIds: [],
        missingModifierOptionIds: [],
        alternateLocationIds: [],
        blockers: [],
      };
    });

    const result = await validateSquareCartPreflight([
      {
        id: "ci_iron",
        menuItemId: "mi_iron",
        vendorId: "v_iron",
        menuItem: { name: "Kebab", isAvailable: true, deliverectProductId: "sq:prod:iron" },
      },
      {
        id: "ci_poke",
        menuItemId: "mi_poke",
        vendorId: "v_poke",
        menuItem: { name: "Poke", isAvailable: true, deliverectProductId: "sq:prod:poke" },
      },
    ]);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.code).toBe(SQUARE_CART_PREFLIGHT_FAILED);
      expect(result.vendorId).toBe("v_poke");
    }
  });

  it("fails when selected modifier lacks mapping", async () => {
    mockVendorFindMany.mockResolvedValue([{ id: "v_sq", orderRoutingMode: "square" }]);
    mockReadiness.mockResolvedValue({
      prerequisitesReady: true,
      locationId: "LOC_1",
      prerequisiteBlockers: [],
      mappingCoverage: {
        missingItemIds: [],
        missingRequiredModifierOptionIds: [],
        alternateLocationIds: [],
      },
    });
    mockConnection.mockResolvedValue({
      id: "conn_1",
      externalLocationId: "LOC_1",
      externalMerchantId: "M1",
    });
    mockModifierFindMany.mockResolvedValue([
      { id: "mo_1", name: "Tuna", deliverectModifierId: "sq:modopt:tuna" },
    ]);
    mockCartLines.mockResolvedValue({
      ok: false,
      selectedLocationId: "LOC_1",
      missingMenuItemIds: [],
      missingModifierOptionIds: ["mo_1"],
      alternateLocationIds: [],
      blockers: [
        {
          code: "MISSING_REQUIRED_MODIFIER_OPTION",
          entityType: "modifier_option",
          internalId: "mo_1",
          selectedLocationId: "LOC_1",
          message: "mod missing",
        },
      ],
    });

    const result = await validateSquareCartPreflight([
      {
        id: "ci_1",
        menuItemId: "mi_1",
        vendorId: "v_sq",
        menuItem: { name: "Bowl", isAvailable: true, deliverectProductId: "sq:prod:1" },
        selections: [{ modifierOptionId: "mo_1" }],
      },
    ]);

    expect(result.valid).toBe(false);
  });
});
