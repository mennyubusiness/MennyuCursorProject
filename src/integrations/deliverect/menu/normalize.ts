/**
 * Phase 1A: pure Deliverect (unknown JSON) → MennyuCanonicalMenu.
 *
 * Supported raw shapes (extend explicitly when API contract is fixed):
 * - `{ products: [...], categories?: [...] }` or `{ products: { id: {...}, ... } }` (string-keyed map)
 * - `{ items: [...] | { ... } }`, `menuItems`, `availableProducts`, `catalog` (array or map)
 * - `{ menu: { products, categories? } }` (one level of nesting)
 * - `{ data: { products | items | ... } }` (common webhook envelope)
 * - Products embedded as objects under `categories[].products` / `categories[].items` when no top-level list/map exists
 *
 * Product entries:
 * - id: `_id` | `id` | `plu` (string)
 * - `name`, `price` | `unitPrice` (minor units / cents)
 * - `snoozed` | `isSnoozed` → isAvailable inverse
 * - `subProducts` → modifier groups; each group has `subProducts` for options (array **or** string-keyed object map, like `products`)
 * - `subproducts` / `SubProducts` aliases on product and group nodes
 * - Options may have nested `subProducts` for per-option modifier groups (nestedGroupDeliverectIds)
 * - `subProducts` entries may be **string/number references** to rows in top-level `modifierGroups` / `modifiers` (or maps under `data` / `payload`)
 * - **Nested modifier groups** under another group's `subProducts` (no option price on the inner node) are **flattened**: leaf options bubble up to the parent group's option list
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
import { MODIFIER_MAX_SELECTIONS_UNBOUNDED } from "@/domain/modifier-selection-unbounded";
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
  const categoriesRaw = extractCategoriesArray(root, issues);
  const productsRaw = extractProductsArray(root, categoriesRaw, issues);
  const modifierLookups = buildModifierPayloadLookups(root, productsRaw, issues);

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
    const built = buildProduct(pr, i, groupRegistry, modifierLookups, issues);
    if (built) products.push(built);
  }

  const categories = buildCategories(categoriesRaw, products, issues);

  if (products.length === 0) {
    const emptyCollectionExplained = issues.some((i) => i.code === "EMPTY_PRODUCTS_COLLECTION");
    if (!emptyCollectionExplained) {
      issues.push({
        kind: "normalization",
        severity: "blocking",
        code: "NO_VALID_PRODUCTS",
        message: "No valid products were normalized from the payload.",
      });
    }
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

/** Set `DELIVERECT_MENU_NORMALIZE_DEBUG=1` to log chosen product source and count (server logs). */
function logDeliverectProductExtraction(source: string, count: number): void {
  if (typeof process !== "undefined" && process.env.DELIVERECT_MENU_NORMALIZE_DEBUG === "1") {
    console.log("[Deliverect menu normalize] products extracted", { source, count });
  }
}

const PRODUCT_COLLECTION_KEYS = [
  "products",
  "items",
  "menuItems",
  "availableProducts",
  "allProducts",
  "productList",
  "catalog",
  "catalogItems",
] as const;

type ProductListHit = { list: unknown[]; source: string };

/**
 * Deliverect Menu Push often sends `products` as a **string-keyed object** (id → product), not an array.
 * Accept non-empty arrays or object maps whose values are plain product records.
 */
function takeProductListFromValue(keyPath: string, v: unknown): ProductListHit | null {
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    return { list: v, source: `${keyPath}.array` };
  }
  if (isRecord(v) && !Array.isArray(v)) {
    const values = Object.values(v).filter((x) => isRecord(x) && !Array.isArray(x));
    if (values.length === 0) return null;
    return { list: values, source: `${keyPath}.object_map` };
  }
  return null;
}

/**
 * True when a product-collection key is present with value `[]`, `{}`, or a map with no product-shaped object values
 * (same structural emptiness as `takeProductListFromValue` returning null — but the key exists).
 */
