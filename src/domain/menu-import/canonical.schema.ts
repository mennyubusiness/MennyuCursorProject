import { z } from "zod";

/** Integer cents, >= 0 */
export const canonicalMoneyCentsSchema = z.number().int().min(0);

/** Source-provider metadata on a canonical menu snapshot (`menu.deliverect` JSON key is legacy). */
export const menuSourceMetaSchema = z.object({
  channelLinkId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  menuId: z.string().min(1).optional(),
  sourcePayloadKind: z.enum([
    "deliverect_menu_api_v1",
    "deliverect_menu_webhook_v1",
    "open_order_builder_v1",
    "square_catalog_v1",
  ]),
});

/** @deprecated Use {@link menuSourceMetaSchema} */
export const deliverectMenuImportMetaSchema = menuSourceMetaSchema;

export const openOrderCanonicalModifierOptionSchema = z.object({
  deliverectId: z.string().min(1),
  /** Deliverect `plu` when present; outbound orders must send this as modifier `plu`, not Mongo `_id`. */
  plu: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  priceCents: canonicalMoneyCentsSchema,
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  isAvailable: z.boolean(),
  nestedGroupDeliverectIds: z.array(z.string().min(1)),
});

export const openOrderModifierGroupKindSchema = z.enum([
  "REQUIRED_VARIANT_GROUP",
  "OPTIONAL_VARIANT_OR_MODIFIER_GROUP",
  "REQUIRED_MODIFIER_GROUP",
  "LIMITED_OPTIONAL_MODIFIER_GROUP",
  "FREE_CHOICE_MODIFIER_GROUP",
]);

export const openOrderCanonicalModifierGroupSchema = z.object({
  deliverectId: z.string().min(1),
  name: z.string().min(1),
  minSelections: z.number().int().min(0),
  maxSelections: z.number().int().min(0),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  parentDeliverectOptionId: z.string().min(1).nullable(),
  /** Deliverect variant group — outbound order uses `subItems`, not `modifiers`, for these options. */
  isVariantGroup: z.boolean().optional(),
  /** Deliverect `multiMax` on the modifier group: max selections per option (same modifier multiple times). */
  multiMax: z.number().int().positive().nullable().optional(),
  options: z.array(openOrderCanonicalModifierOptionSchema),
});

export const openOrderCanonicalCategorySchema = z.object({
  deliverectId: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int(),
  productDeliverectIds: z.array(z.string().min(1)),
});

export const openOrderCanonicalProductSchema = z.object({
  deliverectId: z.string().min(1),
  /** Deliverect `plu` when present; used for snooze webhooks (distinct from `_id`-first `deliverectId`). */
  plu: z.string().min(1).nullable().optional(),
  /**
   * When this product is a variation leaf under a Deliverect `isVariant` parent, parent product PLU/name
   * for channel orders (parent line + variation in `subItems`).
   *
   * Do **not** set for Square flattened ITEM_VARIATION products — those are standalone customer SKUs.
   * Use `sourceParentExternalId` for the Square ITEM id instead.
   */
  deliverectVariantParentPlu: z.string().min(1).nullable().optional(),
  deliverectVariantParentName: z.string().min(1).nullable().optional(),
  /**
   * Provider parent catalog object id when this product is a flattened child SKU
   * (e.g. Square ITEM id for an `sq:prod:{variationId}` product). Not a Deliverect variant leaf.
   */
  sourceParentExternalId: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  priceCents: canonicalMoneyCentsSchema,
  isAvailable: z.boolean(),
  sortOrder: z.number().int(),
  /** Normalizer may coerce invalid/empty strings to null; strict URL checks belong in validation warnings. */
  imageUrl: z.string().nullable().optional(),
  basketMaxQuantity: z.number().int().positive().nullable().optional(),
  modifierGroupDeliverectIds: z.array(z.string().min(1)),
  /** Per-product classification (variant child count is product-specific). */
  modifierGroupKinds: z.record(z.string().min(1), openOrderModifierGroupKindSchema).optional(),
});

