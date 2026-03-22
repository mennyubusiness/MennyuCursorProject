/**
 * Phase 1A: pure Deliverect (unknown JSON) → MennyuCanonicalMenu.
 *
 * Supported raw shapes (extend explicitly when API contract is fixed):
 * - `{ products: [...], categories?: [...] }`
 * - `{ items: [...] }` (alias for products)
 * - `{ menu: { products, categories? } }` (one level of nesting)
 *
 * Product entries:
 * - id: `_id` | `id` | `plu` (string)
 * - `name`, `price` | `unitPrice` (minor units / cents)
 * - `snoozed` | `isSnoozed` → isAvailable inverse
 * - `subProducts` → modifier groups; each group has `subProducts` for options
 * - Options may have nested `subProducts` for per-option modifier groups (nestedGroupDeliverectIds)
 *
 * No database or network I/O.
 */

import type { DeliverectMenuImportMeta } from "@/domain/menu-import/canonical.schema";
import type {
  MennyuCanonicalCategory,
  MennyuCanonicalMenu,
  MennyuCanonicalModifierGroup,
  MennyuCanonicalModifierOption,
  MennyuCanonicalProduct,
} from "@/domain/menu-import/canonical.schema";
import type { MenuImportIssueRecord } from "@/domain/menu-import/issues";
import {
  asNumber,
  asString,
  coerceInt,
  firstDeliverectId,
  isRecord,
} from "@/integrations/deliverect/menu/raw-helpers";

export interface NormalizeDeliverectMenuInput {
  raw: unknown;
  vendorId: string;
  deliverect: DeliverectMenuImportMeta;
}

export interface NormalizeDeliverectMenuResult {
  /** Null when normalization cannot produce a usable menu (e.g. no valid products). */
  menu: MennyuCanonicalMenu | null;
  issues: MenuImportIssueRecord[];
}