function isDeclaredEmptyProductCollection(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length === 0;
  if (isRecord(v) && !Array.isArray(v)) {
    const values = Object.values(v).filter((x) => isRecord(x) && !Array.isArray(x));
    return values.length === 0;
  }
  return false;
}

/**
 * First declared-but-empty product collection on root, `data`, or `payload` (same surfaces as extraction).
 */
function findDeclaredEmptyProductCollectionOnLayers(root: Record<string, unknown>): {
  key: string;
  entityPath: string;
} | null {
  const layers: { rec: Record<string, unknown>; pathPrefix: string }[] = [
    { rec: root, pathPrefix: "" },
  ];
  const data = root.data;
  if (isRecord(data)) layers.push({ rec: data, pathPrefix: "data" });
  const payload = root.payload;
  if (isRecord(payload)) layers.push({ rec: payload, pathPrefix: "payload" });

  for (const { rec, pathPrefix } of layers) {
    for (const key of PRODUCT_COLLECTION_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(rec, key)) continue;
      const v = rec[key];
      if (isDeclaredEmptyProductCollection(v)) {
        const entityPath = pathPrefix ? `/${pathPrefix}/${key}` : `/${key}`;
        return { key, entityPath };
      }
    }
  }
  return null;
}

function tryExtractProductsFromRecord(
  obj: Record<string, unknown>,
  keyPrefix: string
): ProductListHit | null {
  for (const key of PRODUCT_COLLECTION_KEYS) {
    const hit = takeProductListFromValue(keyPrefix ? `${keyPrefix}.${key}` : key, obj[key]);
    if (hit) return hit;
  }
  return null;
}

/**
 * Some Menu Push payloads lead with `availabilities` where each row may embed the product document
 * (e.g. `{ product: { _id, name, price } }`) instead of a top-level `products` map.
 */
function extractProductsFromAvailabilityRows(root: Record<string, unknown>): unknown[] {
  const av = root.availabilities;
  if (!Array.isArray(av) || av.length === 0) return [];

  const byId = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < av.length; i++) {
    const row = av[i];
    if (!isRecord(row)) continue;

    const product =
      (isRecord(row.product) ? row.product : null) ??
      (isRecord(row.menuItem) ? row.menuItem : null) ??
      (isRecord(row.item) ? row.item : null) ??
      (isRecord(row.menuItemRef) ? row.menuItemRef : null);

    if (!product) continue;

    const id = firstDeliverectId(product);
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, product);
  }

  return byId.size > 0 ? [...byId.values()] : [];
}

/**
 * Collect product **objects** nested under categories (e.g. `products: [{ _id, name, ... }]`)
 * when top-level product collections are absent.
 */
function extractEmbeddedProductsFromCategories(
  categoriesRaw: unknown[],
  issues: MenuImportIssueRecord[]
): unknown[] {
  const byId = new Map<string, Record<string, unknown>>();
  let ci = 0;
  for (const c of categoriesRaw) {
    if (!isRecord(c)) {
      ci++;
      continue;
    }
    for (const embedKey of ["products", "items", "menuItems"] as const) {
      const prods = c[embedKey];
      if (!Array.isArray(prods)) continue;
      for (let pi = 0; pi < prods.length; pi++) {
        const p = prods[pi];
        if (typeof p === "string" || typeof p === "number") continue;
        if (!isRecord(p) || Array.isArray(p)) {
          issues.push({
            kind: "normalization",
            severity: "warning",
            code: "SKIP_NON_OBJECT_CATEGORY_EMBEDDED_PRODUCT",
            message: `categories[${ci}].${embedKey}[${pi}] is not an object; skipped for product extraction.`,
            entityPath: `/categories/${ci}/${embedKey}/${pi}`,
          });
          continue;
        }
        const id = firstDeliverectId(p);
        if (!id) continue;
        if (!byId.has(id)) byId.set(id, p);
      }
    }
    ci++;
  }
  return [...byId.values()];
}

