/**
 * ACTIVE vs RETIRED live menu rows (no deletes).
 *
 * ACTIVE: MenuItem row is the single operational representative for its Deliverect product key
 * in the latest published canonical snapshot (PLU-aligned when the snapshot defines a PLU),
 * chosen by latest `updatedAt` when duplicates exist.
 *
 * RETIRED: duplicate rows for the same key, rows whose `deliverectProductId` is not in the
 * published snapshot, or rows that fail PLU alignment — ignored for customer menu, cart,
 * availability, snooze targets, and operational lookups. Historical order/cart FKs unchanged.
 */
import "server-only";

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { requestCache } from "@/lib/request-cache";
import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  mennyuCanonicalMenuSchema,
  type MennyuCanonicalMenu,
  type MennyuCanonicalProduct,
} from "@/domain/menu-import/canonical.schema";

export type ActiveDeliverectSets = {
  productDeliverectIds: Set<string>;
  /** Option deliverect ids (graph ids) from canonical modifier definitions. */
  modifierOptionDeliverectIds: Set<string>;
  /** Modifier group deliverect ids from canonical. */
  modifierGroupDeliverectIds: Set<string>;
  pluByProductDeliverectId: Map<string, string | null | undefined>;
};

export function operationalMenuCacheTag(vendorId: string): string {
  return `operational-menu:${vendorId}`;
}

/** Invalidate cached operational menu/modifier ids after menu publish or admin menu changes. */
export function revalidateOperationalMenuCacheForVendor(vendorId: string): void {
  revalidateTag(operationalMenuCacheTag(vendorId));
}

export function buildActiveDeliverectSets(menu: MennyuCanonicalMenu): ActiveDeliverectSets {
  const productDeliverectIds = new Set(menu.products.map((p) => p.deliverectId));
  const pluByProductDeliverectId = new Map<string, string | null | undefined>();
  for (const p of menu.products) {
    pluByProductDeliverectId.set(p.deliverectId, p.plu);
  }
  const modifierGroupDeliverectIds = new Set(menu.modifierGroupDefinitions.map((g) => g.deliverectId));
  const modifierOptionDeliverectIds = new Set<string>();
  for (const g of menu.modifierGroupDefinitions) {
    for (const o of g.options) {
      modifierOptionDeliverectIds.add(o.deliverectId);
    }
  }
  return {
    productDeliverectIds,
    modifierOptionDeliverectIds,
    modifierGroupDeliverectIds,
    pluByProductDeliverectId,
  };
}

export type MenuItemPickRow = {
  id: string;
  deliverectProductId: string | null;
  deliverectPlu: string | null;
  updatedAt: Date;
};

/**
 * PLU-filtered, sorted pools (winner first) per canonical product id in the published snapshot.
 * Shared by winner selection and customer menu so behavior cannot drift.
 */
export function computeOperationalProductPools<T extends MenuItemPickRow>(
  menu: MennyuCanonicalMenu,
  rows: T[],
  ctx: { vendorId: string }
): Map<string, T[]> {
  const productByDeliverectId = new Map(menu.products.map((p) => [p.deliverectId, p]));
  const byPid = new Map<string, T[]>();
  for (const r of rows) {
    if (!r.deliverectProductId) continue;
    if (!productByDeliverectId.has(r.deliverectProductId)) continue;
    const list = byPid.get(r.deliverectProductId) ?? [];
    list.push(r);
    byPid.set(r.deliverectProductId, list);
  }

  const pools = new Map<string, T[]>();

  for (const [pid, list] of byPid) {
    const def = productByDeliverectId.get(pid)!;
    let pool = list;
    if (def.plu != null && def.plu !== "") {
      pool = list.filter((r) => r.deliverectPlu === def.plu);
    }
    if (pool.length === 0) continue;
    pool.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    pools.set(pid, pool);
    if (pool.length > 1) {
      console.warn("[menu-active-scope] duplicate operational candidates for product key; using latest updatedAt", {
        vendorId: ctx.vendorId,
        deliverectProductId: pid,
        duplicateCount: pool.length,
      });
    }
  }

  return pools;
}

