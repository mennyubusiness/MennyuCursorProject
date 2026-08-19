/**
 * Menu-source ownership reconciliation (Prisma domain logic).
 *
 * Usable from Next.js server code *and* trusted CLI scripts.
 * Next.js entrypoints should import `vendor-menu-source-ownership.service.ts`
 * (which enforces `server-only`). Do not import this module from Client Components.
 */
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
  snapshotIsNativeOpenOrderBuilder,
  snapshotServesOpenOrderAuthority,
  type ActiveMenuProvider,
} from "@/lib/vendor-menu-source";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";

export type MenuSourceOwnershipReconcileResult = {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  previousMenuSource: VendorMenuSource;
  menuSource: VendorMenuSource;
  provider: ActiveMenuProvider;
  archivedMenuVersionIds: string[];
  restoredMenuVersionIds: string[];
  softDisabledMenuItemCount: number;
  restoredAvailableMenuItemCount: number;
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

async function restoreAvailabilityFromAdoptedSnapshot(
  db: DbClient,
  vendorId: string,
  snapshot: unknown
): Promise<number> {
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) return 0;

  const availableIds = parsed.data.products
    .filter((p) => p.isAvailable)
    .map((p) => p.deliverectId);
  if (availableIds.length === 0) return 0;

  const result = await db.menuItem.updateMany({
    where: {
      vendorId,
      isAvailable: false,
      deliverectProductId: { in: availableIds },
    },
    data: { isAvailable: true },
  });
  return result.count;
}

/**
 * Align Vendor.menuSource with routing.
 *
 * Switching *to* Open Order Menu Builder adopts the live Square/Deliverect catalog:
 * origin metadata stays, published snapshot stays (or is unarchived), and
 * MenuItem.isAvailable is restored from that snapshot — not from provider prefix.
 *
 * Switching *to* Square or Deliverect still retires other catalogs so menus do not merge.
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
  const adoptingOpenOrder = provider === "open_order";

  if (menuSourceUpdated || vendor.orderRoutingMode !== input.orderRoutingMode) {
    await db.vendor.update({
      where: { id: input.vendorId },
      data: {
        orderRoutingMode: input.orderRoutingMode,
        menuSource: nextMenuSource,
      },
    });
  }

  const versions = await db.menuVersion.findMany({
    where: {
      vendorId: input.vendorId,
      state: { in: [MenuVersionState.published, MenuVersionState.archived] },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, state: true, canonicalSnapshot: true },
  });

  const archivedMenuVersionIds: string[] = [];
  const restoredMenuVersionIds: string[] = [];
  let restoredAvailableMenuItemCount = 0;
  let softDisabledMenuItemCount = 0;

  if (adoptingOpenOrder) {
    const hasNativePublished = versions.some(
      (row) =>
        row.state === MenuVersionState.published &&
        snapshotIsNativeOpenOrderBuilder(row.canonicalSnapshot)
    );

    if (!hasNativePublished) {
      const adopted =
        versions.find(
          (row) =>
            row.state === MenuVersionState.published &&
            snapshotServesOpenOrderAuthority(row.canonicalSnapshot)
        ) ??
        versions.find((row) => snapshotServesOpenOrderAuthority(row.canonicalSnapshot));

      if (adopted) {
        if (adopted.state !== MenuVersionState.published) {
          await db.menuVersion.update({
            where: { id: adopted.id },
            data: { state: MenuVersionState.published },
          });
          restoredMenuVersionIds.push(adopted.id);
        }
        restoredAvailableMenuItemCount = await restoreAvailabilityFromAdoptedSnapshot(
          db,
          input.vendorId,
          adopted.canonicalSnapshot
        );
      }
    }
  } else {
    const toArchive = versions.filter(
      (row) =>
        row.state === MenuVersionState.published &&
        !canonicalMatchesActiveProvider(row.canonicalSnapshot, provider)
    );

    if (toArchive.length > 0) {
      await db.menuVersion.updateMany({
        where: { id: { in: toArchive.map((r) => r.id) } },
        data: { state: MenuVersionState.archived },
      });
      archivedMenuVersionIds.push(...toArchive.map((r) => r.id));
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
      softDisabledMenuItemCount = staleIds.length;
    }
  }

  return {
    vendorId: input.vendorId,
    orderRoutingMode: input.orderRoutingMode,
    previousMenuSource,
    menuSource: nextMenuSource,
    provider,
    archivedMenuVersionIds,
    restoredMenuVersionIds,
    softDisabledMenuItemCount,
    restoredAvailableMenuItemCount,
    menuSourceUpdated,
  };
}

function vendorNeedsOpenOrderAdoptionRepair(input: {
  orderRoutingMode: VendorOrderRoutingMode;
  menuSource: VendorMenuSource;
  published: Array<{ id: string; canonicalSnapshot: unknown }>;
}): boolean {
  const expected = menuSourceForOrderRoutingMode(input.orderRoutingMode);
  const provider = activeMenuProviderForOrderRoutingMode(input.orderRoutingMode);
  if (provider !== "open_order") {
    const menuSourceMismatch = input.menuSource !== expected;
    const hasForeignPublished = input.published.some(
      (row) => !canonicalMatchesActiveProvider(row.canonicalSnapshot, provider)
    );
    return menuSourceMismatch || hasForeignPublished;
  }

  const menuSourceMismatch = input.menuSource !== expected;
  const hasNativePublished = input.published.some((row) =>
    snapshotIsNativeOpenOrderBuilder(row.canonicalSnapshot)
  );
  // Tablet vendors without a native builder publish need adoption/restore even when
  // a Square/Deliverect catalog is still published (items may have been origin-disabled).
  return menuSourceMismatch || !hasNativePublished;
}

/**
 * Repair vendors whose routing mode and persisted menuSource disagree, or tablet vendors
 * whose imported Square/Deliverect catalog was archived/disabled during a prior switch.
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

    const published = await prisma.menuVersion.findMany({
      where: { vendorId: vendor.id, state: MenuVersionState.published },
      select: { id: true, canonicalSnapshot: true },
    });

    if (
      !vendorNeedsOpenOrderAdoptionRepair({
        orderRoutingMode: vendor.orderRoutingMode,
        menuSource: vendor.menuSource,
        published,
      })
    ) {
      continue;
    }

    if (dryRun) {
      repaired.push({
        vendorId: vendor.id,
        orderRoutingMode: vendor.orderRoutingMode,
        previousMenuSource: vendor.menuSource,
        menuSource: expected,
        provider,
        archivedMenuVersionIds: published
          .filter((row) =>
            provider === "open_order"
              ? false
              : !canonicalMatchesActiveProvider(row.canonicalSnapshot, provider)
          )
          .map((r) => r.id),
        restoredMenuVersionIds: [],
        softDisabledMenuItemCount: 0,
        restoredAvailableMenuItemCount: 0,
        menuSourceUpdated: vendor.menuSource !== expected,
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
