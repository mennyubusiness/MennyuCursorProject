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
import {
  activeMenuProviderForOrderRoutingMode,
  canonicalMatchesActiveProvider,
  menuSourceForOrderRoutingMode,
  snapshotIsNativeOpenOrderBuilder,
  type ActiveMenuProvider,
} from "@/lib/vendor-menu-source";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { payloadFingerprint } from "@/lib/menu-import-payload-hash";
import {
  evaluatePoisonedNativeAvailability,
  nativeProductsFromSnapshot,
  patchNativeSnapshotAvailability,
  planNativeLiveReconciliation,
  type MenuSourceRepairType,
  type NativeLiveRowAction,
  type NativeProductAvailabilityChange,
  type PoisonedNativeAvailabilityPlan,
} from "@/services/native-open-order-availability-repair";
import { applyCanonicalMenuToLiveTables } from "@/services/menu-apply-canonical-live";
import {
  adoptionSourceLabel,
  pickAdoptedProviderCatalog,
  providerAdoptionWouldMutate,
  providerOriginsAmong,
  selectionReasonForAdoptedCatalog,
  snapshotAvailableProductIds,
  snapshotProductIds,
  toSelectedProviderCatalog,
  type CatalogAdoptionSource,
  type SelectedProviderCatalog,
} from "@/services/vendor-menu-catalog-adoption";

export type { MenuSourceRepairType, NativeProductAvailabilityChange };

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

