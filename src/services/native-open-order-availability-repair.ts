import { isOpenOrderProductDeliverectId } from "@/lib/open-order-menu-ids";
import { snapshotIsNativeOpenOrderBuilder } from "@/lib/vendor-menu-source";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";

export type MenuSourceRepairType =
  | "adopt_provider_catalog"
  | "resume_native_catalog"
  | "repair_poisoned_native_availability"
  | "retire_foreign_published"
  | "no_repair_needed"
  | "ambiguous_history";

export type NativeProductAvailabilityChange = {
  deliverectId: string;
  name: string | null;
  from: boolean;
  to: boolean;
};

export type NativeSnapshotLite = {
  id: string;
  publishedAt: Date | null;
  createdAt: Date;
  snapshot: unknown;
};

export type PoisonedNativeAvailabilityPlan = {
  repairType: Extract<
    MenuSourceRepairType,
    "repair_poisoned_native_availability" | "no_repair_needed" | "ambiguous_history"
  >;
  reason: string;
  currentPublishedVersionId: string | null;
  historicalSnapshotId: string | null;
  historicalPublishedAt: string | null;
  nativeItemCount: number;
  currentAvailable: number;
  historicalAvailable: number;
  changes: NativeProductAvailabilityChange[];
};

function snapshotTime(row: NativeSnapshotLite): number {
  return (row.publishedAt ?? row.createdAt).getTime();
}

export function nativeProductsFromSnapshot(
  snapshot: unknown
): Array<{ deliverectId: string; name: string; isAvailable: boolean }> | null {
  if (!snapshotIsNativeOpenOrderBuilder(snapshot)) return null;
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return null;
  return parsed.data.products
    .filter((p) => isOpenOrderProductDeliverectId(p.deliverectId))
    .map((p) => ({
      deliverectId: p.deliverectId,
      name: p.name,
      isAvailable: p.isAvailable,
    }));
}

function allCurrentIdsPresent(
  currentIds: string[],
  historical: Array<{ deliverectId: string }>
): boolean {
  const hist = new Set(historical.map((p) => p.deliverectId));
  return currentIds.every((id) => hist.has(id));
}

/**
 * Last known-good native snapshot: newest earlier native catalog that still contains
 * every current native product id and has at least one of those products available.
 * Poisoned snapshots (all overlapping products unavailable) are skipped.
 */
export function evaluatePoisonedNativeAvailability(input: {
  currentPublished: NativeSnapshotLite | null;
  nativeHistory: NativeSnapshotLite[];
}): PoisonedNativeAvailabilityPlan {
  const empty = (repairType: PoisonedNativeAvailabilityPlan["repairType"], reason: string) => ({
    repairType,
    reason,
    currentPublishedVersionId: input.currentPublished?.id ?? null,
    historicalSnapshotId: null,
    historicalPublishedAt: null,
    nativeItemCount: 0,
    currentAvailable: 0,
    historicalAvailable: 0,
    changes: [] as NativeProductAvailabilityChange[],
  });

  if (!input.currentPublished) {
    return empty("no_repair_needed", "No published native Open Order catalog.");
  }

  const currentProducts = nativeProductsFromSnapshot(input.currentPublished.snapshot);
  if (!currentProducts || currentProducts.length === 0) {
    return empty("no_repair_needed", "Published native snapshot has no Open Order products.");
  }

  const currentAvailable = currentProducts.filter((p) => p.isAvailable).length;
  const currentIds = currentProducts.map((p) => p.deliverectId);

  if (currentAvailable > 0) {
    return {
      ...empty(
        "no_repair_needed",
        "Published native catalog already has available products; not treating as transition poison."
      ),
      nativeItemCount: currentProducts.length,
      currentAvailable,
    };
  }

  const history = [...input.nativeHistory]
    .filter((row) => row.id !== input.currentPublished!.id)
    .sort((a, b) => snapshotTime(b) - snapshotTime(a));

  let lastGood: NativeSnapshotLite | null = null;
  let lastGoodProducts: Array<{ deliverectId: string; name: string; isAvailable: boolean }> | null =
    null;

  for (const row of history) {
    const products = nativeProductsFromSnapshot(row.snapshot);
    if (!products) continue;
    if (!allCurrentIdsPresent(currentIds, products)) continue;
    const overlappingAvailable = currentIds.filter(
      (id) => products.find((p) => p.deliverectId === id)?.isAvailable === true
    ).length;
    if (overlappingAvailable === 0) continue;
    lastGood = row;
    lastGoodProducts = products;
    break;
  }

  if (!lastGood || !lastGoodProducts) {
    return {
      ...empty(
        "no_repair_needed",
        "No earlier native snapshot with these same products available. Treating current all-unavailable as intentional or unrecoverable."
      ),
      nativeItemCount: currentProducts.length,
      currentAvailable,
    };
  }

  const historicalAvailable = currentIds.filter(
    (id) => lastGoodProducts.find((p) => p.deliverectId === id)?.isAvailable === true
  ).length;

  const changes: NativeProductAvailabilityChange[] = [];
  for (const current of currentProducts) {
    const historical = lastGoodProducts.find((p) => p.deliverectId === current.deliverectId);
    if (!historical) continue;
    if (historical.isAvailable === current.isAvailable) continue;
    changes.push({
      deliverectId: current.deliverectId,
      name: current.name,
      from: current.isAvailable,
      to: historical.isAvailable,
    });
  }

  if (changes.length === 0) {
    return {
      repairType: "no_repair_needed",
      reason: "Historical snapshot matches current availability.",
      currentPublishedVersionId: input.currentPublished.id,
      historicalSnapshotId: lastGood.id,
      historicalPublishedAt: lastGood.publishedAt?.toISOString() ?? lastGood.createdAt.toISOString(),
      nativeItemCount: currentProducts.length,
      currentAvailable,
      historicalAvailable,
      changes: [],
    };
  }

  return {
    repairType: "repair_poisoned_native_availability",
    reason:
      "Current published native catalog is entirely unavailable, but the latest earlier native snapshot containing the same product ids still has available items. This matches routing-transition poison, not a missing catalog.",
    currentPublishedVersionId: input.currentPublished.id,
    historicalSnapshotId: lastGood.id,
    historicalPublishedAt: lastGood.publishedAt?.toISOString() ?? lastGood.createdAt.toISOString(),
    nativeItemCount: currentProducts.length,
    currentAvailable,
    historicalAvailable,
    changes,
  };
}

