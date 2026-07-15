import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOperationalIds = vi.fn();
const mockMenuItemFindMany = vi.fn();
const mockMappingFindMany = vi.fn();

vi.mock("@/services/menu-active-scope.service", () => ({
  getOperationalMenuItemIdsForVendor: (...args: unknown[]) => mockOperationalIds(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    menuItem: { findMany: (...args: unknown[]) => mockMenuItemFindMany(...args) },
    providerEntityMapping: { findMany: (...args: unknown[]) => mockMappingFindMany(...args) },
  },
}));

import {
  evaluateSquareCartLinesRoutability,
  evaluateSquareMenuMappingCoverage,
} from "@/lib/integrations/square/square-mapping-coverage.server";

const VENDOR_ID = "vendor_poke";
const LOC_NEW = "LN7RT05NHEW13";
const LOC_OLD = "LNQCZRWXMCFE2";

function productId(ext: string) {
  return `sq:prod:${ext}`;
}
function modId(ext: string) {
  return `sq:modopt:${ext}`;
}

describe("evaluateSquareMenuMappingCoverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is not ready with zero mappings when sellable items exist", async () => {
    mockOperationalIds.mockResolvedValue(new Set(["mi_1"]));
    mockMenuItemFindMany.mockResolvedValue([
      {
        id: "mi_1",
        name: "Bowl",
        deliverectProductId: productId("VAR1"),
        modifierGroups: [],
      },
    ]);
    mockMappingFindMany.mockResolvedValue([]);

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(false);
    expect(cov.totalSellableItems).toBe(1);
    expect(cov.mappedSellableItems).toBe(0);
    expect(cov.blockers.some((b) => b.code === "NEVER_MAPPED")).toBe(true);
  });

  it("is not ready when only one of ten items is mapped", async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `mi_${i}`,
      name: `Item ${i}`,
      deliverectProductId: productId(`V${i}`),
      modifierGroups: [],
    }));
    mockOperationalIds.mockResolvedValue(new Set(items.map((i) => i.id)));
    mockMenuItemFindMany.mockResolvedValue(items);
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("V0"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "V0",
      },
    ]);

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(false);
    expect(cov.mappedSellableItems).toBe(1);
    expect(cov.totalSellableItems).toBe(10);
  });

  it("is ready when all available items are mapped", async () => {
    mockOperationalIds.mockResolvedValue(new Set(["mi_1", "mi_2"]));
    mockMenuItemFindMany.mockResolvedValue([
      { id: "mi_1", name: "A", deliverectProductId: productId("A"), modifierGroups: [] },
      { id: "mi_2", name: "B", deliverectProductId: productId("B"), modifierGroups: [] },
    ]);
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("A"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "A",
      },
      {
        internalEntityId: productId("B"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "B",
      },
    ]);

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(true);
    expect(cov.mappedSellableItems).toBe(2);
  });

  it("ignores unavailable items missing mappings", async () => {
    mockOperationalIds.mockResolvedValue(new Set(["mi_avail"]));
    mockMenuItemFindMany.mockResolvedValue([
      {
        id: "mi_avail",
        name: "Avail",
        deliverectProductId: productId("AV"),
        modifierGroups: [],
      },
    ]);
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("AV"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "AV",
      },
      {
        internalEntityId: productId("UNAV"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_OLD,
        isActive: true,
        externalId: "UNAV",
      },
    ]);

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(true);
  });

  it("Poke Sea: mapped only at old location → MAPPING_AT_DIFFERENT_LOCATION", async () => {
    const pokeItems = Array.from({ length: 9 }, (_, i) => ({
      id: `poke_${i}`,
      name: `Poke ${i}`,
      deliverectProductId: productId(`POKE${i}`),
      modifierGroups: [],
    }));
    mockOperationalIds.mockResolvedValue(new Set(pokeItems.map((i) => i.id)));
    mockMenuItemFindMany.mockResolvedValue(pokeItems);
    mockMappingFindMany.mockResolvedValue(
      pokeItems.map((item) => ({
        internalEntityId: item.deliverectProductId,
        internalEntityType: "menu_item",
        externalLocationId: LOC_OLD,
        isActive: true,
        externalId: item.deliverectProductId.replace("sq:prod:", ""),
      }))
    );

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(false);
    expect(cov.mappingsExistForAnotherLocation).toBe(true);
    expect(cov.alternateLocationIds).toContain(LOC_OLD);
    expect(cov.blockers.every((b) => b.code === "MAPPING_AT_DIFFERENT_LOCATION")).toBe(true);
  });

  it("is not ready when required modifier option mapping is missing", async () => {
    mockOperationalIds.mockResolvedValue(new Set(["mi_1"]));
    mockMenuItemFindMany.mockResolvedValue([
      {
        id: "mi_1",
        name: "Bowl",
        deliverectProductId: productId("VAR1"),
        modifierGroups: [
          {
            required: true,
            minSelections: 1,
            modifierGroup: {
              id: "mg_1",
              name: "Protein",
              isRequired: true,
              minSelections: 1,
              isAvailable: true,
              deliverectModifierGroupId: "sq:modgrp:G1",
              options: [
                {
                  id: "mo_1",
                  name: "Tuna",
                  deliverectModifierId: modId("TUNA"),
                },
              ],
            },
          },
        ],
      },
    ]);
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("VAR1"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "VAR1",
      },
      {
        internalEntityId: "sq:modgrp:G1",
        internalEntityType: "modifier_group",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "G1",
      },
    ]);

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(false);
    expect(cov.missingRequiredModifierOptionIds).toContain("mo_1");
  });

  it("does not require optional unused modifier option mappings", async () => {
    mockOperationalIds.mockResolvedValue(new Set(["mi_1"]));
    mockMenuItemFindMany.mockResolvedValue([
      {
        id: "mi_1",
        name: "Bowl",
        deliverectProductId: productId("VAR1"),
        modifierGroups: [
          {
            required: false,
            minSelections: 0,
            modifierGroup: {
              id: "mg_opt",
              name: "Extras",
              isRequired: false,
              minSelections: 0,
              isAvailable: true,
              deliverectModifierGroupId: "sq:modgrp:OPT",
              options: [
                {
                  id: "mo_opt",
                  name: "Extra sauce",
                  deliverectModifierId: modId("SAUCE"),
                },
              ],
            },
          },
        ],
      },
    ]);
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("VAR1"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "VAR1",
      },
    ]);

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(true);
  });

  it("is not ready when mapping is inactive at selected location", async () => {
    mockOperationalIds.mockResolvedValue(new Set(["mi_1"]));
    mockMenuItemFindMany.mockResolvedValue([
      {
        id: "mi_1",
        name: "Bowl",
        deliverectProductId: productId("VAR1"),
        modifierGroups: [],
      },
    ]);
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("VAR1"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: false,
        externalId: "VAR1",
      },
    ]);

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(false);
    expect(cov.blockers.some((b) => b.code === "MAPPING_INACTIVE")).toBe(true);
  });

  it("does not accept mappings for another vendor (query is vendor-scoped)", async () => {
    mockOperationalIds.mockResolvedValue(new Set(["mi_1"]));
    mockMenuItemFindMany.mockResolvedValue([
      {
        id: "mi_1",
        name: "Bowl",
        deliverectProductId: productId("VAR1"),
        modifierGroups: [],
      },
    ]);
    // findMany is vendor-scoped in implementation; empty = other vendor's mappings not returned
    mockMappingFindMany.mockResolvedValue([]);

    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
    });

    expect(cov.ready).toBe(false);
    expect(mockMappingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ vendorId: VENDOR_ID, provider: "square" }),
      })
    );
  });

  it("is not ready when location is unset", async () => {
    const cov = await evaluateSquareMenuMappingCoverage({
      vendorId: VENDOR_ID,
      selectedLocationId: null,
    });

    expect(cov.ready).toBe(false);
    expect(cov.blockers[0]?.code).toBe("LOCATION_UNSET");
  });
});

