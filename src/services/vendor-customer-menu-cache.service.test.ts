import { describe, expect, it } from "vitest";
import {
  applyAvailabilityOverlayToSections,
  customerVendorMenuCacheTag,
  mergeCachedDisplayWithAvailability,
  type CachedCustomerVendorMenuDisplay,
  type CustomerVendorMenuAvailabilityOverlay,
} from "@/services/vendor-customer-menu-cache.service";
import type { CustomerVendorMenuCategorySection } from "@/services/vendor-customer-menu.service";

function sectionWithItem(
  itemId: string,
  available = true,
  modifierOptionId = "opt_1"
): CustomerVendorMenuCategorySection[] {
  return [
    {
      id: "cat_1",
      name: "Mains",
      sortOrder: 0,
      items: [
        {
          id: itemId,
          vendorId: "vendor_1",
          name: "Burger",
          description: null,
          priceCents: 999,
          imageUrl: null,
          sortOrder: 0,
          isAvailable: available,
          deliverectProductId: "prod_1",
          deliverectPlu: "PLU1",
          deliverectVariantParentPlu: null,
          deliverectVariantParentName: null,
          deliverectCategoryId: null,
          basketMaxQuantity: null,
          modifierGroups: [
            {
              menuItemId: itemId,
              modifierGroupId: "mg_1",
              required: false,
              minSelections: 0,
              maxSelections: 1,
              sortOrder: 0,
              modifierGroup: {
                id: "mg_1",
                vendorId: "vendor_1",
                name: "Extras",
                minSelections: 0,
                maxSelections: 1,
                isRequired: false,
                isAvailable: true,
                sortOrder: 0,
                deliverectModifierGroupId: null,
                options: [
                  {
                    id: modifierOptionId,
                    modifierGroupId: "mg_1",
                    name: "Cheese",
                    priceCents: 100,
                    sortOrder: 0,
                    isDefault: false,
                    isAvailable: true,
                    deliverectModifierId: null,
                    nestedModifierGroups: [],
                  },
                ],
              },
            },
          ],
        } as unknown as CustomerVendorMenuCategorySection["items"][number],
      ],
    },
  ];
}

describe("vendor-customer-menu-cache", () => {
  it("customerVendorMenuCacheTag is vendor-scoped", () => {
    expect(customerVendorMenuCacheTag("vendor_abc")).toBe("customer-vendor-menu:vendor_abc");
  });

  it("applyAvailabilityOverlayToSections marks snoozed items unavailable", () => {
    const sections = sectionWithItem("item_1", true);
    const overlay: CustomerVendorMenuAvailabilityOverlay = {
      itemAvailableByMenuItemId: new Map([["item_1", false]]),
      modifierGroupAvailableById: new Map(),
      modifierOptionAvailableById: new Map(),
    };

    const next = applyAvailabilityOverlayToSections(sections, overlay);
    expect(next[0]!.items[0]!.isAvailable).toBe(false);
  });

  it("applyAvailabilityOverlayToSections marks snoozed modifier options", () => {
    const sections = sectionWithItem("item_1", true, "opt_snoozed");
    const overlay: CustomerVendorMenuAvailabilityOverlay = {
      itemAvailableByMenuItemId: new Map([["item_1", true]]),
      modifierGroupAvailableById: new Map(),
      modifierOptionAvailableById: new Map([["opt_snoozed", false]]),
    };

    const next = applyAvailabilityOverlayToSections(sections, overlay);
    const opt = next[0]!.items[0]!.modifierGroups[0]!.modifierGroup.options[0]!;
    expect(opt.isAvailable).toBe(false);
  });

  it("mergeCachedDisplayWithAvailability returns Map variant counts", () => {
    const display: CachedCustomerVendorMenuDisplay = {
      menuVersionId: "mv_1",
      source: "published_canonical",
      sections: [],
      variantChildCountByParentPlu: { PARENT: 2 },
      availabilityPoolByProductId: {},
      modifierGroupIds: [],
      modifierOptionIds: [],
    };
    const result = mergeCachedDisplayWithAvailability(display, {
      itemAvailableByMenuItemId: new Map(),
      modifierGroupAvailableById: new Map(),
      modifierOptionAvailableById: new Map(),
    });
    expect(result.variantChildCountByParentPlu.get("PARENT")).toBe(2);
  });
});
