import { z } from "zod";

/** Integer cents, >= 0 */
export const canonicalMoneyCentsSchema = z.number().int().min(0);

export const deliverectMenuImportMetaSchema = z.object({
  channelLinkId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
  menuId: z.string().min(1).optional(),
  sourcePayloadKind: z.enum(["deliverect_menu_api_v1", "deliverect_menu_webhook_v1"]),
});

export const mennyuCanonicalModifierOptionSchema = z.object({
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

export const mennyuCanonicalModifierGroupSchema = z.object({
  deliverectId: z.string().min(1),
  name: z.string().min(1),
  minSelections: z.number().int().min(0),
  maxSelections: z.number().int().min(0),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  parentDeliverectOptionId: z.string().min(1).nullable(),
  options: z.array(mennyuCanonicalModifierOptionSchema),
});

export const mennyuCanonicalCategorySchema = z.object({
  deliverectId: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int(),
  productDeliverectIds: z.array(z.string().min(1)),
});

export const mennyuCanonicalProductSchema = z.object({
  deliverectId: z.string().min(1),
  /** Deliverect `plu` when present; used for snooze webhooks (distinct from `_id`-first `deliverectId`). */
  plu: z.string().min(1).nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  priceCents: canonicalMoneyCentsSchema,
  isAvailable: z.boolean(),
  sortOrder: z.number().int(),
  /** Normalizer may coerce invalid/empty strings to null; strict URL checks belong in validation warnings. */
  imageUrl: z.string().nullable().optional(),
  basketMaxQuantity: z.number().int().positive().nullable().optional(),
  modifierGroupDeliverectIds: z.array(z.string().min(1)),
});

export const mennyuCanonicalMenuSchema = z
  .object({
    schemaVersion: z.literal(1),
    vendorId: z.string().min(1),
    deliverect: deliverectMenuImportMetaSchema,
    categories: z.array(mennyuCanonicalCategorySchema),
    modifierGroupDefinitions: z.array(mennyuCanonicalModifierGroupSchema),
    products: z.array(mennyuCanonicalProductSchema),
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
          message: `Modifier group ${g.deliverectId} has minSelections > maxSelections`,
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

export type MennyuCanonicalMenu = z.infer<typeof mennyuCanonicalMenuSchema>;
export type MennyuCanonicalCategory = z.infer<typeof mennyuCanonicalCategorySchema>;
export type MennyuCanonicalProduct = z.infer<typeof mennyuCanonicalProductSchema>;
export type MennyuCanonicalModifierGroup = z.infer<typeof mennyuCanonicalModifierGroupSchema>;
export type MennyuCanonicalModifierOption = z.infer<typeof mennyuCanonicalModifierOptionSchema>;
export type DeliverectMenuImportMeta = z.infer<typeof deliverectMenuImportMetaSchema>;
export type CanonicalMoneyCents = z.infer<typeof canonicalMoneyCentsSchema>;