describe("evaluateSquareCartLinesRoutability (Poke Sea cart preflight)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when ordered item is mapped at selected location", async () => {
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("POKE0"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "POKE0",
      },
    ]);

    const result = await evaluateSquareCartLinesRoutability({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
      lines: [
        {
          cartItemId: "ci_1",
          menuItemId: "mi_1",
          menuItemName: "Poke 0",
          deliverectProductId: productId("POKE0"),
          isAvailable: true,
        },
      ],
    });

    expect(result.ok).toBe(true);
  });

  it("fails when ordered item is mapped only at old location", async () => {
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("POKE0"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_OLD,
        isActive: true,
        externalId: "POKE0",
      },
    ]);

    const result = await evaluateSquareCartLinesRoutability({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
      lines: [
        {
          cartItemId: "ci_1",
          menuItemId: "mi_1",
          menuItemName: "Poke 0",
          deliverectProductId: productId("POKE0"),
          isAvailable: true,
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.code === "MAPPING_AT_DIFFERENT_LOCATION")).toBe(true);
    expect(result.alternateLocationIds).toContain(LOC_OLD);
  });

  it("fails when item becomes unavailable after cart creation", async () => {
    mockMappingFindMany.mockResolvedValue([
      {
        internalEntityId: productId("POKE0"),
        internalEntityType: "menu_item",
        externalLocationId: LOC_NEW,
        isActive: true,
        externalId: "POKE0",
      },
    ]);

    const result = await evaluateSquareCartLinesRoutability({
      vendorId: VENDOR_ID,
      selectedLocationId: LOC_NEW,
      lines: [
        {
          cartItemId: "ci_1",
          menuItemId: "mi_1",
          menuItemName: "Poke 0",
          deliverectProductId: productId("POKE0"),
          isAvailable: false,
        },
      ],
    });

    expect(result.ok).toBe(false);
  });
});