function extractProductsArray(
  root: Record<string, unknown>,
  categoriesRaw: unknown[],
  issues: MenuImportIssueRecord[]
): unknown[] {
  const fromRoot = tryExtractProductsFromRecord(root, "");
  if (fromRoot) {
    logDeliverectProductExtraction(fromRoot.source, fromRoot.list.length);
    return fromRoot.list;
  }

  const data = root.data;
  if (isRecord(data)) {
    const fromData = tryExtractProductsFromRecord(data, "data");
    if (fromData) {
      logDeliverectProductExtraction(fromData.source, fromData.list.length);
      return fromData.list;
    }
  }

  const payload = root.payload;
  if (isRecord(payload)) {
    const fromPayload = tryExtractProductsFromRecord(payload, "payload");
    if (fromPayload) {
      logDeliverectProductExtraction(fromPayload.source, fromPayload.list.length);
      return fromPayload.list;
    }
  }

  const fromAvail = extractProductsFromAvailabilityRows(root);
  if (fromAvail.length > 0) {
    logDeliverectProductExtraction("availabilities[].product|menuItem|item", fromAvail.length);
    return fromAvail;
  }

  if (isRecord(data)) {
    const fromDataAvail = extractProductsFromAvailabilityRows(data);
    if (fromDataAvail.length > 0) {
      logDeliverectProductExtraction("data.availabilities[].product|menuItem|item", fromDataAvail.length);
      return fromDataAvail;
    }
  }

  const fromCats = extractEmbeddedProductsFromCategories(categoriesRaw, issues);
  if (fromCats.length > 0) {
    logDeliverectProductExtraction("categories.embedded_product_objects", fromCats.length);
    return fromCats;
  }

  const emptyDecl = findDeclaredEmptyProductCollectionOnLayers(root);
  if (emptyDecl) {
    const { key, entityPath } = emptyDecl;
    const message =
      key === "products"
        ? "Products collection exists but contains no products."
        : `The "${key}" collection exists but contains no products.`;
    issues.push({
      kind: "normalization",
      severity: "blocking",
      code: "EMPTY_PRODUCTS_COLLECTION",
      message,
      entityPath,
      details: { collectionKey: key },
    });
    return [];
  }

  issues.push({
    kind: "normalization",
    severity: "blocking",
    code: "MISSING_PRODUCTS_ARRAY",
    message:
      "Could not find a non-empty products collection: expected one of products/items/menuItems/availableProducts/catalog (array or string-keyed object map) on root, data, or payload; or product objects embedded under categories[].products|items|menuItems.",
    entityPath: "/products",
    details: {
      checkedKeys: [...PRODUCT_COLLECTION_KEYS],
      checkedPaths: [
        "root",
        "data",
        "payload",
        "availabilities[].product|menuItem|item",
        "categories.*.products|items|menuItems",
      ],
    },
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

/**
 * Deliverect often nests modifiers under `subProducts` as either an array or a string-keyed map (same pattern as `products`).
 */
function getSubProductsRaw(obj: Record<string, unknown>): unknown {
  return obj.subProducts ?? obj.subproducts ?? obj.SubProducts;
}

/**
 * Resolve Deliverect id for a subProduct node: standard id fields, then modifier-specific keys, then map key when the payload omits inline ids.
 */
function resolveSubProductNodeId(node: Record<string, unknown>, mapKey?: string): string | undefined {
  return (
    firstDeliverectId(node) ??
    asString(node.modifierId) ??
    asString(node.groupId) ??
    asString(node.optionId) ??
    asString(node.subModifierId) ??
    asString(node.channelModifierId) ??
    (mapKey != null && String(mapKey).trim() !== "" ? String(mapKey).trim() : undefined)
  );
}

const MODIFIER_GROUP_INDEX_KEYS = [
  "modifierGroups",
  "modifierGroupDefinitions",
  "subModifierGroups",
  "allModifierGroups",
] as const;

const MODIFIER_OPTION_INDEX_KEYS = [
  "modifiers",
  "subModifiers",
  "modifierOptions",
  "allModifiers",
  "menuModifiers",
] as const;

type ModifierPayloadLookups = {
  groupById: Map<string, Record<string, unknown>>;
  modifierById: Map<string, Record<string, unknown>>;
  productById: Map<string, Record<string, unknown>>;
};

function collectMenuLookupLayers(root: Record<string, unknown>): Record<string, unknown>[] {
  const layers: Record<string, unknown>[] = [root];
  const data = root.data;
  if (isRecord(data)) layers.push(data);
  const payload = root.payload;
  if (isRecord(payload)) layers.push(payload);
  return layers;
}

function indexRecordMapOrArrayInto(
  raw: unknown,
  target: Map<string, Record<string, unknown>>,
  issues: MenuImportIssueRecord[],
  contextPath: string
): void {
  if (raw === undefined || raw === null) return;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i];
      if (!isRecord(x) || Array.isArray(x)) {
        issues.push({
          kind: "normalization",
          severity: "warning",
          code: "SKIP_NON_OBJECT_MODIFIER_INDEX_ENTRY",
          message: `Expected object in ${contextPath}[${i}]; skipped for lookup index.`,
          entityPath: `${contextPath}/${i}`,
        });
        continue;
      }
      const id = firstDeliverectId(x);
      if (!id) {
        issues.push({
          kind: "normalization",
          severity: "warning",
          code: "UNINDEXED_MODIFIER_ENTRY",
          message: `Entry in ${contextPath}[${i}] has no id fields; not indexed for subProducts reference resolution.`,
          entityPath: `${contextPath}/${i}`,
        });
        continue;
      }
      if (!target.has(id)) target.set(id, x);
    }
    return;
  }
  if (isRecord(raw) && !Array.isArray(raw)) {
    for (const [mapKey, x] of Object.entries(raw)) {
      if (!isRecord(x) || Array.isArray(x)) continue;
      const id = resolveSubProductNodeId(x, mapKey);
      if (!id) continue;
      if (!target.has(id)) target.set(id, x);
    }
  }
}