export type MenuSourceOwnershipRepairReport = MenuSourceOwnershipReconcileResult & {
  repairType: MenuSourceRepairType;
  reason: string;
  vendorName: string | null;
  /** Current menu authority from routing (not the catalog being adopted). */
  currentAuthority: ActiveMenuProvider;
  adoptionSource: CatalogAdoptionSource | null;
  adoptionSourceLabel: "Square" | "Deliverect" | "other" | null;
  selectedCatalog: SelectedProviderCatalog | null;
  matchingLiveMenuItemCount: number;
  menuItemsThatWouldBeRestored: number;
  multiplePlausibleProviderCatalogs: boolean;
  plausibleProviderOrigins: CatalogAdoptionSource[];
  selectionReason: string | null;
  currentPublishedVersionId: string | null;
  historicalSnapshotId: string | null;
  historicalPublishedAt: string | null;
  nativeItemCount: number;
  currentAvailable: number;
  historicalAvailable: number;
  productsToRestore: NativeProductAvailabilityChange[];
  liveAvailableCount: number;
  liveRowsToCreate: NativeLiveRowAction[];
  liveRowsToUpdateAvailability: NativeLiveRowAction[];
  expectedAvailableItemCount: number;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

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

async function rematerializeNativeFromSnapshot(
  db: DbClient,
  vendorId: string,
  snapshot: unknown,
  source: string
): Promise<void> {
  const parsed = openOrderCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new Error(`Native snapshot failed schema validation for vendor ${vendorId}`);
  }
  await applyCanonicalMenuToLiveTables(db as Prisma.TransactionClient, vendorId, parsed.data, {
    source,
  });
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
    const nativeRows = versions.filter((row) => snapshotIsNativeOpenOrderBuilder(row.canonicalSnapshot));
    const nativePublished = nativeRows.find((row) => row.state === MenuVersionState.published);
    const nativeToResume = nativePublished ?? nativeRows[0] ?? null;

    if (nativeToResume) {
      if (nativeToResume.state !== MenuVersionState.published) {
        await db.menuVersion.update({
          where: { id: nativeToResume.id },
          data: { state: MenuVersionState.published },
        });
        restoredMenuVersionIds.push(nativeToResume.id);
      }
      const extraPublished = versions.filter(
        (row) =>
          row.state === MenuVersionState.published &&
          row.id !== nativeToResume.id
      );
      if (extraPublished.length > 0) {
        await db.menuVersion.updateMany({
          where: { id: { in: extraPublished.map((r) => r.id) } },
          data: { state: MenuVersionState.archived },
        });
        archivedMenuVersionIds.push(...extraPublished.map((r) => r.id));
      }
      await rematerializeNativeFromSnapshot(
        db,
        input.vendorId,
        nativeToResume.canonicalSnapshot,
        "resume_native_catalog"
      );
    } else {
      const adopted = pickAdoptedProviderCatalog(versions);

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
    // Catalog retirement is MenuVersion state only. Do not rewrite MenuItem.isAvailable —
    // that field is persistent authoring/sold-out state, including native oo:prod: rows.
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
  return menuSourceMismatch || !hasNativePublished;
}

function emptyRepairFields() {
  return {
    vendorName: null as string | null,
    currentAuthority: "open_order" as ActiveMenuProvider,
    adoptionSource: null as CatalogAdoptionSource | null,
    adoptionSourceLabel: null as "Square" | "Deliverect" | "other" | null,
    selectedCatalog: null as SelectedProviderCatalog | null,
    matchingLiveMenuItemCount: 0,
    menuItemsThatWouldBeRestored: 0,
    multiplePlausibleProviderCatalogs: false,
    plausibleProviderOrigins: [] as CatalogAdoptionSource[],
    selectionReason: null as string | null,
    currentPublishedVersionId: null as string | null,
    historicalSnapshotId: null as string | null,
    historicalPublishedAt: null as string | null,
    nativeItemCount: 0,
    currentAvailable: 0,
    historicalAvailable: 0,
    productsToRestore: [] as NativeProductAvailabilityChange[],
    liveAvailableCount: 0,
    liveRowsToCreate: [] as NativeLiveRowAction[],
    liveRowsToUpdateAvailability: [] as NativeLiveRowAction[],
    expectedAvailableItemCount: 0,
  };
}

function reportFromReconcile(
  row: MenuSourceOwnershipReconcileResult,
  repairType: MenuSourceRepairType,
  reason: string,
  extras?: Partial<MenuSourceOwnershipRepairReport>
): MenuSourceOwnershipRepairReport {
  return {
    ...row,
    repairType,
    reason,
    ...emptyRepairFields(),
    currentAuthority: row.provider,
    ...extras,
  };
}

async function countAdoptionItemImpact(
  vendorId: string,
  snapshot: unknown
): Promise<{ matchingLiveMenuItemCount: number; menuItemsThatWouldBeRestored: number }> {
  const productIds = snapshotProductIds(snapshot);
  const availableIds = snapshotAvailableProductIds(snapshot);
  const matchingLiveMenuItemCount =
    productIds.length === 0
      ? 0
      : await prisma.menuItem.count({
          where: { vendorId, deliverectProductId: { in: productIds } },
        });
  const menuItemsThatWouldBeRestored =
    availableIds.length === 0
      ? 0
      : await prisma.menuItem.count({
          where: {
            vendorId,
            isAvailable: false,
            deliverectProductId: { in: availableIds },
          },
        });
  return { matchingLiveMenuItemCount, menuItemsThatWouldBeRestored };
}

async function applyPoisonedNativeAvailabilityRepair(
  db: DbClient,
  vendorId: string,
  currentPublished: {
    id: string;
    canonicalSnapshot: unknown;
    canonicalSnapshotSha256: string;
  },
  plan: PoisonedNativeAvailabilityPlan
): Promise<{ newMenuVersionId: string; restoredCount: number }> {
  const toAvailable = plan.changes.filter((c) => c.to).map((c) => c.deliverectId);
  if (toAvailable.length > 0) {
    await db.menuItem.updateMany({
      where: {
        vendorId,
        isAvailable: false,
        deliverectProductId: { in: toAvailable },
      },
      data: { isAvailable: true },
    });
  }

  const patched = patchNativeSnapshotAvailability(currentPublished.canonicalSnapshot, plan.changes);
  if (!patched) {
    throw new Error(`Unable to patch native snapshot for vendor ${vendorId}`);
  }

  await db.menuVersion.update({
    where: { id: currentPublished.id },
    data: { state: MenuVersionState.archived },
  });

  const created = await db.menuVersion.create({
    data: {
      vendorId,
      state: MenuVersionState.published,
      canonicalSnapshot: patched as object,
      canonicalSnapshotSha256: payloadFingerprint(patched),
      publishedAt: new Date(),
      publishedBy: "system:repair-poisoned-native-availability",
      previousPublishedVersionId: currentPublished.id,
    },
    select: { id: true },
  });

  await rematerializeNativeFromSnapshot(db, vendorId, patched, "repair_poisoned_native_availability");

  return { newMenuVersionId: created.id, restoredCount: toAvailable.length };
}

/**
 * Repair vendors whose routing mode and persisted menuSource disagree, tablet vendors
 * whose imported catalog was archived, or native Open Order menus whose availability
 * was poisoned by an earlier catalog-retirement write.
 */
export async function repairInconsistentVendorMenuSourceOwnership(input?: {
  vendorId?: string;
  dryRun?: boolean;
}): Promise<{
  scanned: number;
  repaired: MenuSourceOwnershipRepairReport[];
  reports: MenuSourceOwnershipRepairReport[];
  dryRun: boolean;
}> {
  const dryRun = Boolean(input?.dryRun);
  const targeted = Boolean(input?.vendorId);
  const vendors = await prisma.vendor.findMany({
    where: {
      deletedAt: null,
      ...(input?.vendorId ? { id: input.vendorId } : {}),
    },
    select: { id: true, name: true, orderRoutingMode: true, menuSource: true },
  });

  const reports: MenuSourceOwnershipRepairReport[] = [];

  for (const vendor of vendors) {
    const expected = menuSourceForOrderRoutingMode(vendor.orderRoutingMode);
    const provider = activeMenuProviderForOrderRoutingMode(vendor.orderRoutingMode);

    const versions = await prisma.menuVersion.findMany({
      where: {
        vendorId: vendor.id,
        state: { in: [MenuVersionState.published, MenuVersionState.archived] },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        state: true,
        publishedAt: true,
        createdAt: true,
        canonicalSnapshot: true,
        canonicalSnapshotSha256: true,
      },
    });
    const published = versions.filter((row) => row.state === MenuVersionState.published);
    const nativeRows = versions.filter((row) =>
      snapshotIsNativeOpenOrderBuilder(row.canonicalSnapshot)
    );

    const base = {
      vendorId: vendor.id,
      orderRoutingMode: vendor.orderRoutingMode,
      previousMenuSource: vendor.menuSource,
      menuSource: expected,
      provider,
      archivedMenuVersionIds: [] as string[],
      restoredMenuVersionIds: [] as string[],
      softDisabledMenuItemCount: 0,
      restoredAvailableMenuItemCount: 0,
      menuSourceUpdated: vendor.menuSource !== expected,
    };

    const withVendor = {
      ...emptyRepairFields(),
      vendorName: vendor.name,
      currentAuthority: provider,
    };

    if (provider !== "open_order") {
      const needsRetire = vendorNeedsOpenOrderAdoptionRepair({
        orderRoutingMode: vendor.orderRoutingMode,
        menuSource: vendor.menuSource,
        published,
      });
      if (!needsRetire) {
        if (targeted) {
          reports.push({
            ...base,
            ...withVendor,
            repairType: "no_repair_needed",
            reason: "Routing, menu source, and published catalog already match.",
          });
        }
        continue;
      }

      const reason = "Active provider catalog should be the only published MenuVersion.";
      const archivedIds = published
        .filter((row) => !canonicalMatchesActiveProvider(row.canonicalSnapshot, provider))
        .map((r) => r.id);
      if (dryRun) {
        reports.push(
          reportFromReconcile(
            { ...base, archivedMenuVersionIds: archivedIds },
            "retire_foreign_published",
            reason,
            { ...withVendor }
          )
        );
        continue;
      }
      const result = await prisma.$transaction((tx) =>
        reconcileVendorMenuSourceOwnership(
          { vendorId: vendor.id, orderRoutingMode: vendor.orderRoutingMode },
          tx
        )
      );
      reports.push(reportFromReconcile(result, "retire_foreign_published", reason, { ...withVendor }));
      continue;
    }

    const nativePublished = nativeRows.find((row) => row.state === MenuVersionState.published);
    const nativeToResume = nativePublished ?? nativeRows[0] ?? null;

    if (nativeToResume) {
      const extraPublishedIds = published
        .filter((row) => row.id !== nativeToResume.id)
        .map((r) => r.id);
      const wouldUnarchive = nativeToResume.state === MenuVersionState.archived;
      const products = nativeProductsFromSnapshot(nativeToResume.canonicalSnapshot) ?? [];
      const productIds = products.map((p) => p.deliverectId);
      const liveRows =
        productIds.length === 0
          ? []
          : await prisma.menuItem.findMany({
              where: { vendorId: vendor.id, deliverectProductId: { in: productIds } },
              select: { deliverectProductId: true, isAvailable: true },
            });
      const livePlan = planNativeLiveReconciliation(products, liveRows);
      const nativeHistory = nativeRows.map((row) => ({
        id: row.id,
        publishedAt: row.publishedAt,
        createdAt: row.createdAt,
        snapshot: row.canonicalSnapshot,
      }));
      const poison = evaluatePoisonedNativeAvailability({
        currentPublished: {
          id: nativeToResume.id,
          publishedAt: nativeToResume.publishedAt,
          createdAt: nativeToResume.createdAt,
          snapshot: nativeToResume.canonicalSnapshot,
        },
        nativeHistory,
      });
      const poisonApplies = poison.repairType === "repair_poisoned_native_availability";
      const wouldMutate =
        wouldUnarchive || extraPublishedIds.length > 0 || livePlan.wouldMutateLive || poisonApplies;

      const liveChanges: NativeProductAvailabilityChange[] = [
        ...livePlan.rowsToUpdateAvailability,
        ...livePlan.rowsToCreate,
      ].map((row) => ({
        deliverectId: row.deliverectId,
        name: row.name,
        from: row.from ?? false,
        to: row.to,
      }));

      const extras = {
        ...withVendor,
        matchingLiveMenuItemCount: livePlan.matchingLiveMenuItemCount,
        menuItemsThatWouldBeRestored: livePlan.rowsToUpdateAvailability.length,
        liveAvailableCount: livePlan.liveAvailableCount,
        liveRowsToCreate: livePlan.rowsToCreate,
        liveRowsToUpdateAvailability: livePlan.rowsToUpdateAvailability,
        expectedAvailableItemCount: poisonApplies
          ? poison.historicalAvailable
          : livePlan.expectedAvailableItemCount,
        nativeItemCount: livePlan.nativeItemCount,
        currentAvailable: livePlan.snapshotAvailableCount,
        historicalAvailable: poison.historicalAvailable,
        historicalSnapshotId: poison.historicalSnapshotId,
        historicalPublishedAt: poison.historicalPublishedAt,
        currentPublishedVersionId: nativeToResume.id,
        productsToRestore: poisonApplies ? poison.changes : liveChanges,
        restoredAvailableMenuItemCount: poisonApplies
          ? poison.changes.filter((c) => c.to).length
          : livePlan.rowsToUpdateAvailability.filter((r) => r.to).length + livePlan.rowsToCreate.filter((r) => r.to).length,
        restoredMenuVersionIds: wouldUnarchive ? [nativeToResume.id] : [],
        archivedMenuVersionIds: extraPublishedIds,
        selectionReason: "Newest native open_order_builder_v1 snapshot (published, else archived).",
      };

      if (!wouldMutate) {
        if (targeted || poison.repairType === "ambiguous_history") {
          reports.push({
            ...base,
            ...extras,
            repairType: poison.repairType === "ambiguous_history" ? "ambiguous_history" : "no_repair_needed",
            reason:
              poison.repairType === "ambiguous_history"
                ? poison.reason
                : "Native catalog is published and live MenuItem availability already matches the snapshot.",
          });
        }
        continue;
      }

      const repairType: MenuSourceRepairType = poisonApplies
        ? "repair_poisoned_native_availability"
        : "resume_native_catalog";
      const reason = poisonApplies
        ? poison.reason
        : livePlan.wouldMutateLive
          ? "Native Menu Builder catalog is selected, but live MenuItem rows are missing or disagree with snapshot availability. Reconcile live tables from that native snapshot."
          : "Open Order is authoritative. An archived native Menu Builder catalog exists and will be resumed; provider catalogs are not adopted over it.";

      if (dryRun) {
        reports.push({
          ...base,
          ...extras,
          repairType,
          reason,
        });
        continue;
      }

      const applied = await prisma.$transaction(async (tx) => {
        if (poisonApplies) {
          if (extraPublishedIds.length > 0) {
            await tx.menuVersion.updateMany({
              where: { id: { in: extraPublishedIds } },
              data: { state: MenuVersionState.archived },
            });
          }
          const poisonApplied = await applyPoisonedNativeAvailabilityRepair(
            tx,
            vendor.id,
            {
              id: nativeToResume.id,
              canonicalSnapshot: nativeToResume.canonicalSnapshot,
              canonicalSnapshotSha256: nativeToResume.canonicalSnapshotSha256,
            },
            poison
          );
          return {
            restoredMenuVersionIds: [poisonApplied.newMenuVersionId],
            archivedMenuVersionIds: extraPublishedIds,
          };
        }
        const result = await reconcileVendorMenuSourceOwnership(
          { vendorId: vendor.id, orderRoutingMode: vendor.orderRoutingMode },
          tx
        );
        return {
          restoredMenuVersionIds: result.restoredMenuVersionIds,
          archivedMenuVersionIds: result.archivedMenuVersionIds,
        };
      });

      reports.push({
        ...base,
        ...extras,
        repairType,
        reason,
        restoredMenuVersionIds: applied.restoredMenuVersionIds,
        archivedMenuVersionIds: applied.archivedMenuVersionIds,
      });
      continue;
    }

    const selected = pickAdoptedProviderCatalog(versions);
    const plausibleOrigins = providerOriginsAmong(versions);
    const multiplePlausibleProviderCatalogs = plausibleOrigins.length > 1;

    if (!selected) {
      if (targeted || vendor.menuSource !== expected) {
        reports.push({
          ...base,
          ...withVendor,
          repairType: "no_repair_needed",
          reason:
            "Open Order is authoritative and no native or Square/Deliverect catalog exists to adopt.",
          multiplePlausibleProviderCatalogs,
          plausibleProviderOrigins: plausibleOrigins,
        });
      }
      continue;
    }

    const selectedView = toSelectedProviderCatalog(selected);
    const impact = await countAdoptionItemImpact(vendor.id, selected.canonicalSnapshot);
    const selectionReason = selectionReasonForAdoptedCatalog({ selected, versions });

    if (multiplePlausibleProviderCatalogs) {
      reports.push({
        ...base,
        ...withVendor,
        repairType: "ambiguous_history",
        reason:
          "Both Square and Deliverect catalogs exist with products. Automatic adoption is skipped.",
        adoptionSource: selectedView.adoptionSource,
        adoptionSourceLabel: adoptionSourceLabel(selectedView.adoptionSource),
        selectedCatalog: selectedView,
        matchingLiveMenuItemCount: impact.matchingLiveMenuItemCount,
        menuItemsThatWouldBeRestored: impact.menuItemsThatWouldBeRestored,
        restoredAvailableMenuItemCount: impact.menuItemsThatWouldBeRestored,
        restoredMenuVersionIds:
          selected.state === MenuVersionState.archived ? [selected.id] : [],
        multiplePlausibleProviderCatalogs: true,
        plausibleProviderOrigins: plausibleOrigins,
        selectionReason,
        currentPublishedVersionId: selected.id,
        historicalSnapshotId: selected.id,
        historicalPublishedAt: selectedView.publishedAt,
        nativeItemCount: 0,
        currentAvailable: selectedView.availableProductCount,
        historicalAvailable: selectedView.availableProductCount,
      });
      continue;
    }

    if (!selectedView.parseable || selectedView.productCount === 0) {
      reports.push({
        ...base,
        ...withVendor,
        repairType: "ambiguous_history",
        reason: selectedView.parseable
          ? "Selected provider catalog has zero products; automatic adoption is skipped."
          : "Selected provider catalog failed canonical parse; automatic adoption is skipped.",
        adoptionSource: selectedView.adoptionSource,
        adoptionSourceLabel: adoptionSourceLabel(selectedView.adoptionSource),
        selectedCatalog: selectedView,
        matchingLiveMenuItemCount: impact.matchingLiveMenuItemCount,
        menuItemsThatWouldBeRestored: 0,
        multiplePlausibleProviderCatalogs,
        plausibleProviderOrigins: plausibleOrigins,
        selectionReason,
        currentPublishedVersionId: selected.id,
        historicalSnapshotId: selected.id,
        historicalPublishedAt: selectedView.publishedAt,
      });
      continue;
    }

    const reason = `Open Order is authoritative but no native builder catalog exists. Adopt the ${adoptionSourceLabel(selectedView.adoptionSource)} catalog ${selected.id}.`;
    const adoptExtras = {
      ...withVendor,
      adoptionSource: selectedView.adoptionSource,
      adoptionSourceLabel: adoptionSourceLabel(selectedView.adoptionSource),
      selectedCatalog: selectedView,
      matchingLiveMenuItemCount: impact.matchingLiveMenuItemCount,
      menuItemsThatWouldBeRestored: impact.menuItemsThatWouldBeRestored,
      restoredAvailableMenuItemCount: impact.menuItemsThatWouldBeRestored,
      restoredMenuVersionIds: selected.state === MenuVersionState.archived ? [selected.id] : [],
      multiplePlausibleProviderCatalogs,
      plausibleProviderOrigins: plausibleOrigins,
      selectionReason,
      currentPublishedVersionId: selected.id,
      historicalSnapshotId: selected.id,
      historicalPublishedAt: selectedView.publishedAt,
      nativeItemCount: 0,
      currentAvailable: selectedView.availableProductCount,
      historicalAvailable: selectedView.availableProductCount,
    };

    const wouldMutate = providerAdoptionWouldMutate({
      menuSourceAligned: vendor.menuSource === expected,
      selectedCurrentlyArchived: selected.state === MenuVersionState.archived,
      menuItemsThatWouldBeRestored: impact.menuItemsThatWouldBeRestored,
    });

    if (!wouldMutate) {
      if (targeted) {
        reports.push({
          ...base,
          ...adoptExtras,
          repairType: "no_repair_needed",
          reason:
            "Selected provider catalog is already published, routing/menu source are aligned, and no MenuItem availability restore is needed.",
        });
      }
      continue;
    }

    if (dryRun) {
      reports.push({
        ...base,
        ...adoptExtras,
        repairType: "adopt_provider_catalog",
        reason,
      });
      continue;
    }

    const result = await prisma.$transaction((tx) =>
      reconcileVendorMenuSourceOwnership(
        { vendorId: vendor.id, orderRoutingMode: vendor.orderRoutingMode },
        tx
      )
    );
    reports.push(
      reportFromReconcile(result, "adopt_provider_catalog", reason, {
        ...adoptExtras,
        restoredMenuVersionIds: result.restoredMenuVersionIds,
        restoredAvailableMenuItemCount: result.restoredAvailableMenuItemCount,
      })
    );
  }

  const repaired = reports.filter(
    (row) =>
      row.repairType === "adopt_provider_catalog" ||
      row.repairType === "resume_native_catalog" ||
      row.repairType === "repair_poisoned_native_availability" ||
      row.repairType === "retire_foreign_published"
  );

  return { scanned: vendors.length, repaired, reports, dryRun };
}
