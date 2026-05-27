import { describe, expect, it } from "vitest";
import { MODIFIER_MAX_SELECTIONS_UNBOUNDED } from "@/domain/modifier-selection-unbounded";
import { classifyOpenOrderModifierGroup } from "@/domain/modifier-group-kind";
import { serializeModifierConfig } from "@/lib/modifier-config";
import { partitionTopLevelVariantSelectionsForDeliverectChain } from "@/lib/deliverect-subitem-nesting";
import { mennyuVendorOrderToDeliverectPayload } from "@/integrations/deliverect/transform";

describe("modifier menu pipeline contract", () => {
  it("optional variant-flagged sauce (White Rice pattern) does not use subItems chain", () => {
    const kind = classifyOpenOrderModifierGroup({
      deliverectIsVariantGroup: true,
      minSelections: 0,
      maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
      required: false,
      isAvailable: true,
      variantChildMenuItemCount: 0,
    });
    expect(kind.kind).toBe("OPTIONAL_VARIANT_OR_MODIFIER_GROUP");
    expect(kind.blocksAddToCartWhenEmpty).toBe(false);

    const sel = {
      modifierOption: {
        modifierGroup: {
          id: "g-sauce",
          sortOrder: 0,
          deliverectIsVariantGroup: true,
          parentModifierOptionId: null,
          minSelections: 0,
          maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
          isRequired: false,
        },
      },
    };
    const { chainSelections, demotedToFlatModifierSelections } =
      partitionTopLevelVariantSelectionsForDeliverectChain({
        selections: [sel],
        variantChildMenuItemCount: 0,
      });
    expect(chainSelections).toHaveLength(0);
    expect(demotedToFlatModifierSelections).toHaveLength(0);
  });

  it("serializeModifierConfig exposes openOrderGroupKind for UI/cart parity", () => {
    const config = serializeModifierConfig(
      {
        id: "mi-1",
        name: "White Rice",
        priceCents: 500,
        modifierGroups: [
          {
            required: false,
            minSelections: 0,
            maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
            sortOrder: 0,
            modifierGroup: {
              id: "g1",
              name: "Choose a sauce",
              minSelections: 0,
              maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
              isRequired: false,
              isAvailable: true,
              deliverectIsVariantGroup: true,
              parentModifierOptionId: null,
              options: [
                {
                  id: "o1",
                  name: "Soy",
                  priceCents: 0,
                  sortOrder: 0,
                  isDefault: false,
                  isAvailable: true,
                  nestedModifierGroups: [],
                },
              ],
            },
          },
        ],
      },
      { variantChildMenuItemCount: 0 }
    );
    expect(config.groups[0]!.openOrderGroupKind).toBe("OPTIONAL_VARIANT_OR_MODIFIER_GROUP");
  });

  it("optional variant selection serializes in flat modifiers on parent shell line", () => {
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: {
        id: "vo-1",
        order: { requestedPickupAt: null },
        lineItems: [
          {
            menuItemId: "mi-rice",
            name: "White Rice",
            quantity: 1,
            priceCents: 600,
            specialInstructions: null,
            menuItem: {
              id: "mi-rice",
              name: "White Rice",
              deliverectProductId: "prod-rice",
              deliverectPlu: "RICE-01",
              deliverectVariantParentPlu: null,
              deliverectVariantParentName: null,
            },
            selections: [
              {
                modifierOptionId: "opt-soy",
                quantity: 1,
                nameSnapshot: "Soy",
                priceCentsSnapshot: 100,
                modifierOption: {
                  deliverectModifierPlu: "SAUCE-SOY",
                  deliverectModifierId: "mod-soy",
                  name: "Soy",
                  modifierGroup: {
                    id: "g-sauce",
                    name: "Choose a sauce",
                    sortOrder: 0,
                    parentModifierOptionId: null,
                    deliverectIsVariantGroup: true,
                    minSelections: 0,
                    maxSelections: MODIFIER_MAX_SELECTIONS_UNBOUNDED,
                    isRequired: false,
                  },
                },
              },
            ],
          },
        ],
      } as never,
      channelLinkId: "ch-1",
      variantChildCountByParentPlu: new Map([["RICE-01", 0]]),
    });
    const item = payload.items[0]!;
    expect(item.subItems).toBeUndefined();
    expect(item.modifiers?.length).toBe(1);
    expect(item.modifiers?.[0]?.plu).toBe("SAUCE-SOY");
  });
});
