import "server-only";

import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { OpenOrderCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { payloadFingerprint } from "@/lib/menu-import-payload-hash";
import {
  getMenuPublishTransactionOptions,
  logMenuPublish,
} from "@/lib/menu-publish-transaction";
import {
  openOrderCategoryDeliverectId,
  openOrderModifierGroupDeliverectId,
  openOrderProductDeliverectId,
} from "@/lib/open-order-menu-ids";
import {
  buildCanonicalModifierGroupDefinitions,
  loadOpenOrderBuilderModifierGroupsByItemId,
  toModifierValidationRowFromBuilderGroup as toModifierValidationRow,
  type OpenOrderBuilderModifierGroupRow,
} from "@/lib/open-order-menu-builder-modifiers.server";
import {
  validateOpenOrderMenuBuilderState,
  type OpenOrderMenuItemRow,
} from "@/lib/open-order-menu-validation";
import {
  applyCanonicalMenuToLiveTables,
  MenuPublishValidationError,
} from "@/services/menu-publish-from-canonical.service";
import { revalidateOperationalMenuCacheForVendor } from "@/services/menu-active-scope.service";
import { revalidateCustomerVendorMenuCacheForVendor } from "@/services/vendor-customer-menu-cache.service";

export class OpenOrderMenuPublishError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "OpenOrderMenuPublishError";
  }
}

async function loadBuilderRows(vendorId: string) {
  const [categories, rawItems] = await Promise.all([
    prisma.vendorMenuCategory.findMany({
      where: { vendorId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, sortOrder: true, isVisible: true },
    }),
    prisma.menuItem.findMany({
      where: {
        vendorId,
        deliverectProductId: { startsWith: "oo:prod:" },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        priceCents: true,
        isAvailable: true,
        sortOrder: true,
        deliverectCategoryId: true,
        deliverectProductId: true,
        imageUrl: true,
        updatedAt: true,
      },
    }),
  ]);

  const modifierGroupsByItemId = await loadOpenOrderBuilderModifierGroupsByItemId(
    vendorId,
    rawItems.map((item) => item.id)
  );

  const items: OpenOrderMenuItemRow[] = rawItems.map((item) => ({
    ...item,
    modifierGroups: (modifierGroupsByItemId.get(item.id) ?? []).map(toModifierValidationRow),
  }));

  return { categories, items, modifierGroupsByItemId };
}