function buildModifierPayloadLookups(
  root: Record<string, unknown>,
  productsRaw: unknown[],
  issues: MenuImportIssueRecord[]
): ModifierPayloadLookups {
  const groupById = new Map<string, Record<string, unknown>>();
  const modifierById = new Map<string, Record<string, unknown>>();
  const layers = collectMenuLookupLayers(root);

  for (const layer of layers) {
    for (const key of MODIFIER_GROUP_INDEX_KEYS) {
      indexRecordMapOrArrayInto(layer[key], groupById, issues, `/${key}`);
    }
    for (const key of MODIFIER_OPTION_INDEX_KEYS) {
      indexRecordMapOrArrayInto(layer[key], modifierById, issues, `/${key}`);
    }
  }

  const productById = new Map<string, Record<string, unknown>>();
  for (const p of productsRaw) {
    if (!isRecord(p) || Array.isArray(p)) continue;
    const id = firstDeliverectId(p);
    if (id && !productById.has(id)) productById.set(id, p);
  }

  return { groupById, modifierById, productById };
}

function looksLikeModifierGroupRecord(r: Record<string, unknown>): boolean {
  const sp = getSubProductsRaw(r);
  if (sp !== undefined && sp !== null) return true;
  if (r.min !== undefined || r.max !== undefined) return true;
  if (r.minQty !== undefined || r.maxQty !== undefined) return true;
  if (r.multiSelect !== undefined) return true;
  return false;
}

/** True when the node has any common option price field (including 0). */
function optionLikePricePresent(node: Record<string, unknown>): boolean {
  return (
    asNumber(node.price) !== undefined ||
    asNumber(node.unitPrice) !== undefined ||
    asNumber(node.basePrice) !== undefined
  );
}

/**
 * Deliverect may nest modifier Group B under Group A's subProducts. If the node has no option price,
 * treat it as a nested group container and flatten its leaf options into the parent group's option list.
 */
function subProductActsAsNestedGroupContainer(node: Record<string, unknown>): boolean {
  if (optionLikePricePresent(node)) return false;
  return looksLikeModifierGroupRecord(node);
}

function cloneRecordShallow(r: Record<string, unknown>): Record<string, unknown> {
  return { ...r };
}

