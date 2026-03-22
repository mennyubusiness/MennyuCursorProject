/**
 * Example output of normalizeDeliverectMenuToCanonical + validateCanonicalMenu
 * for `deliverect-menu-fragment.sample.json` with vendorId `vendor_sample`.
 * (Simplified — run the pipeline in tests or a script to regenerate.)
 */
import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";

export const exampleCanonicalMenuSample: MennyuCanonicalMenu = {
  schemaVersion: 1,
  vendorId: "vendor_sample",
  deliverect: {
    sourcePayloadKind: "deliverect_menu_api_v1",
    menuId: "sample-menu-001",
  },
  categories: [
    {
      deliverectId: "cat-mains",
      name: "Mains",
      sortOrder: 0,
      productDeliverectIds: ["prod-burger-1"],
    },
  ],
  modifierGroupDefinitions: [
    {
      deliverectId: "mg-size",
      name: "Size",
      minSelections: 1,
      maxSelections: 1,
      isRequired: true,
      sortOrder: 0,
      parentDeliverectOptionId: null,
      options: [
        {
          deliverectId: "opt-regular",
          name: "Regular",
          priceCents: 0,
          sortOrder: 0,
          isDefault: true,
          isAvailable: true,
          nestedGroupDeliverectIds: [],
        },
        {
          deliverectId: "opt-large",
          name: "Large",
          priceCents: 150,
          sortOrder: 1,
          isDefault: false,
          isAvailable: true,
          nestedGroupDeliverectIds: [],
        },
      ],
    },
  ],
  products: [
    {
      deliverectId: "prod-burger-1",
      name: "House Burger",
      description: "Beef patty with lettuce",
      priceCents: 899,
      isAvailable: true,
      sortOrder: 0,
      imageUrl: null,
      basketMaxQuantity: null,
      modifierGroupDeliverectIds: ["mg-size"],
    },
  ],
};