export const openOrderCanonicalMenuSchema = z
  .object({
    schemaVersion: z.literal(1),
    vendorId: z.string().min(1),
    deliverect: menuSourceMetaSchema,
    categories: z.array(openOrderCanonicalCategorySchema),
    modifierGroupDefinitions: z.array(openOrderCanonicalModifierGroupSchema),
    products: z.array(openOrderCanonicalProductSchema),
  })
  .superRefine((val, ctx) => {
    const productIds = val.products.map((p) => p.deliverectId);
    const dupProducts = findDuplicates(productIds);
    for (const id of dupProducts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate product deliverectId: ${id}`,
        path: ["products"],
      });
    }

    const groupIds = val.modifierGroupDefinitions.map((g) => g.deliverectId);
    const dupGroups = findDuplicates(groupIds);
    for (const id of dupGroups) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate modifier group deliverectId: ${id}`,
        path: ["modifierGroupDefinitions"],
      });
    }

    const groupIdSet = new Set(groupIds);
    for (let pi = 0; pi < val.products.length; pi++) {
      const p = val.products[pi]!;
      for (const gid of p.modifierGroupDeliverectIds) {
        if (!groupIdSet.has(gid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Product references unknown modifier group: ${gid}`,
            path: ["products", pi, "modifierGroupDeliverectIds"],
          });
        }
      }
    }

    const productIdSet = new Set(productIds);
    for (let ci = 0; ci < val.categories.length; ci++) {
      const c = val.categories[ci]!;
      for (const pid of c.productDeliverectIds) {
        if (!productIdSet.has(pid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Category references unknown product id: ${pid}`,
            path: ["categories", ci, "productDeliverectIds"],
          });
        }
      }
    }

    for (let gi = 0; gi < val.modifierGroupDefinitions.length; gi++) {
      const g = val.modifierGroupDefinitions[gi]!;
      if (g.minSelections > g.maxSelections) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `modifier group ${g.deliverectId} has minSelections > maxSelections`,
          path: ["modifierGroupDefinitions", gi],
        });
      }
      const optIds = g.options.map((o) => o.deliverectId);
      const dupOpt = findDuplicates(optIds);
      for (const id of dupOpt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate option deliverectId in group ${g.deliverectId}: ${id}`,
          path: ["modifierGroupDefinitions", gi],
        });
      }
      for (const o of g.options) {
        for (const nid of o.nestedGroupDeliverectIds) {
          if (!groupIdSet.has(nid)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Option references unknown nested modifier group: ${nid}`,
              path: ["modifierGroupDefinitions", gi],
            });
          }
        }
      }
    }
  });

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    seen.add(id);
  }
  return [...dups];
}

export type OpenOrderCanonicalMenu = z.infer<typeof openOrderCanonicalMenuSchema>;
export type OpenOrderCanonicalCategory = z.infer<typeof openOrderCanonicalCategorySchema>;
export type OpenOrderCanonicalProduct = z.infer<typeof openOrderCanonicalProductSchema>;
export type OpenOrderCanonicalModifierGroup = z.infer<typeof openOrderCanonicalModifierGroupSchema>;
export type OpenOrderCanonicalModifierOption = z.infer<typeof openOrderCanonicalModifierOptionSchema>;
export type MenuSourceMeta = z.infer<typeof menuSourceMetaSchema>;
export type CanonicalMoneyCents = z.infer<typeof canonicalMoneyCentsSchema>;

/** @deprecated Use {@link openOrderCanonicalMenuSchema} */
export const mennyuCanonicalMenuSchema = openOrderCanonicalMenuSchema;
/** @deprecated Use {@link openOrderCanonicalCategorySchema} */
export const mennyuCanonicalCategorySchema = openOrderCanonicalCategorySchema;
/** @deprecated Use {@link openOrderCanonicalProductSchema} */
export const mennyuCanonicalProductSchema = openOrderCanonicalProductSchema;
/** @deprecated Use {@link openOrderCanonicalModifierGroupSchema} */
export const mennyuCanonicalModifierGroupSchema = openOrderCanonicalModifierGroupSchema;
/** @deprecated Use {@link openOrderCanonicalModifierOptionSchema} */
export const mennyuCanonicalModifierOptionSchema = openOrderCanonicalModifierOptionSchema;

/** @deprecated Use {@link OpenOrderCanonicalMenu} */
export type MennyuCanonicalMenu = OpenOrderCanonicalMenu;
/** @deprecated Use {@link OpenOrderCanonicalCategory} */
export type MennyuCanonicalCategory = OpenOrderCanonicalCategory;
/** @deprecated Use {@link OpenOrderCanonicalProduct} */
export type MennyuCanonicalProduct = OpenOrderCanonicalProduct;
/** @deprecated Use {@link OpenOrderCanonicalModifierGroup} */
export type MennyuCanonicalModifierGroup = OpenOrderCanonicalModifierGroup;
/** @deprecated Use {@link OpenOrderCanonicalModifierOption} */
export type MennyuCanonicalModifierOption = OpenOrderCanonicalModifierOption;
/** @deprecated Use {@link MenuSourceMeta} */
export type DeliverectMenuImportMeta = MenuSourceMeta;