function resolveSubProductGroupRef(
  refId: string,
  lookups: ModifierPayloadLookups,
  issues: MenuImportIssueRecord[],
  context: { entityPath: string; deliverectId?: string }
): Record<string, unknown> | null {
  const trimmed = refId.trim();
  if (!trimmed) return null;

  const asGroup = lookups.groupById.get(trimmed);
  if (asGroup) return cloneRecordShallow(asGroup);

  const asModifier = lookups.modifierById.get(trimmed);
  if (asModifier && looksLikeModifierGroupRecord(asModifier)) {
    return cloneRecordShallow(asModifier);
  }

  const asProduct = lookups.productById.get(trimmed);
  if (asProduct && getSubProductsRaw(asProduct) != null) {
    return cloneRecordShallow(asProduct);
  }

  issues.push({
    kind: "normalization",
    severity: "warning",
    code: "UNRESOLVED_SUB_PRODUCT_GROUP_REF",
    message: `subProducts group reference "${trimmed}" was not found in modifierGroups, modifiers (as group), or products with subProducts.`,
    entityPath: context.entityPath,
    deliverectId: context.deliverectId,
    details: { refId: trimmed },
  });
  return null;
}

type SubProductEntry =
  | { kind: "inline"; node: Record<string, unknown>; mapKey?: string }
  | { kind: "ref"; refId: string; mapKey?: string };

/**
 * Parse `subProducts` into inline records and string/number id references (arrays or map values).
 */
function coerceSubProductEntries(
  raw: unknown,
  issues: MenuImportIssueRecord[],
  context: { entityPath: string; deliverectId?: string }
): SubProductEntry[] {
  if (raw === undefined || raw === null) return [];

  if (Array.isArray(raw)) {
    const out: SubProductEntry[] = [];
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i];
      const ref =
        asString(x) ?? (typeof x === "number" && Number.isFinite(x) ? String(Math.trunc(x)) : undefined);
      if (ref != null && ref.trim() !== "") {
        out.push({ kind: "ref", refId: ref.trim() });
        continue;
      }
      if (isRecord(x) && !Array.isArray(x)) {
        out.push({ kind: "inline", node: x });
        continue;
      }
      issues.push({
        kind: "normalization",
        severity: "warning",
        code: "SKIP_INVALID_SUB_PRODUCT_ENTRY",
        message: `subProducts[${i}] is not an object or a string/number id reference; skipped.`,
        entityPath: `${context.entityPath}/subProducts/${i}`,
        deliverectId: context.deliverectId,
      });
    }
    return out;
  }

  if (isRecord(raw) && !Array.isArray(raw)) {
    const out: SubProductEntry[] = [];
    for (const [mapKey, x] of Object.entries(raw)) {
      const ref =
        asString(x) ?? (typeof x === "number" && Number.isFinite(x) ? String(Math.trunc(x)) : undefined);
      if (ref != null && ref.trim() !== "") {
        out.push({ kind: "ref", refId: ref.trim(), mapKey });
        continue;
      }
      if (isRecord(x) && !Array.isArray(x)) {
        out.push({ kind: "inline", node: x, mapKey });
        continue;
      }
      issues.push({
        kind: "normalization",
        severity: "warning",
        code: "SKIP_INVALID_SUB_PRODUCT_MAP_ENTRY",
        message: `subProducts map entry "${mapKey}" is not an object or id reference; skipped.`,
        entityPath: `${context.entityPath}/subProducts/${mapKey}`,
        deliverectId: context.deliverectId,
      });
    }
    return out;
  }

  issues.push({
    kind: "normalization",
    severity: "warning",
    code: "SUB_PRODUCTS_WRONG_TYPE",
    message: `subProducts must be an array or object map; got ${typeof raw}. Modifier tree under this path ignored.`,
    entityPath: `${context.entityPath}/subProducts`,
    deliverectId: context.deliverectId,
  });
  return [];
}

