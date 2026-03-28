import { describe, expect, it } from "vitest";
import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { analyzeMenuParity, type LiveMenuItemParityRow, type LiveModifierGroupParityRow } from "./menu-parity.service";

function minimalCanonical(overrides: Partial<MennyuCanonicalMenu> = {}): MennyuCanonicalMenu {
  return {
    schemaVersion: 1,
    vendorId: "v1",
    deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    categories: [],
    modifierGroupDefinitions: [],
    products: [
      {
        deliverectId: "prod-a",
        plu: "PLU-A",
        name: "A",
        priceCents: 100,
        isAvailable: true,
        sortOrder: 0,
        modifierGroupDeliverectIds: [],
      },
    ],
    ...overrides,
  };
}

describe("analyzeMenuParity", () => {
  it("passes when one live row matches one snapshot product", () => {
    const canonical = minimalCanonical();
    const items: LiveMenuItemParityRow[] = [
      { deliverectProductId: "prod-a", deliverectPlu: "PLU-A", isAvailable: true },
    ];
    expect(analyzeMenuParity(canonical, items, [])).toEqual([]);
  });

  it("detects duplicate active deliverectProductId", () => {
    const canonical = minimalCanonical();
    const items: LiveMenuItemParityRow[] = [
      { deliverectProductId: "prod-a", deliverectPlu: "PLU-A", isAvailable: true },
      { deliverectProductId: "prod-a", deliverectPlu: "PLU-A", isAvailable: true },
    ];
    const issues = analyzeMenuParity(canonical, items, []);
    expect(issues.some((i) => i.code === "DUPLICATE_ACTIVE_DELIVERECT_PRODUCT_ID")).toBe(true);
  });

  it("detects duplicate active deliverectPlu", () => {
    const canonical = minimalCanonical({
      products: [
        {
          deliverectId: "prod-a",
          plu: "PLU-A",
          name: "A",
          priceCents: 100,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: [],
        },
        {
          deliverectId: "prod-b",
          plu: "PLU-B",
          name: "B",
          priceCents: 200,
          isAvailable: true,
          sortOrder: 1,
          modifierGroupDeliverectIds: [],
        },
      ],
    });
    const items: LiveMenuItemParityRow[] = [
      { deliverectProductId: "prod-a", deliverectPlu: "SAME", isAvailable: true },
      { deliverectProductId: "prod-b", deliverectPlu: "SAME", isAvailable: true },
    ];
    const issues = analyzeMenuParity(canonical, items, []);
    expect(issues.some((i) => i.code === "DUPLICATE_ACTIVE_DELIVERECT_PLU")).toBe(true);
  });

  it("detects snapshot product missing on live", () => {
    const canonical = minimalCanonical();
    const issues = analyzeMenuParity(canonical, [], []);
    expect(issues.some((i) => i.code === "SNAPSHOT_PRODUCT_MISSING_ON_LIVE")).toBe(true);
  });

  it("detects PLU mismatch", () => {
    const canonical = minimalCanonical();
    const items: LiveMenuItemParityRow[] = [
      { deliverectProductId: "prod-a", deliverectPlu: "WRONG", isAvailable: true },
    ];
    const issues = analyzeMenuParity(canonical, items, []);
    expect(issues.some((i) => i.code === "PRODUCT_PLU_MISMATCH")).toBe(true);
  });

  it("detects live active product not in snapshot", () => {
    const canonical = minimalCanonical();
    const items: LiveMenuItemParityRow[] = [
      { deliverectProductId: "prod-a", deliverectPlu: "PLU-A", isAvailable: true },
      { deliverectProductId: "orphan", deliverectPlu: null, isAvailable: true },
    ];
    const issues = analyzeMenuParity(canonical, items, []);
    expect(issues.some((i) => i.code === "LIVE_ACTIVE_PRODUCT_NOT_IN_SNAPSHOT")).toBe(true);
  });

  it("detects missing modifier group on live", () => {
    const canonical = minimalCanonical({
      modifierGroupDefinitions: [
        {
          deliverectId: "grp-1",
          name: "G",
          minSelections: 0,
          maxSelections: 1,
          isRequired: false,
          sortOrder: 0,
          parentDeliverectOptionId: null,
          options: [],
        },
      ],
      products: [
        {
          deliverectId: "prod-a",
          plu: "PLU-A",
          name: "A",
          priceCents: 100,
          isAvailable: true,
          sortOrder: 0,
          modifierGroupDeliverectIds: [],
        },
      ],
    });
    const items: LiveMenuItemParityRow[] = [
      { deliverectProductId: "prod-a", deliverectPlu: "PLU-A", isAvailable: true },
    ];
    const groups: LiveModifierGroupParityRow[] = [];
    const issues = analyzeMenuParity(canonical, items, groups);
    expect(issues.some((i) => i.code === "SNAPSHOT_MODIFIER_GROUP_MISSING_ON_LIVE")).toBe(true);
  });

  it("detects missing modifier option on live", () => {
    const canonical = minimalCanonical({
      modifierGroupDefinitions: [
        {
          deliverectId: "grp-1",
          name: "G",
          minSelections: 0,
          maxSelections: 1,
          isRequired: false,
          sortOrder: 0,
          parentDeliverectOptionId: null,
          options: [
            {
              deliverectId: "opt-1",
              name: "O",
              priceCents: 0,
              sortOrder: 0,
              isDefault: false,
              isAvailable: true,
              nestedGroupDeliverectIds: [],
            },
          ],
        },
      ],
    });
    const items: LiveMenuItemParityRow[] = [
      { deliverectProductId: "prod-a", deliverectPlu: "PLU-A", isAvailable: true },
    ];
    const groups: LiveModifierGroupParityRow[] = [
      {
        deliverectModifierGroupId: "grp-1",
        isAvailable: true,
        options: [],
      },
    ];
    const issues = analyzeMenuParity(canonical, items, groups);
    expect(issues.some((i) => i.code === "SNAPSHOT_MODIFIER_OPTION_MISSING_ON_LIVE")).toBe(true);
  });
});