/**
 * Pick operational MenuItem row id per published product id (PLU filter + latest updatedAt).
 */
export function pickOperationalMenuItemWinners(
  menu: MennyuCanonicalMenu,
  rows: MenuItemPickRow[],
  ctx: { vendorId: string }
): { winnerIds: Set<string>; duplicateProductWarnings: Array<{ deliverectProductId: string; count: number }> } {
  const pools = computeOperationalProductPools(menu, rows, ctx);
  const winnerIds = new Set<string>();
  const duplicateProductWarnings: Array<{ deliverectProductId: string; count: number }> = [];

  for (const [pid, pool] of pools) {
    winnerIds.add(pool[0]!.id);
    if (pool.length > 1) {
      duplicateProductWarnings.push({ deliverectProductId: pid, count: pool.length });
    }
  }

  return { winnerIds, duplicateProductWarnings };
}

type PublishedMenuMeta = {
  menu: MennyuCanonicalMenu | null;
  menuVersionId: string | null;
};

async function loadPublishedMenuMeta(vendorId: string): Promise<PublishedMenuMeta> {
  const published = await prisma.menuVersion.findFirst({
    where: { vendorId, state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, canonicalSnapshot: true },
  });
  if (!published?.canonicalSnapshot) {
    return { menu: null, menuVersionId: null };
  }
  const parsed = mennyuCanonicalMenuSchema.safeParse(published.canonicalSnapshot);
  return {
    menu: parsed.success ? parsed.data : null,
    menuVersionId: published.id,
  };
}

async function computeOperationalMenuItemIdsUncached(vendorId: string): Promise<string[]> {
  const { menu, menuVersionId } = await loadPublishedMenuMeta(vendorId);
  if (!menu) {
    const set = await fallbackWinnersNoPublishedMenu(vendorId);
    return [...set];
  }

  const productIds = [...new Set(menu.products.map((p) => p.deliverectId))];
  if (productIds.length === 0) return [];

  const rows = await prisma.menuItem.findMany({
    where: { vendorId, deliverectProductId: { in: productIds } },
    select: { id: true, deliverectProductId: true, deliverectPlu: true, updatedAt: true },
  });

  const { winnerIds } = pickOperationalMenuItemWinners(menu, rows, { vendorId });
  return [...winnerIds];
}

function cachedOperationalMenuItemIdsForPublishedMenu(
  vendorId: string,
  menuVersionId: string
): Promise<string[]> {
  return unstable_cache(
    async () => computeOperationalMenuItemIdsUncached(vendorId),
    ["operational-menu-item-ids", vendorId, menuVersionId],
    { tags: [operationalMenuCacheTag(vendorId)] }
  )();
}

async function resolveOperationalMenuItemIds(vendorId: string): Promise<Set<string>> {
  const { menuVersionId } = await loadPublishedMenuMeta(vendorId);
  if (!menuVersionId) {
    return fallbackWinnersNoPublishedMenu(vendorId);
  }
  const ids = await cachedOperationalMenuItemIdsForPublishedMenu(vendorId, menuVersionId);
  return new Set(ids);
}

/**
 * MenuItem row ids that are operationally active for this vendor (see module doc).
 * Request-deduped; cross-request cache keyed by vendor + published menu version.
 */
export const getOperationalMenuItemIdsForVendor = requestCache(
  async (vendorId: string): Promise<Set<string>> => resolveOperationalMenuItemIds(vendorId)
);