function resolveSubProductEntryToGroupNode(
  entry: SubProductEntry,
  lookups: ModifierPayloadLookups,
  issues: MenuImportIssueRecord[],
  context: { entityPath: string; deliverectId?: string }
): { node: Record<string, unknown>; gid: string } | null {
  if (entry.kind === "inline") {
    const gid = resolveSubProductNodeId(entry.node, entry.mapKey);
    if (!gid) {
      issues.push({
        kind: "normalization",
        severity: "blocking",
        code: "MISSING_MODIFIER_GROUP_ID",
        message: `Modifier group has no Deliverect id (_id/id/plu or subProducts map key).`,
        entityPath: context.entityPath,
        deliverectId: context.deliverectId,
      });
      return null;
    }
    return { node: entry.node, gid };
  }

  const resolved = resolveSubProductGroupRef(entry.refId, lookups, issues, context);
  if (!resolved) return null;
  const gid =
    resolveSubProductNodeId(resolved, entry.mapKey) ?? entry.mapKey?.trim() ?? entry.refId.trim();
  if (!gid) {
    issues.push({
      kind: "normalization",
      severity: "blocking",
      code: "MISSING_MODIFIER_GROUP_ID",
      message: `Resolved group for reference "${entry.refId}" has no usable Deliverect id.`,
      entityPath: context.entityPath,
      deliverectId: context.deliverectId,
    });
    return null;
  }
  return { node: resolved, gid };
}

/**
 * Resolve one subProducts entry under a modifier group as either a nested group (flattened later) or a leaf option.
 * Does not emit issues (caller reports unresolved / missing ids).
 */
function tryResolveSubProductEntryForGroupSubProduct(
  entry: SubProductEntry,
  lookups: ModifierPayloadLookups
):
  | { kind: "group"; node: Record<string, unknown>; gid: string }
  | { kind: "leaf"; node: Record<string, unknown>; oid: string }
  | null {
  if (entry.kind === "inline") {
    const node = entry.node;
    if (subProductActsAsNestedGroupContainer(node)) {
      const gid = resolveSubProductNodeId(node, entry.mapKey);
      if (!gid) return null;
      return { kind: "group", node, gid };
    }
    const oid = resolveSubProductNodeId(node, entry.mapKey);
    if (!oid) return null;
    return { kind: "leaf", node, oid };
  }

  const trimmed = entry.refId.trim();
  if (!trimmed) return null;

  const gRow = lookups.groupById.get(trimmed);
  if (gRow) {
    const node = cloneRecordShallow(gRow);
    const gid = resolveSubProductNodeId(node, entry.mapKey) ?? entry.mapKey?.trim() ?? trimmed;
    return { kind: "group", node, gid };
  }

  const mRow = lookups.modifierById.get(trimmed);
  if (mRow) {
    const node = cloneRecordShallow(mRow);
    if (subProductActsAsNestedGroupContainer(node)) {
      const gid = resolveSubProductNodeId(node, entry.mapKey) ?? entry.mapKey?.trim() ?? trimmed;
      return { kind: "group", node, gid };
    }
    const oid = resolveSubProductNodeId(node, entry.mapKey) ?? entry.mapKey?.trim() ?? trimmed;
    return { kind: "leaf", node, oid };
  }

  const pRow = lookups.productById.get(trimmed);
  if (pRow && getSubProductsRaw(pRow) != null) {
    const node = cloneRecordShallow(pRow);
    const gid = resolveSubProductNodeId(node, entry.mapKey) ?? trimmed;
    return { kind: "group", node, gid };
  }

  return null;
}

const MAX_SUB_PRODUCT_GROUP_NEST = 24;

/**
 * Walk subProducts under a modifier group recursively: nested group containers are flattened into leaf option records.
 */
