import "server-only";

import {
  MenuVersionState,
  type Prisma,
  type VendorMenuSource,
  type VendorOrderRoutingMode,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { isOpenOrderProductDeliverectId } from "@/lib/open-order-menu-ids";
import { isSquareProductDeliverectId } from "@/lib/integrations/square/square-menu-ids";
import {
  activeMenuProviderForOrderRoutingMode,
  canonicalMatchesActiveProvider,
  menuSourceForOrderRoutingMode,
  type ActiveMenuProvider,
} from "@/lib/vendor-menu-source";

export type MenuSourceOwnershipReconcileResult = {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  previousMenuSource: VendorMenuSource;
  menuSource: VendorMenuSource;
  provider: ActiveMenuProvider;
  archivedMenuVersionIds: string[];
  softDisabledMenuItemCount: number;
  menuSourceUpdated: boolean;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

function menuItemShouldRemainAvailable(
  deliverectProductId: string | null | undefined,
  provider: ActiveMenuProvider
): boolean {
  if (!deliverectProductId) return false;
  const isOpenOrder = isOpenOrderProductDeliverectId(deliverectProductId);
  const isSquare = isSquareProductDeliverectId(deliverectProductId);
  if (provider === "open_order") return isOpenOrder;
  if (provider === "square") return isSquare;
  return !isOpenOrder && !isSquare;
}

/**
 * Align Vendor.menuSource with routing, archive published MenuVersions from other providers,
 * and soft-disable live MenuItems that are not part of the active provider catalog.
 *
 * Historical rows are retained (archived / unavailable) — never deleted.
 */
export async function reconcileVendorMenuSourceOwnership(
  input: {
    vendorId: string;
    orderRoutingMode: VendorOrderRoutingMode;
  },
  db: DbClient = prisma
): Promise<MenuSourceOwnershipReconcileResult> {
  const vendor = await db.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, menuSource: true, orderRoutingMode: true },
  });
  if (!vendor) {
    throw new Error(`Vendor not found: ${input.vendorId}`);
  }

  const nextMenuSource = menuSourceForOrderRoutingMode(input.orderRoutingMode);
  const provider = activeMenuProviderForOrderRoutingMode(input.orderRoutingMode);
  const previousMenuSource = vendor.menuSource;
  const menuSourceUpdated = previousMenuSource !== nextMenuSource;

  if (menuSourceUpdated || vendor.orderRoutingMode !== input.orderRoutingMode) {
    await db.vendor.update({
      where: { id: input.vendorId },
      data: {
        orderRoutingMode: input.orderRoutingMode,
        menuSource: nextMenuSource,
      },
    });
  }

  const published = await db.menuVersion.findMany({
    where: {
      vendorId: input.vendorId,
      state: MenuVersionState.published,
    },
    select: { id: true, canonicalSnapshot: true },
  });

  const toArchive = published.filter(
    (row) => !canonicalMatchesActiveProvider(row.canonicalSnapshot, provider)
  );

  if (toArchive.length > 0) {
    await db.menuVersion.updateMany({
      where: { id: { in: toArchive.map((r) => r.id) } },
      data: { state: MenuVersionState.archived },
    });
  }

  const items = await db.menuItem.findMany({
    where: {
      vendorId: input.vendorId,
      isAvailable: true,
      deliverectProductId: { not: null },
    },
    select: { id: true, deliverectProductId: true },
  });

  const staleIds = items
    .filter((row) => !menuItemShouldRemainAvailable(row.deliverectProductId, provider))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    await db.menuItem.updateMany({
      where: { id: { in: staleIds } },
      data: { isAvailable: false },
    });
  }

  return {
    vendorId: input.vendorId,
    orderRoutingMode: input.orderRoutingMode,
    previousMenuSource,
    menuSource: nextMenuSource,
    provider,
    archivedMenuVersionIds: toArchive.map((r) => r.id),
    softDisabledMenuItemCount: staleIds.length,
    menuSourceUpdated,
  };
}

/**
 * Repair vendors whose routing mode and persisted menuSource disagree, or who still have
 * a published MenuVersion from a non-active provider.
 */
export async function repairInconsistentVendorMenuSourceOwnership(input?: {
  vendorId?: string;
  dryRun?: boolean;
}): Promise<{
  scanned: number;
  repaired: MenuSourceOwnershipReconcileResult[];
  dryRun: boolean;
}> {
  const dryRun = Boolean(input?.dryRun);
  const vendors = await prisma.vendor.findMany({
    where: {
      deletedAt: null,
      ...(input?.vendorId ? { id: input.vendorId } : {}),
    },
    select: { id: true, orderRoutingMode: true, menuSource: true },
  });

  const repaired: MenuSourceOwnershipReconcileResult[] = [];

  for (const vendor of vendors) {
    const expected = menuSourceForOrderRoutingMode(vendor.orderRoutingMode);
    const provider = activeMenuProviderForOrderRoutingMode(vendor.orderRoutingMode);
    const menuSourceMismatch = vendor.menuSource !== expected;

    const published = await prisma.menuVersion.findMany({
      where: { vendorId: vendor.id, state: MenuVersionState.published },
      select: { id: true, canonicalSnapshot: true },
    });
    const hasForeignPublished = published.some(
      (row) => !canonicalMatchesActiveProvider(row.canonicalSnapshot, provider)
    );

    if (!menuSourceMismatch && !hasForeignPublished) continue;

    if (dryRun) {
      repaired.push({
        vendorId: vendor.id,
        orderRoutingMode: vendor.orderRoutingMode,
        previousMenuSource: vendor.menuSource,
        menuSource: expected,
        provider,
        archivedMenuVersionIds: published
          .filter((row) => !canonicalMatchesActiveProvider(row.canonicalSnapshot, provider))
          .map((r) => r.id),
        softDisabledMenuItemCount: 0,
        menuSourceUpdated: menuSourceMismatch,
      });
      continue;
    }

    const result = await prisma.$transaction((tx) =>
      reconcileVendorMenuSourceOwnership(
        {
          vendorId: vendor.id,
          orderRoutingMode: vendor.orderRoutingMode,
        },
        tx
      )
    );
    repaired.push(result);
  }

  return { scanned: vendors.length, repaired, dryRun };
}