export function buildOpenOrderCanonicalMenu(
  vendorId: string,
  categories: Array<{ id: string; name: string; sortOrder: number; isVisible: boolean }>,
  items: OpenOrderMenuItemRow[],
  modifierGroupsByItemId: Map<string, OpenOrderBuilderModifierGroupRow[]>
): OpenOrderCanonicalMenu {
  const visibleCategories = categories
    .filter((c) => c.isVisible && c.name.trim())
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const categoryDeliverectIds = new Map(
    visibleCategories.map((c) => [c.id, openOrderCategoryDeliverectId(c.id)])
  );

  const visibleCategoryDeliverectIdSet = new Set(categoryDeliverectIds.values());

  const productsInCategories = items
    .filter(
      (item) =>
        item.deliverectProductId?.startsWith("oo:prod:") &&
        item.deliverectCategoryId != null &&
        visibleCategoryDeliverectIdSet.has(item.deliverectCategoryId)
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const canonicalCategories = visibleCategories.map((cat) => {
    const catDeliverectId = categoryDeliverectIds.get(cat.id)!;
    const productDeliverectIds = productsInCategories
      .filter((item) => item.deliverectCategoryId === catDeliverectId)
      .map((item) => openOrderProductDeliverectId(item.id));
    return {
      deliverectId: catDeliverectId,
      name: cat.name.trim(),
      sortOrder: cat.sortOrder,
      productDeliverectIds,
    };
  });

  const allModifierGroups = [...modifierGroupsByItemId.values()].flat();
  const modifierGroupDefinitions = buildCanonicalModifierGroupDefinitions(allModifierGroups);
  const modifierGroupDeliverectIdSet = new Set(modifierGroupDefinitions.map((g) => g.deliverectId));

  const products = productsInCategories.map((item, index) => {
    const itemGroups = modifierGroupsByItemId.get(item.id) ?? [];
    const modifierGroupDeliverectIds = itemGroups
      .map((g) => openOrderModifierGroupDeliverectId(g.id))
      .filter((id) => modifierGroupDeliverectIdSet.has(id));

    return {
      deliverectId: openOrderProductDeliverectId(item.id),
      plu: null,
      deliverectVariantParentPlu: null,
      deliverectVariantParentName: null,
      name: item.name.trim(),
      description: item.description?.trim() || null,
      priceCents: item.priceCents,
      isAvailable: item.isAvailable,
      sortOrder: item.sortOrder ?? index,
      imageUrl: item.imageUrl?.trim() || null,
      basketMaxQuantity: null,
      modifierGroupDeliverectIds,
    };
  });

  const menu: OpenOrderCanonicalMenu = {
    schemaVersion: 1,
    vendorId,
    deliverect: {
      sourcePayloadKind: "open_order_builder_v1",
    },
    categories: canonicalCategories,
    modifierGroupDefinitions,
    products,
  };

  const parsed = openOrderCanonicalMenuSchema.safeParse(menu);
  if (!parsed.success) {
    throw new OpenOrderMenuPublishError("INVALID_CANONICAL", "Built menu failed schema validation.");
  }
  return parsed.data;
}

export async function publishOpenOrderMenuFromBuilder(input: {
  vendorId: string;
  publishedBy: string | null;
}): Promise<{ menuVersionId: string }> {
  const vendorId = input.vendorId.trim();
  const { categories, items, modifierGroupsByItemId } = await loadBuilderRows(vendorId);

  const validation = validateOpenOrderMenuBuilderState({ categories, items });
  if (!validation.ready) {
    throw new OpenOrderMenuPublishError(
      "VALIDATION_FAILED",
      validation.issues[0]?.message ?? "Menu is not ready to publish."
    );
  }

  const menu = buildOpenOrderCanonicalMenu(vendorId, categories, items, modifierGroupsByItemId);
  if (menu.products.length === 0) {
    throw new OpenOrderMenuPublishError("EMPTY_MENU", "Cannot publish an empty menu.");
  }

  const snapshotSha = payloadFingerprint(menu);
  const txOpts = getMenuPublishTransactionOptions();

  const publishStarted = Date.now();
  logMenuPublish("open_order_publish_start", {
    vendorId,
    categoryCount: menu.categories.length,
    productCount: menu.products.length,
    modifierGroupCount: menu.modifierGroupDefinitions.length,
  });

  const result = await prisma.$transaction(
    async (tx) => {
      const prevPublished = await tx.menuVersion.findFirst({
        where: { vendorId, state: MenuVersionState.published },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      });

      if (prevPublished) {
        await tx.menuVersion.update({
          where: { id: prevPublished.id },
          data: { state: MenuVersionState.archived },
        });
      }

      const version = await tx.menuVersion.create({
        data: {
          vendorId,
          state: MenuVersionState.published,
          canonicalSnapshot: menu as object,
          canonicalSnapshotSha256: snapshotSha,
          publishedAt: new Date(),
          publishedBy: input.publishedBy?.trim() || null,
          previousPublishedVersionId: prevPublished?.id ?? null,
        },
      });

      await applyCanonicalMenuToLiveTables(tx, vendorId, menu, {
        source: "open_order_builder",
      });

      return { menuVersionId: version.id };
    },
    txOpts
  );

  logMenuPublish("open_order_publish_done", {
    vendorId,
    menuVersionId: result.menuVersionId,
    elapsedMs: Date.now() - publishStarted,
  });

  revalidateOperationalMenuCacheForVendor(vendorId);
  revalidateCustomerVendorMenuCacheForVendor(vendorId);

  return result;
}

export async function loadOpenOrderMenuBuilderValidation(vendorId: string) {
  const { categories, items } = await loadBuilderRows(vendorId);
  return validateOpenOrderMenuBuilderState({ categories, items });
}

export type OpenOrderMenuPublishState = {
  draftFingerprint: string;
  publishedFingerprint: string | null;
  hasPublishedOpenOrderMenu: boolean;
  hasUnpublishedChanges: boolean;
  publishedAtIso: string | null;
};

export async function findPublishedOpenOrderMenuVersion(vendorId: string) {
  const versions = await prisma.menuVersion.findMany({
    where: { vendorId, state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      publishedAt: true,
      canonicalSnapshotSha256: true,
      canonicalSnapshot: true,
    },
  });

  for (const version of versions) {
    const snapshot = version.canonicalSnapshot;
    if (
      snapshot &&
      typeof snapshot === "object" &&
      "deliverect" in snapshot &&
      (snapshot as { deliverect?: { sourcePayloadKind?: string } }).deliverect
        ?.sourcePayloadKind === "open_order_builder_v1"
    ) {
      return version;
    }
  }

  return null;
}

export async function loadOpenOrderMenuPublishState(
  vendorId: string
): Promise<OpenOrderMenuPublishState> {
  const { categories, items, modifierGroupsByItemId } = await loadBuilderRows(vendorId);
  const menu = buildOpenOrderCanonicalMenu(vendorId, categories, items, modifierGroupsByItemId);
  const draftFingerprint = payloadFingerprint(menu);
  const published = await findPublishedOpenOrderMenuVersion(vendorId);
  const publishedFingerprint = published?.canonicalSnapshotSha256 ?? null;

  return {
    draftFingerprint,
    publishedFingerprint,
    hasPublishedOpenOrderMenu: Boolean(published),
    hasUnpublishedChanges:
      !publishedFingerprint || draftFingerprint !== publishedFingerprint,
    publishedAtIso: published?.publishedAt?.toISOString() ?? null,
  };
}

export { MenuPublishValidationError };