function expandSubProductEntriesToLeafOptionSpecs(
  entries: SubProductEntry[],
  lookups: ModifierPayloadLookups,
  issues: MenuImportIssueRecord[],
  context: { entityPath: string; deliverectId?: string },
  depth: number
): Array<{ node: Record<string, unknown>; oid: string }> {
  if (depth > MAX_SUB_PRODUCT_GROUP_NEST) {
    issues.push({
      kind: "normalization",
      severity: "warning",
      code: "SUB_PRODUCTS_NESTING_DEPTH_EXCEEDED",
      message: `subProducts nesting exceeded ${MAX_SUB_PRODUCT_GROUP_NEST} levels under modifier group; deeper entries ignored.`,
      entityPath: context.entityPath,
      deliverectId: context.deliverectId,
    });
    return [];
  }

  const out: Array<{ node: Record<string, unknown>; oid: string }> = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const path = `${context.entityPath}/subProducts/${i}`;
    const resolved = tryResolveSubProductEntryForGroupSubProduct(entry, lookups);
    if (!resolved) {
      if (entry.kind === "ref") {
        issues.push({
          kind: "normalization",
          severity: "warning",
          code: "UNRESOLVED_SUB_PRODUCT_REF",
          message: `subProducts reference "${entry.refId.trim()}" could not be resolved (modifierGroups, modifiers, or products with subProducts).`,
          entityPath: path,
          deliverectId: context.deliverectId,
          details: { refId: entry.refId.trim() },
        });
      } else if (subProductActsAsNestedGroupContainer(entry.node)) {
        issues.push({
          kind: "normalization",
          severity: "blocking",
          code: "MISSING_MODIFIER_GROUP_ID",
          message: `Nested modifier group under subProducts has no Deliverect id (_id/id/plu or map key).`,
          entityPath: path,
          deliverectId: context.deliverectId,
        });
      } else {
        issues.push({
          kind: "normalization",
          severity: "blocking",
          code: "MISSING_MODIFIER_OPTION_ID",
          message: `Modifier option under subProducts has no Deliverect id (_id/id/plu or map key).`,
          entityPath: path,
          deliverectId: context.deliverectId,
        });
      }
      continue;
    }
    if (resolved.kind === "leaf") {
      out.push({ node: resolved.node, oid: resolved.oid });
      continue;
    }
    const innerEntries = coerceSubProductEntries(getSubProductsRaw(resolved.node), issues, {
      entityPath: `${path}/nestedGroup/${resolved.gid}`,
      deliverectId: resolved.gid,
    });
    out.push(
      ...expandSubProductEntriesToLeafOptionSpecs(innerEntries, lookups, issues, {
        entityPath: `${path}/nestedGroup/${resolved.gid}`,
        deliverectId: resolved.gid,
      }, depth + 1)
    );
  }
  return out;
}

/** Collect all leaf options for a modifier group node (flattens nested Deliverect groups). */
function collectLeafOptionsFromGroupNode(
  groupNode: Record<string, unknown>,
  lookups: ModifierPayloadLookups,
  issues: MenuImportIssueRecord[],
  context: { entityPath: string; deliverectId?: string }
): Array<{ node: Record<string, unknown>; oid: string }> {
  const entries = coerceSubProductEntries(getSubProductsRaw(groupNode), issues, context);
  return expandSubProductEntriesToLeafOptionSpecs(entries, lookups, issues, context, 0);
}