export type NativeLiveRowAction = {
  deliverectId: string;
  name: string | null;
  snapshotAvailable: boolean;
  matchingLiveCount: number;
  liveAvailableCount: number;
  action: "create" | "update_availability" | "none";
  from: boolean | null;
  to: boolean;
};

export type NativeLiveReconciliationPlan = {
  matchingLiveMenuItemCount: number;
  liveAvailableCount: number;
  snapshotAvailableCount: number;
  nativeItemCount: number;
  rowsToCreate: NativeLiveRowAction[];
  rowsToUpdateAvailability: NativeLiveRowAction[];
  wouldMutateLive: boolean;
  expectedAvailableItemCount: number;
  actions: NativeLiveRowAction[];
};

export function planNativeLiveReconciliation(
  products: Array<{ deliverectId: string; name: string; isAvailable: boolean }>,
  liveRows: Array<{ deliverectProductId: string | null; isAvailable: boolean }>
): NativeLiveReconciliationPlan {
  const byProduct = new Map<string, Array<{ isAvailable: boolean }>>();
  for (const row of liveRows) {
    if (!row.deliverectProductId) continue;
    const list = byProduct.get(row.deliverectProductId) ?? [];
    list.push({ isAvailable: row.isAvailable });
    byProduct.set(row.deliverectProductId, list);
  }

  const actions: NativeLiveRowAction[] = products.map((product) => {
    const matching = byProduct.get(product.deliverectId) ?? [];
    const liveAvailableCount = matching.filter((r) => r.isAvailable).length;
    const mismatch = matching.some((r) => r.isAvailable !== product.isAvailable);
    let action: NativeLiveRowAction["action"] = "none";
    if (matching.length === 0) action = "create";
    else if (mismatch) action = "update_availability";
    return {
      deliverectId: product.deliverectId,
      name: product.name,
      snapshotAvailable: product.isAvailable,
      matchingLiveCount: matching.length,
      liveAvailableCount,
      action,
      from: matching.length === 0 ? null : matching.every((r) => r.isAvailable),
      to: product.isAvailable,
    };
  });

  const rowsToCreate = actions.filter((a) => a.action === "create");
  const rowsToUpdateAvailability = actions.filter((a) => a.action === "update_availability");
  const matchingLiveMenuItemCount = actions.reduce((n, a) => n + a.matchingLiveCount, 0);
  const liveAvailableCount = actions.reduce((n, a) => n + a.liveAvailableCount, 0);
  const snapshotAvailableCount = products.filter((p) => p.isAvailable).length;

  return {
    matchingLiveMenuItemCount,
    liveAvailableCount,
    snapshotAvailableCount,
    nativeItemCount: products.length,
    rowsToCreate,
    rowsToUpdateAvailability,
    wouldMutateLive: rowsToCreate.length > 0 || rowsToUpdateAvailability.length > 0,
    expectedAvailableItemCount: snapshotAvailableCount,
    actions,
  };
}

export function patchNativeSnapshotAvailability(
  snapshot: unknown,
  changes: NativeProductAvailabilityChange[]
): unknown | null {
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return null;
  const byId = new Map(changes.map((c) => [c.deliverectId, c.to]));
  return {
    ...parsed.data,
    products: parsed.data.products.map((p) =>
      byId.has(p.deliverectId) ? { ...p, isAvailable: byId.get(p.deliverectId)! } : p
    ),
  };
}