export function normalizeDeliverectMenuToCanonical(
  input: NormalizeDeliverectMenuInput
): NormalizeDeliverectMenuResult {
  const issues: MenuImportIssueRecord[] = [];

  if (!isRecord(input.raw)) {
    return {
      menu: null,
      issues: [
        {
          kind: "normalization",
          severity: "blocking",
          code: "ROOT_NOT_OBJECT",
          message: "Deliverect menu payload root must be a JSON object.",
        },
      ],
    };
  }

  const root = unwrapMenuRoot(input.raw);
  const productsRaw = extractProductsArray(root, issues);
  const categoriesRaw = extractCategoriesArray(root, issues);

  const groupRegistry = new Map<string, MennyuCanonicalModifierGroup>();
  const products: MennyuCanonicalProduct[] = [];

  for (let i = 0; i < productsRaw.length; i++) {
    const pr = productsRaw[i];
    if (!isRecord(pr)) {
      issues.push({
        kind: "normalization",
        severity: "warning",
        code: "SKIP_NON_OBJECT_PRODUCT",
        message: `Entry products[${i}] is not an object; skipped.`,
        entityPath: `/products/${i}`,
      });
      continue;
    }
    const built = buildProduct(pr, i, groupRegistry, issues);
    if (built) products.push(built);
  }

  const categories = buildCategories(categoriesRaw, products, issues);

  if (products.length === 0) {
    issues.push({
      kind: "normalization",
      severity: "blocking",
      code: "NO_VALID_PRODUCTS",
      message: "No valid products were normalized from the payload.",
    });
    return { menu: null, issues };
  }

  const menu: MennyuCanonicalMenu = {
    schemaVersion: 1,
    vendorId: input.vendorId,
    deliverect: input.deliverect,
    categories,
    modifierGroupDefinitions: [...groupRegistry.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    products: products.sort((a, b) => a.sortOrder - b.sortOrder),
  };

  return { menu, issues };
}

function unwrapMenuRoot(raw: Record<string, unknown>): Record<string, unknown> {
  const inner = raw.menu;
  if (isRecord(inner)) {
    return { ...raw, ...inner };
  }
  return raw;
}

function extractProductsArray(root: Record<string, unknown>, issues: MenuImportIssueRecord[]): unknown[] {
  const p = root.products ?? root.items;
  if (Array.isArray(p)) return p;
  issues.push({
    kind: "normalization",
    severity: "blocking",
    code: "MISSING_PRODUCTS_ARRAY",
    message: "Expected `products` or `items` array on menu payload.",
    entityPath: "/products",
  });
  return [];
}

function extractCategoriesArray(root: Record<string, unknown>, issues: MenuImportIssueRecord[]): unknown[] {
  const c = root.categories;
  if (Array.isArray(c)) return c;
  if (c !== undefined) {
    issues.push({
      kind: "normalization",
      severity: "warning",
      code: "CATEGORIES_NOT_ARRAY",
      message: "`categories` is present but not an array; ignored.",
      entityPath: "/categories",
    });
  }
  return [];
}

function buildProduct(
  pr: Record<string, unknown>,
  index: number,
  registry: Map<string, MennyuCanonicalModifierGroup>,
  issues: MenuImportIssueRecord[]
): MennyuCanonicalProduct | null {
  const deliverectId = firstDeliverectId(pr);
  if (!deliverectId) {
    issues.push({
      kind: "normalization",
      severity: "blocking",
      code: "MISSING_PRODUCT_ID",
      message: `Product at index ${index} has no _id, id, or plu.`,
      entityPath: `/products/${index}`,
    });
    return null;
  }

  const nameRaw = asString(pr.name) ?? asString(pr.productName);
  if (!nameRaw) {
    issues.push({
      kind: "normalization",
      severity: "warning",
      code: "MISSING_PRODUCT_NAME",
      message: `Product ${deliverectId} missing name; using placeholder.`,
      deliverectId,
      entityPath: `/products/${index}/name`,
    });
  }

  const priceRaw = asNumber(pr.price) ?? asNumber(pr.unitPrice) ?? asNumber(pr.basePrice);
  if (priceRaw === undefined) {
    issues.push({
      kind: "normalization",
      severity: "blocking",
      code: "MISSING_PRODUCT_PRICE",
      message: `Product ${deliverectId} has no price / unitPrice.`,
      deliverectId,
      entityPath: `/products/${index}/price`,
    });
    return null;
  }

  const priceCents = Math.max(0, Math.round(priceRaw));
  const snoozed = pr.snoozed === true || pr.isSnoozed === true || pr.available === false;
  const imageUrlRaw = asString(pr.imageUrl) ?? asString(pr.image);
  const imageUrl =
    imageUrlRaw && imageUrlRaw.trim() !== "" ? imageUrlRaw.trim() : null;
  const desc = asString(pr.description) ?? asString(pr.desc) ?? null;

  const modifierGroupDeliverectIds = walkTopLevelModifierGroups(
    pr,
    deliverectId,
    registry,
    issues,
    index * 1000
  );

  return {
    deliverectId,
    name: nameRaw ?? "Unnamed item",
    description: desc,
    priceCents,
    isAvailable: !snoozed,
    sortOrder: coerceInt(pr.sortOrder ?? pr.sortIndex, index),
    imageUrl,
    basketMaxQuantity:
      pr.maxQuantity != null || pr.basketMax != null
        ? coerceInt(pr.maxQuantity ?? pr.basketMax, 99)
        : null,
    modifierGroupDeliverectIds,
  };
}

function walkTopLevelModifierGroups(
  productRaw: Record<string, unknown>,
  productDeliverectId: string,
  registry: Map<string, MennyuCanonicalModifierGroup>,
  issues: MenuImportIssueRecord[],
  sortBase: number
): string[] {
  const subs = productRaw.subProducts;
  if (!Array.isArray(subs) || subs.length === 0) return [];

  const groupIds: string[] = [];
  let order = sortBase;
  for (let gi = 0; gi < subs.length; gi++) {
    const g = subs[gi];
    if (!isRecord(g)) continue;
    const gid = firstDeliverectId(g);
    if (!gid) {
      issues.push({
        kind: "normalization",
        severity: "blocking",
        code: "MISSING_MODIFIER_GROUP_ID",
        message: `Product ${productDeliverectId} has a modifier group without _id/id/plu at subProducts[${gi}].`,
        deliverectId: productDeliverectId,
      });
      continue;
    }

    const group = buildModifierGroupTree(
      g,
      gid,
      null,
      productDeliverectId,
      registry,
      issues,
      order
    );
    if (!group) continue;

    if (registry.has(gid)) {
      const prev = registry.get(gid)!;
      if (!modifierGroupsStructurallyEqual(prev, group)) {
        issues.push({
          kind: "normalization",
          severity: "blocking",
          code: "CONFLICTING_MODIFIER_GROUP_DEF",
          message: `Modifier group ${gid} is defined differently on another product.`,
          deliverectId: gid,
          entityPath: `/modifierGroupDefinitions/${gid}`,
        });
        continue;
      }
    } else {
      registry.set(gid, group);
    }
    groupIds.push(gid);
    order += 1;
  }
  return groupIds;
}

function buildModifierGroupTree(
  g: Record<string, unknown>,
  gid: string,
  parentOptionId: string | null,
  productDeliverectId: string,
  registry: Map<string, MennyuCanonicalModifierGroup>,
  issues: MenuImportIssueRecord[],
  sortOrder: number
): MennyuCanonicalModifierGroup | null {
  const name = asString(g.name) ?? asString(g.title) ?? "(modifier group)";
  const min = coerceInt(g.min ?? g.minQty ?? (g.multiSelect === false ? 1 : 0), 0);
  let max = coerceInt(g.max ?? g.maxQty, 1);
  if (max < min) max = min;

  const optSource = g.subProducts;
  const optsRaw = Array.isArray(optSource) ? optSource : [];

  const options: MennyuCanonicalModifierOption[] = [];
  let oi = 0;
  for (const o of optsRaw) {
    if (!isRecord(o)) continue;
    const oid = firstDeliverectId(o);
    if (!oid) {
      issues.push({
        kind: "normalization",
        severity: "blocking",
        code: "MISSING_MODIFIER_OPTION_ID",
        message: `Modifier group ${gid} has an option without id under product ${productDeliverectId}.`,
        deliverectId: gid,
      });
      continue;
    }

    const nestedGroupIds = walkNestedModifierGroupsFromOption(
      o,
      oid,
      productDeliverectId,
      registry,
      issues,
      sortOrder * 100 + oi
    );

    const optPrice = asNumber(o.price) ?? asNumber(o.unitPrice) ?? 0;

    options.push({
      deliverectId: oid,
      name: asString(o.name) ?? "Option",
      priceCents: Math.max(0, Math.round(optPrice)),
      sortOrder: oi,
      isDefault: Boolean(o.default ?? o.isDefault),
      isAvailable: !(o.snoozed === true || o.isSnoozed === true),
      nestedGroupDeliverectIds: nestedGroupIds,
    });
    oi += 1;
  }

  if (options.length === 0) {
    issues.push({
      kind: "normalization",
      severity: "warning",
      code: "EMPTY_MODIFIER_GROUP",
      message: `Modifier group ${gid} has no options.`,
      deliverectId: gid,
    });
  }

  return {
    deliverectId: gid,
    name,
    minSelections: min,
    maxSelections: max,
    isRequired: min > 0,
    sortOrder,
    parentDeliverectOptionId: parentOptionId,
    options,
  };
}

function walkNestedModifierGroupsFromOption(
  optionRaw: Record<string, unknown>,
  parentOptionId: string,
  productDeliverectId: string,
  registry: Map<string, MennyuCanonicalModifierGroup>,
  issues: MenuImportIssueRecord[],
  sortBase: number
): string[] {
  const subs = optionRaw.subProducts;
  if (!Array.isArray(subs) || subs.length === 0) return [];

  const nestedIds: string[] = [];
  let order = sortBase;
  for (let i = 0; i < subs.length; i++) {
    const g = subs[i];
    if (!isRecord(g)) continue;
    const gid = firstDeliverectId(g);
    if (!gid) continue;

    const group = buildModifierGroupTree(
      g,
      gid,
      parentOptionId,
      productDeliverectId,
      registry,
      issues,
      order
    );
    if (!group) continue;

    if (registry.has(gid)) {
      const prev = registry.get(gid)!;
      if (!modifierGroupsStructurallyEqual(prev, group)) {
        issues.push({
          kind: "normalization",
          severity: "blocking",
          code: "CONFLICTING_NESTED_MODIFIER_GROUP_DEF",
          message: `Nested modifier group ${gid} conflicts with an existing definition.`,
          deliverectId: gid,
        });
        continue;
      }
    } else {
      registry.set(gid, group);
    }
    nestedIds.push(gid);
    order += 1;
  }
  return nestedIds;
}

function modifierGroupsStructurallyEqual(
  a: MennyuCanonicalModifierGroup,
  b: MennyuCanonicalModifierGroup
): boolean {
  if (a.deliverectId !== b.deliverectId) return false;
  if (a.name !== b.name) return false;
  if (a.minSelections !== b.minSelections || a.maxSelections !== b.maxSelections) return false;
  if (a.options.length !== b.options.length) return false;
  for (let i = 0; i < a.options.length; i++) {
    const x = a.options[i]!;
    const y = b.options[i]!;
    if (x.deliverectId !== y.deliverectId || x.priceCents !== y.priceCents || x.name !== y.name)
      return false;
  }
  return true;
}

function buildCategories(
  rawCats: unknown[],
  products: MennyuCanonicalProduct[],
  issues: MenuImportIssueRecord[]
): MennyuCanonicalCategory[] {
  const productIdSet = new Set(products.map((p) => p.deliverectId));
  const out: MennyuCanonicalCategory[] = [];
  let ci = 0;
  for (const c of rawCats) {
    if (!isRecord(c)) {
      issues.push({
        kind: "normalization",
        severity: "warning",
        code: "SKIP_NON_OBJECT_CATEGORY",
        message: `categories[${ci}] is not an object; skipped.`,
        entityPath: `/categories/${ci}`,
      });
      ci++;
      continue;
    }
    const cid = firstDeliverectId(c);
    if (!cid) {
      issues.push({
        kind: "normalization",
        severity: "blocking",
        code: "MISSING_CATEGORY_ID",
        message: `Category at index ${ci} has no _id/id/plu.`,
        entityPath: `/categories/${ci}`,
      });
      ci++;
      continue;
    }
    const name = asString(c.name) ?? "Category";
    const productDeliverectIds = extractProductIdsFromCategory(c, issues, cid);
    const unknown = productDeliverectIds.filter((id) => !productIdSet.has(id));
    for (const id of unknown) {
      issues.push({
        kind: "normalization",
        severity: "warning",
        code: "CATEGORY_UNKNOWN_PRODUCT_REF",
        message: `Category ${cid} references product id ${id} not present in normalized products.`,
        deliverectId: cid,
        details: { missingProductId: id },
      });
    }
    out.push({
      deliverectId: cid,
      name,
      sortOrder: coerceInt(c.sortOrder ?? c.sortIndex, ci),
      productDeliverectIds: productDeliverectIds.filter((id) => productIdSet.has(id)),
    });
    ci++;
  }
  return out;
}

function extractProductIdsFromCategory(
  c: Record<string, unknown>,
  issues: MenuImportIssueRecord[],
  categoryId: string
): string[] {
  const ids: string[] = [];
  const pids = c.productIds;
  if (Array.isArray(pids)) {
    for (const x of pids) {
      const s = asString(x) ?? (isRecord(x) ? firstDeliverectId(x) : undefined);
      if (s) ids.push(s);
    }
    return dedupePreserveOrder(ids);
  }

  const prods = c.products;
  if (Array.isArray(prods)) {
    for (const x of prods) {
      if (typeof x === "string" || typeof x === "number") {
        const s = asString(x);
        if (s) ids.push(s);
        continue;
      }
      if (isRecord(x)) {
        const s = firstDeliverectId(x);
        if (s) ids.push(s);
      }
    }
    return dedupePreserveOrder(ids);
  }

  issues.push({
    kind: "normalization",
    severity: "info",
    code: "CATEGORY_NO_PRODUCTS",
    message: `Category ${categoryId} has no productIds or products array; category will be empty.`,
    deliverectId: categoryId,
  });
  return [];
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
