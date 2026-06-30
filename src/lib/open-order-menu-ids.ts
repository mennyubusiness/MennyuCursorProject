export const OPEN_ORDER_CATEGORY_ID_PREFIX = "oo:cat:";
export const OPEN_ORDER_PRODUCT_ID_PREFIX = "oo:prod:";

export function openOrderCategoryDeliverectId(categoryId: string): string {
  return `${OPEN_ORDER_CATEGORY_ID_PREFIX}${categoryId}`;
}

export function openOrderProductDeliverectId(menuItemId: string): string {
  return `${OPEN_ORDER_PRODUCT_ID_PREFIX}${menuItemId}`;
}

export function isOpenOrderCategoryDeliverectId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(OPEN_ORDER_CATEGORY_ID_PREFIX));
}

export function isOpenOrderProductDeliverectId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith(OPEN_ORDER_PRODUCT_ID_PREFIX));
}

export function parseOpenOrderCategoryId(deliverectCategoryId: string): string | null {
  if (!isOpenOrderCategoryDeliverectId(deliverectCategoryId)) return null;
  const rest = deliverectCategoryId.slice(OPEN_ORDER_CATEGORY_ID_PREFIX.length);
  return rest.length > 0 ? rest : null;
}

export function parseOpenOrderProductId(deliverectProductId: string): string | null {
  if (!isOpenOrderProductDeliverectId(deliverectProductId)) return null;
  const rest = deliverectProductId.slice(OPEN_ORDER_PRODUCT_ID_PREFIX.length);
  return rest.length > 0 ? rest : null;
}
