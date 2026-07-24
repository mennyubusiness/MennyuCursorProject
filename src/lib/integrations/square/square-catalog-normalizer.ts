import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import type { SquareCatalogObject } from "@/lib/integrations/square/square-catalog.types";
import {
  squareCategoryInternalId,
  squareModifierGroupInternalId,
  squareModifierOptionInternalId,
  squareProductInternalId,
} from "@/lib/integrations/square/square-menu-ids";

export type SquareCatalogImportWarning = {
  code: string;
  message: string;
  squareObjectId?: string;
};

export type SquareCatalogSkippedObject = {
  squareObjectId: string;
  type: string;
  reason: string;
};

export type SquareCatalogNormalizationResult = {
  menu: MennyuCanonicalMenu | null;
  warnings: SquareCatalogImportWarning[];
  skipped: SquareCatalogSkippedObject[];
  stats: {
    categories: number;
    items: number;
    modifierGroups: number;
    modifierOptions: number;
  };
  importStrategy: string;
};

function moneyToCents(money?: { amount?: number } | null): number | null {
  if (money?.amount == null || !Number.isFinite(money.amount)) return null;
  return Math.max(0, Math.round(money.amount));
}

function variationPriceCents(
  variation: SquareCatalogObject,
  locationId: string
): number | null {
  const data = variation.item_variation_data;
  const override = data?.location_overrides?.find((o) => o.location_id === locationId);
  if (override?.sold_out) return null;
  return moneyToCents(override?.price_money ?? data?.price_money);
}

function indexCatalogObjects(objects: SquareCatalogObject[]) {
  const byId = new Map<string, SquareCatalogObject>();
  for (const obj of objects) {
    if (obj.id) byId.set(obj.id, obj);
  }
  return byId;
}

/**
 * Square → MennyuCanonicalMenu
 *
 * Multi-variation MVP: one OO product per ITEM_VARIATION.
 * Modifier MVP: MODIFIER_LIST → group, MODIFIER → option.
 */