/** When no published snapshot exists, use latest row per deliverectProductId (legacy). */
async function fallbackWinnersNoPublishedMenu(vendorId: string): Promise<Set<string>> {
  const rows = await prisma.menuItem.findMany({
    where: { vendorId, deliverectProductId: { not: null } },
    select: { id: true, deliverectProductId: true, deliverectPlu: true, updatedAt: true },
  });
  const byPid = new Map<string, MenuItemPickRow[]>();
  for (const r of rows) {
    if (!r.deliverectProductId) continue;
    const list = byPid.get(r.deliverectProductId) ?? [];
    list.push(r);
    byPid.set(r.deliverectProductId, list);
  }
  const winners = new Set<string>();
  for (const [pid, list] of byPid) {
    const sorted = [...list].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    winners.add(sorted[0]!.id);
    if (list.length > 1) {
      console.warn("[menu-active-scope] duplicate MenuItem for deliverectProductId without published menu baseline", {
        vendorId,
        deliverectProductId: pid,
        duplicateCount: list.length,
      });
    }
  }
  return winners;
}

export async function isMenuItemIdOperational(vendorId: string, menuItemId: string): Promise<boolean> {
  const winners = await getOperationalMenuItemIdsForVendor(vendorId);
  return winners.has(menuItemId);
}

async function computeOperationalModifierOptionIdsUncached(vendorId: string): Promise<string[]> {
  const { menu } = await loadPublishedMenuMeta(vendorId);
  if (!menu) {
    const opts = await prisma.modifierOption.findMany({
      where: { modifierGroup: { vendorId } },
      select: { id: true },
    });
    return opts.map((o) => o.id);
  }

  const groupIds = [...menu.modifierGroupDefinitions.map((g) => g.deliverectId)];
  if (groupIds.length === 0) return [];

  const dbGroups = await prisma.modifierGroup.findMany({
    where: { vendorId, deliverectModifierGroupId: { in: groupIds } },
    select: { id: true, deliverectModifierGroupId: true },
  });
  const groupByDeliverect = new Map(dbGroups.map((g) => [g.deliverectModifierGroupId!, g.id]));

  const ids = new Set<string>();

  for (const gdef of menu.modifierGroupDefinitions) {
    const dbGid = groupByDeliverect.get(gdef.deliverectId);
    if (!dbGid) continue;
    for (const odef of gdef.options) {
      const matches = await prisma.modifierOption.findMany({
        where: { modifierGroupId: dbGid, deliverectModifierId: odef.deliverectId },
        select: { id: true, updatedAt: true },
      });
      if (matches.length === 0) continue;
      matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      ids.add(matches[0]!.id);
      if (matches.length > 1) {
        console.warn("[menu-active-scope] duplicate ModifierOption for same deliverectModifierId in group", {
          vendorId,
          modifierGroupDeliverectId: gdef.deliverectId,
          deliverectModifierId: odef.deliverectId,
          duplicateCount: matches.length,
        });
      }
    }
  }

  return [...ids];
}

function cachedOperationalModifierOptionIdsForPublishedMenu(
  vendorId: string,
  menuVersionId: string
): Promise<string[]> {
  return unstable_cache(
    async () => computeOperationalModifierOptionIdsUncached(vendorId),
    ["operational-modifier-option-ids", vendorId, menuVersionId],
    { tags: [operationalMenuCacheTag(vendorId)] }
  )();
}

async function resolveOperationalModifierOptionIds(vendorId: string): Promise<Set<string>> {
  const { menuVersionId } = await loadPublishedMenuMeta(vendorId);
  if (!menuVersionId) {
    const ids = await computeOperationalModifierOptionIdsUncached(vendorId);
    return new Set(ids);
  }
  const ids = await cachedOperationalModifierOptionIdsForPublishedMenu(vendorId, menuVersionId);
  return new Set(ids);
}

/**
 * ModifierOption PK ids that are operational: canonical (group, option) pair resolved to DB rows,
 * winner = latest `updatedAt` per (modifierGroupId, deliverectModifierId).
 */
export const getOperationalModifierOptionIdsForVendor = requestCache(
  async (vendorId: string): Promise<Set<string>> => resolveOperationalModifierOptionIds(vendorId)
);

export async function isModifierOptionIdOperational(vendorId: string, modifierOptionId: string): Promise<boolean> {
  const set = await getOperationalModifierOptionIdsForVendor(vendorId);
  return set.has(modifierOptionId);
}