function buildProduct(
  pr: Record<string, unknown>,
  index: number,
  registry: Map<string, MennyuCanonicalModifierGroup>,
  lookups: ModifierPayloadLookups,
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

  const priceRaw =
    asNumber(pr.price) ??
    asNumber(pr.unitPrice) ??
    asNumber(pr.basePrice) ??
    asNumber(pr.salesPrice) ??
    asNumber(pr.retailPrice) ??
    asNumber(pr.priceInclTax) ??
    asNumber(pr.priceExclTax);
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
    index,
    registry,
    lookups,
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
  productIndex: number,
  registry: Map<string, MennyuCanonicalModifierGroup>,
  lookups: ModifierPayloadLookups,
  issues: MenuImportIssueRecord[],
  sortBase: number
): string[] {
  const subsRaw = getSubProductsRaw(productRaw);
  const entries = coerceSubProductEntries(subsRaw, issues, {
    entityPath: `/products/${productIndex}`,
    deliverectId: productDeliverectId,
  });
  if (entries.length === 0) return [];

  const groupIds: string[] = [];
  let order = sortBase;
  for (let gi = 0; gi < entries.length; gi++) {
    const entry = entries[gi]!;
    const resolved = resolveSubProductEntryToGroupNode(entry, lookups, issues, {
      entityPath: `/products/${productIndex}/subProducts/${gi}`,
      deliverectId: productDeliverectId,
    });
    if (!resolved) continue;
    const { node: g, gid } = resolved;

    const group = buildModifierGroupTree(
      g,
      gid,
      null,
      productDeliverectId,
      registry,
      lookups,
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
  lookups: ModifierPayloadLookups,
  issues: MenuImportIssueRecord[],
  sortOrder: number
): MennyuCanonicalModifierGroup | null {
  const name = asString(g.name) ?? asString(g.title) ?? "(modifier group)";
  const min = coerceInt(g.min ?? g.minQty ?? (g.multiSelect === false ? 1 : 0), 0);
  let max = coerceInt(g.max ?? g.maxQty, 1);
  if (max < min) max = min;
  // Deliverect: min=0 max=0 on optional add-on groups means "pick any amount", not "pick zero".
  if (min === 0 && max === 0) {
    max = MODIFIER_MAX_SELECTIONS_UNBOUNDED;
  }

  const leafOptionSpecs = collectLeafOptionsFromGroupNode(g, lookups, issues, {
    entityPath: `/modifierGroupDefinitions/${gid}`,
    deliverectId: gid,
  });

  const options: MennyuCanonicalModifierOption[] = [];
  let oi = 0;
  for (let oiLoop = 0; oiLoop < leafOptionSpecs.length; oiLoop++) {
    const { node: o, oid } = leafOptionSpecs[oiLoop]!;

    const nestedGroupIds = walkNestedModifierGroupsFromOption(
      o,
      oid,
      productDeliverectId,
      registry,
      lookups,
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
  lookups: ModifierPayloadLookups,
  issues: MenuImportIssueRecord[],
  sortBase: number
): string[] {
  const entries = coerceSubProductEntries(getSubProductsRaw(optionRaw), issues, {
    entityPath: `/products/${productDeliverectId}/options/${parentOptionId}`,
    deliverectId: parentOptionId,
  });
  if (entries.length === 0) return [];

  const nestedIds: string[] = [];
  let order = sortBase;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const resolved = resolveSubProductEntryToGroupNode(entry, lookups, issues, {
      entityPath: `/products/${productDeliverectId}/options/${parentOptionId}/subProducts/${i}`,
      deliverectId: parentOptionId,
    });
    if (!resolved) continue;
    const { node: g, gid } = resolved;

    const group = buildModifierGroupTree(
      g,
      gid,
      parentOptionId,
      productDeliverectId,
      registry,
      lookups,
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

function collectStringishIdsFromArray(arr: unknown[]): string[] {
  const ids: string[] = [];
  for (const x of arr) {
    const s = asString(x) ?? (isRecord(x) ? firstDeliverectId(x) : undefined);
    if (s) ids.push(s);
  }
  return dedupePreserveOrder(ids);
}

function extractProductIdsFromCategory(
  c: Record<string, unknown>,
  issues: MenuImportIssueRecord[],
  categoryId: string
): string[] {
  const pids = c.productIds;
  if (Array.isArray(pids)) {
    return collectStringishIdsFromArray(pids);
  }

  const itemIds = c.itemIds;
  if (Array.isArray(itemIds)) {
    return collectStringishIdsFromArray(itemIds);
  }

  const menuItemIds = c.menuItemIds;
  if (Array.isArray(menuItemIds)) {
    return collectStringishIdsFromArray(menuItemIds);
  }

  const prods = c.products;
  if (Array.isArray(prods)) {
    const ids: string[] = [];
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

  const items = c.items;
  if (Array.isArray(items)) {
    const ids: string[] = [];
    for (const x of items) {
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
    if (ids.length > 0) return dedupePreserveOrder(ids);
  }

  issues.push({
    kind: "normalization",
    severity: "info",
    code: "CATEGORY_NO_PRODUCTS",
    message: `Category ${categoryId} has no productIds/itemIds/menuItemIds or products/items reference array; category will be empty.`,
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