export function normalizeSquareCatalogToCanonical(input: {
  vendorId: string;
  locationId: string;
  objects: SquareCatalogObject[];
}): SquareCatalogNormalizationResult {
  const warnings: SquareCatalogImportWarning[] = [];
  const skipped: SquareCatalogSkippedObject[] = [];
  const byId = indexCatalogObjects(input.objects);

  const categories = input.objects.filter((o) => o.type === "CATEGORY" && !o.is_deleted);
  const items = input.objects.filter((o) => o.type === "ITEM" && !o.is_deleted);
  const variations = input.objects.filter((o) => o.type === "ITEM_VARIATION" && !o.is_deleted);
  const modifierLists = input.objects.filter((o) => o.type === "MODIFIER_LIST" && !o.is_deleted);
  const modifiers = input.objects.filter((o) => o.type === "MODIFIER" && !o.is_deleted);
  const images = input.objects.filter((o) => o.type === "IMAGE" && !o.is_deleted);

  const imageUrlById = new Map<string, string>();
  for (const img of images) {
    const url = img.image_data?.url?.trim();
    if (img.id && url) imageUrlById.set(img.id, url);
  }

  const canonicalGroups: MennyuCanonicalMenu["modifierGroupDefinitions"] = [];
  const groupSort = new Map<string, number>();

  for (let gi = 0; gi < modifierLists.length; gi++) {
    const list = modifierLists[gi]!;
    const listId = list.id;
    const listData = list.modifier_list_data;
    const optionRefs = listData?.modifiers ?? [];
    const options: MennyuCanonicalMenu["modifierGroupDefinitions"][number]["options"] = [];

    for (let oi = 0; oi < optionRefs.length; oi++) {
      const ref = optionRefs[oi]!;
      const mod = ref.id ? byId.get(ref.id) : undefined;
      if (!mod || mod.type !== "MODIFIER" || mod.is_deleted) {
        skipped.push({
          squareObjectId: ref.id ?? "unknown",
          type: "MODIFIER",
          reason: "Modifier reference missing or deleted",
        });
        continue;
      }
      const price = moneyToCents(mod.modifier_data?.price_money);
      if (price == null) {
        warnings.push({
          code: "modifier_missing_price",
          message: `Modifier "${mod.modifier_data?.name ?? mod.id}" has no price; defaulting to 0.`,
          squareObjectId: mod.id,
        });
      }
      options.push({
        deliverectId: squareModifierOptionInternalId(mod.id),
        name: mod.modifier_data?.name?.trim() || "Modifier",
        priceCents: price ?? 0,
        sortOrder: oi,
        isDefault: false,
        isAvailable: true,
        nestedGroupDeliverectIds: [],
      });
    }

    if (options.length === 0) {
      skipped.push({
        squareObjectId: listId,
        type: "MODIFIER_LIST",
        reason: "Modifier list has no active modifiers",
      });
      continue;
    }

    const selectionType = (listData?.selection_type ?? "").toUpperCase();
    const isSingle = selectionType === "SINGLE";
    const minSelections = isSingle ? 1 : 0;
    const maxSelections = isSingle ? 1 : options.length;
    if (!isSingle && selectionType && selectionType !== "MULTIPLE") {
      warnings.push({
        code: "modifier_rules_partial",
        message: `Modifier list "${listData?.name ?? listId}" has unclear selection rules; treated as optional.`,
        squareObjectId: listId,
      });
    }

    const internalId = squareModifierGroupInternalId(listId);
    groupSort.set(internalId, gi);
    canonicalGroups.push({
      deliverectId: internalId,
      name: listData?.name?.trim() || "Modifiers",
      minSelections,
      maxSelections,
      isRequired: minSelections > 0,
      sortOrder: gi,
      parentDeliverectOptionId: null,
      options,
    });
  }

  const variationsByItemId = new Map<string, SquareCatalogObject[]>();
  for (const variation of variations) {
    const itemId = variation.item_variation_data?.item_id;
    if (!itemId) {
      skipped.push({
        squareObjectId: variation.id,
        type: "ITEM_VARIATION",
        reason: "Variation missing parent item_id",
      });
      continue;
    }
    const list = variationsByItemId.get(itemId) ?? [];
    list.push(variation);
    variationsByItemId.set(itemId, list);
  }

  const canonicalProducts: MennyuCanonicalMenu["products"] = [];
  const productCategoryMap = new Map<string, string[]>();

  for (const item of items) {
    const itemId = item.id;
    const itemData = item.item_data;
    const itemVariations = variationsByItemId.get(itemId) ?? [];
    const activeVariations = itemVariations.filter((v) => {
      const cents = variationPriceCents(v, input.locationId);
      if (cents == null) {
        skipped.push({
          squareObjectId: v.id,
          type: "ITEM_VARIATION",
          reason: "Variation has no price or is sold out at location",
        });
        return false;
      }
      return true;
    });

    if (activeVariations.length === 0) {
      skipped.push({
        squareObjectId: itemId,
        type: "ITEM",
        reason: "Item has no active priced variations at selected location",
      });
      continue;
    }

    const categoryIds =
      itemData?.categories?.map((c) => c.id).filter((id): id is string => Boolean(id)) ?? [];
    const modifierGroupIds = (itemData?.modifier_list_info ?? [])
      .filter((info) => info.enabled !== false && info.modifier_list_id)
      .map((info) => squareModifierGroupInternalId(info.modifier_list_id!));

    const imageId = itemData?.image_ids?.[0];
    const imageUrl = imageId ? imageUrlById.get(imageId) ?? null : null;
    if (imageId && !imageUrl) {
      warnings.push({
        code: "image_ignored",
        message: `Image ${imageId} not found for item ${itemData?.name ?? itemId}`,
        squareObjectId: itemId,
      });
    }

    const multiVariation = activeVariations.length > 1;
    if (multiVariation) {
      warnings.push({
        code: "item_flattened_variations",
        message: `Item "${itemData?.name ?? itemId}" has ${activeVariations.length} variations; imported as separate menu items.`,
        squareObjectId: itemId,
      });
    }

    for (let vi = 0; vi < activeVariations.length; vi++) {
      const variation = activeVariations[vi]!;
      const priceCents = variationPriceCents(variation, input.locationId)!;
      const baseName = itemData?.name?.trim() || "Item";
      const variationName = variation.item_variation_data?.name?.trim();
      const displayName =
        multiVariation && variationName ? `${baseName} — ${variationName}` : baseName;
      const internalProductId = squareProductInternalId(variation.id);

      // Standalone customer SKUs (one per ITEM_VARIATION). Do not set
      // deliverectVariantParentPlu — that field marks Deliverect variant leaves and the
      // customer storefront excludes them from browse. Parent Square ITEM id is retained
      // on sourceParentExternalId for mapping / diagnostics; variation id is in deliverectId.
      canonicalProducts.push({
        deliverectId: internalProductId,
        name: displayName,
        description: itemData?.description?.trim() || null,
        priceCents,
        isAvailable: true,
        sortOrder: canonicalProducts.length,
        imageUrl,
        basketMaxQuantity: null,
        modifierGroupDeliverectIds: modifierGroupIds.filter((gid) => groupSort.has(gid)),
        deliverectVariantParentPlu: null,
        deliverectVariantParentName: null,
        sourceParentExternalId: itemId,
      });

      for (const catId of categoryIds) {
        const internalCat = squareCategoryInternalId(catId);
        const existing = productCategoryMap.get(internalCat) ?? [];
        existing.push(internalProductId);
        productCategoryMap.set(internalCat, existing);
      }
    }
  }

  const canonicalCategories: MennyuCanonicalMenu["categories"] = [];
  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci]!;
    const internalCatId = squareCategoryInternalId(cat.id);
    const productIds = productCategoryMap.get(internalCatId) ?? [];
    if (productIds.length === 0) {
      skipped.push({
        squareObjectId: cat.id,
        type: "CATEGORY",
        reason: "Category has no importable items at selected location",
      });
      continue;
    }
    canonicalCategories.push({
      deliverectId: internalCatId,
      name: cat.category_data?.name?.trim() || "Category",
      sortOrder: ci,
      productDeliverectIds: productIds,
    });
  }

  const uncategorizedProducts = canonicalProducts
    .filter(
      (p) =>
        !canonicalCategories.some((c) => c.productDeliverectIds.includes(p.deliverectId))
    )
    .map((p) => p.deliverectId);

  if (uncategorizedProducts.length > 0) {
    canonicalCategories.unshift({
      deliverectId: squareCategoryInternalId("uncategorized"),
      name: "Uncategorized",
      sortOrder: 0,
      productDeliverectIds: uncategorizedProducts,
    });
    warnings.push({
      code: "uncategorized_items",
      message: `${uncategorizedProducts.length} item(s) had no Square category; placed in Uncategorized.`,
    });
  }

  if (canonicalProducts.length === 0) {
    return {
      menu: null,
      warnings,
      skipped,
      stats: {
        categories: 0,
        items: 0,
        modifierGroups: canonicalGroups.length,
        modifierOptions: canonicalGroups.reduce((n, g) => n + g.options.length, 0),
      },
      importStrategy:
        "One Open Order menu item per Square item variation; modifier lists mapped to modifier groups.",
    };
  }

  const menu: MennyuCanonicalMenu = {
    schemaVersion: 1,
    vendorId: input.vendorId,
    deliverect: {
      locationId: input.locationId,
      sourcePayloadKind: "square_catalog_v1",
    },
    categories: canonicalCategories,
    modifierGroupDefinitions: canonicalGroups,
    products: canonicalProducts,
  };

  return {
    menu,
    warnings,
    skipped,
    stats: {
      categories: canonicalCategories.length,
      items: canonicalProducts.length,
      modifierGroups: canonicalGroups.length,
      modifierOptions: canonicalGroups.reduce((n, g) => n + g.options.length, 0),
    },
    importStrategy:
      "One Open Order menu item per Square item variation; modifier lists mapped to modifier groups.",
  };
}
