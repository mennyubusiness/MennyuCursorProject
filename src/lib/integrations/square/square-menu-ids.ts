/** Stable Open Order ids for Square catalog entities (stored in canonical `deliverectId` fields). */
export const SQUARE_CATEGORY_ID_PREFIX = "sq:cat:";
export const SQUARE_PRODUCT_ID_PREFIX = "sq:prod:";
export const SQUARE_MODIFIER_GROUP_ID_PREFIX = "sq:modgrp:";
export const SQUARE_MODIFIER_OPTION_ID_PREFIX = "sq:modopt:";

export function squareCategoryInternalId(squareCategoryId: string): string {
  return `${SQUARE_CATEGORY_ID_PREFIX}${squareCategoryId}`;
}

export function squareProductInternalId(squareVariationId: string): string {
  return `${SQUARE_PRODUCT_ID_PREFIX}${squareVariationId}`;
}

export function squareModifierGroupInternalId(squareModifierListId: string): string {
  return `${SQUARE_MODIFIER_GROUP_ID_PREFIX}${squareModifierListId}`;
}

export function squareModifierOptionInternalId(squareModifierId: string): string {
  return `${SQUARE_MODIFIER_OPTION_ID_PREFIX}${squareModifierId}`;
}

export function isSquareCategoryDeliverectId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(SQUARE_CATEGORY_ID_PREFIX));
}

export function isSquareProductDeliverectId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(SQUARE_PRODUCT_ID_PREFIX));
}

export function isSquareModifierGroupDeliverectId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(SQUARE_MODIFIER_GROUP_ID_PREFIX));
}

export function isSquareModifierOptionDeliverectId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(SQUARE_MODIFIER_OPTION_ID_PREFIX));
}

export function isSquareMenuEntityDeliverectId(id: string | null | undefined): boolean {
  return (
    isSquareCategoryDeliverectId(id) ||
    isSquareProductDeliverectId(id) ||
    isSquareModifierGroupDeliverectId(id) ||
    isSquareModifierOptionDeliverectId(id)
  );
}

export function parseSquareExternalId(internalId: string): string | null {
  for (const prefix of [
    SQUARE_PRODUCT_ID_PREFIX,
    SQUARE_CATEGORY_ID_PREFIX,
    SQUARE_MODIFIER_GROUP_ID_PREFIX,
    SQUARE_MODIFIER_OPTION_ID_PREFIX,
  ]) {
    if (internalId.startsWith(prefix)) {
      const rest = internalId.slice(prefix.length);
      return rest.length > 0 ? rest : null;
    }
  }
  return null;
}
