/**
 * Integration-neutral accessors over the legacy Deliverect-named menu identity fields.
 *
 * Phase 2: generic publish / browse / cart / checkout code should use these helpers
 * instead of reading `deliverectId` / `deliverectProductId` / leaf PLU fields directly.
 * Snapshot JSON and Prisma columns are unchanged.
 */
import type {
  OpenOrderCanonicalMenu,
  OpenOrderCanonicalProduct,
  MenuSourceMeta,
} from "@/domain/menu-import/canonical.schema";
import { menuSourceProvider, type MenuSourceProvider } from "@/domain/menu-import/menu-source-provider";

export type { MenuSourceMeta };

export function menuSourceMeta(menu: Pick<OpenOrderCanonicalMenu, "deliverect">): MenuSourceMeta {
  return menu.deliverect;
}

/** Stable catalog entity id for a canonical product (legacy field: `deliverectId`). */
export function productExternalId(product: Pick<OpenOrderCanonicalProduct, "deliverectId">): string {
  return product.deliverectId;
}

/** Provider parent catalog id when this product is a flattened child SKU (e.g. Square ITEM). */
export function productSourceParentExternalId(
  product: Pick<OpenOrderCanonicalProduct, "sourceParentExternalId">
): string | null {
  const v = product.sourceParentExternalId?.trim();
  return v ? v : null;
}

/**
 * True when this product is a non-browsable variation leaf under a sellable parent shell.
 * Today encoded as non-null `deliverectVariantParentPlu` (Deliverect leaf semantics).
 * Square flattened variations must leave that field null and use `sourceParentExternalId` instead.
 */
export function isVariantLeafProduct(
  product: Pick<OpenOrderCanonicalProduct, "deliverectVariantParentPlu">
): boolean {
  return Boolean(product.deliverectVariantParentPlu?.trim());
}

export function variantParentPlu(
  product: Pick<OpenOrderCanonicalProduct, "deliverectVariantParentPlu">
): string | null {
  const v = product.deliverectVariantParentPlu?.trim();
  return v ? v : null;
}

export function variantParentName(
  product: Pick<OpenOrderCanonicalProduct, "deliverectVariantParentName">
): string | null {
  const v = product.deliverectVariantParentName?.trim();
  return v ? v : null;
}

export function resolveMenuSourceProvider(menu: Pick<OpenOrderCanonicalMenu, "deliverect">): MenuSourceProvider {
  return menuSourceProvider(menu.deliverect.sourcePayloadKind);
}

/** Live MenuItem / cart row: stable catalog entity key (legacy column `deliverectProductId`). */
export function menuItemSourceEntityId(item: {
  deliverectProductId?: string | null;
}): string | null {
  const v = item.deliverectProductId?.trim();
  return v ? v : null;
}

/** Live MenuItem category entity key (legacy column `deliverectCategoryId`). */
export function menuItemSourceCategoryId(item: {
  deliverectCategoryId?: string | null;
}): string | null {
  const v = item.deliverectCategoryId?.trim();
  return v ? v : null;
}

/** Live MenuItem / cart: Deliverect-style variation leaf? */
export function isVariantLeafMenuItem(item: {
  deliverectVariantParentPlu?: string | null;
}): boolean {
  return Boolean(item.deliverectVariantParentPlu?.trim());
}

export function variantParentPluFromItem(item: {
  deliverectVariantParentPlu?: string | null;
}): string | null {
  const v = item.deliverectVariantParentPlu?.trim();
  return v ? v : null;
}

export function variantParentNameFromItem(item: {
  deliverectVariantParentName?: string | null;
}): string | null {
  const v = item.deliverectVariantParentName?.trim();
  return v ? v : null;
}

/** Modifier group stable id (legacy `deliverectModifierGroupId`). */
export function modifierGroupSourceEntityId(group: {
  deliverectModifierGroupId?: string | null;
}): string | null {
  const v = group.deliverectModifierGroupId?.trim();
  return v ? v : null;
}

/** Modifier option stable id (legacy `deliverectModifierId`). */
export function modifierOptionSourceEntityId(option: {
  deliverectModifierId?: string | null;
}): string | null {
  const v = option.deliverectModifierId?.trim();
  return v ? v : null;
}

/**
 * MenuImportJob location dual-read.
 * Prefer `sourceLocationId`; fall back to legacy `deliverectLocationId` for pre-Phase-2 rows.
 */
export function jobSourceLocationId(job: {
  sourceLocationId?: string | null;
  deliverectLocationId?: string | null;
}): { locationId: string | null; usedLegacyFallback: boolean } {
  const preferred = job.sourceLocationId?.trim() || null;
  if (preferred) return { locationId: preferred, usedLegacyFallback: false };
  const legacy = job.deliverectLocationId?.trim() || null;
  if (legacy) return { locationId: legacy, usedLegacyFallback: true };
  return { locationId: null, usedLegacyFallback: false };
}
