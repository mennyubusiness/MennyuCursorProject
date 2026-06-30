import {
  isOpenOrderCategoryDeliverectId,
  isOpenOrderProductDeliverectId,
  parseOpenOrderCategoryId,
} from "@/lib/open-order-menu-ids";
import {
  validateOpenOrderModifierGroupRow,
  type OpenOrderModifierGroupValidationRow,
} from "@/lib/open-order-modifier-validation";

export type OpenOrderMenuCategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  isVisible: boolean;
};

export type OpenOrderMenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  isAvailable: boolean;
  sortOrder: number;
  deliverectCategoryId: string | null;
  deliverectProductId: string | null;
  updatedAt: Date;
  imageUrl?: string | null;
  modifierGroups?: OpenOrderModifierGroupValidationRow[];
};

export type OpenOrderMenuValidationIssue = {
  code: string;
  message: string;
};

export type OpenOrderMenuValidationResult = {
  ready: boolean;
  issues: OpenOrderMenuValidationIssue[];
  visibleCategoryCount: number;
  visibleItemCount: number;
  availableItemCount: number;
};

function isValidItemName(name: string): boolean {
  return name.trim().length > 0;
}

function isValidPriceCents(priceCents: number): boolean {
  return Number.isInteger(priceCents) && priceCents >= 0;
}

/**
 * Validates Open Order Menu Builder state for publish/readiness.
 * Only considers builder-owned rows (oo:cat / oo:prod ids).
 */
export function validateOpenOrderMenuBuilderState(input: {
  categories: OpenOrderMenuCategoryRow[];
  items: OpenOrderMenuItemRow[];
}): OpenOrderMenuValidationResult {
  const issues: OpenOrderMenuValidationIssue[] = [];
  const visibleCategories = input.categories.filter((c) => c.isVisible && c.name.trim());
  const categoryIdSet = new Set(input.categories.map((c) => c.id));
  const visibleCategoryDeliverectIds = new Set(
    visibleCategories.map((c) => `oo:cat:${c.id}`)
  );

  const builderItems = input.items.filter((item) =>
    isOpenOrderProductDeliverectId(item.deliverectProductId)
  );

  const visibleItems = builderItems.filter((item) => {
    if (!item.deliverectCategoryId || !isOpenOrderCategoryDeliverectId(item.deliverectCategoryId)) {
      return false;
    }
    const catId = parseOpenOrderCategoryId(item.deliverectCategoryId);
    if (!catId || !categoryIdSet.has(catId)) return false;
    const cat = input.categories.find((c) => c.id === catId);
    return Boolean(cat?.isVisible);
  });

  if (visibleCategories.length === 0) {
    issues.push({
      code: "NO_VISIBLE_CATEGORY",
      message: "Add at least one visible category.",
    });
  }

  if (visibleItems.length === 0) {
    issues.push({
      code: "NO_VISIBLE_ITEM",
      message: "Add at least one menu item.",
    });
  }

  for (const cat of visibleCategories) {
    const catItems = visibleItems.filter((item) => {
      const catId = item.deliverectCategoryId
        ? parseOpenOrderCategoryId(item.deliverectCategoryId)
        : null;
      return catId === cat.id;
    });
    if (catItems.length === 0) {
      issues.push({
        code: "EMPTY_VISIBLE_CATEGORY",
        message: `"${cat.name}" category has no visible items.`,
      });
    }
  }

  for (const cat of input.categories) {
    if (!cat.isVisible) continue;
    if (!cat.name.trim()) {
      issues.push({
        code: "INVALID_CATEGORY_NAME",
        message: "Every visible category needs a name.",
      });
      break;
    }
  }

  for (const item of builderItems) {
    const inVisibleCategory =
      item.deliverectCategoryId != null &&
      visibleCategoryDeliverectIds.has(item.deliverectCategoryId);

    if (!inVisibleCategory) continue;

    if (!isValidItemName(item.name)) {
      issues.push({
        code: "INVALID_ITEM_NAME",
        message: `Item "${item.name || "Untitled"}" needs a name.`,
      });
    }
    if (!isValidPriceCents(item.priceCents)) {
      issues.push({
        code: "INVALID_ITEM_PRICE",
        message: `"${item.name}" is missing a valid price.`,
      });
    }

    for (const group of item.modifierGroups ?? []) {
      const groupIssue = validateOpenOrderModifierGroupRow(group, { itemName: item.name });
      if (groupIssue) {
        issues.push({
          code: "INVALID_MODIFIER_GROUP",
          message: groupIssue,
        });
      }
    }

    if (
      item.deliverectCategoryId == null ||
      !isOpenOrderCategoryDeliverectId(item.deliverectCategoryId)
    ) {
      issues.push({
        code: "ITEM_MISSING_CATEGORY",
        message: `Item "${item.name}" must be assigned to a category.`,
      });
    } else {
      const catId = parseOpenOrderCategoryId(item.deliverectCategoryId);
      if (!catId || !categoryIdSet.has(catId)) {
        issues.push({
          code: "ITEM_INVALID_CATEGORY",
          message: `Item "${item.name}" is assigned to a missing category.`,
        });
      }
    }
  }

  const availableItemCount = visibleItems.filter((item) => item.isAvailable).length;

  return {
    ready: issues.length === 0,
    issues,
    visibleCategoryCount: visibleCategories.length,
    visibleItemCount: visibleItems.length,
    availableItemCount,
  };
}
