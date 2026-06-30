import "server-only";

import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { payloadFingerprint } from "@/lib/menu-import-payload-hash";
import {
  getMenuPublishTransactionOptions,
  logMenuPublish,
} from "@/lib/menu-publish-transaction";
import {
  openOrderCategoryDeliverectId,
  openOrderProductDeliverectId,
} from "@/lib/open-order-menu-ids";
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
  const [categories, items] = await Promise.all([
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
        updatedAt: true,
      },
    }),
  ]);
  return { categories, items };
}

export function buildOpenOrderCanonicalMenu(
  vendorId: string,
  categories: Array<{ id: string; name: string; sortOrder: number; isVisible: boolean }>,
  items: OpenOrderMenuItemRow[]
): MennyuCanonicalMenu {
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

  const products = productsInCategories.map((item, index) => ({
    deliverectId: openOrderProductDeliverectId(item.id),
    plu: null,
    deliverectVariantParentPlu: null,
    deliverectVariantParentName: null,
    name: item.name.trim(),
    description: item.description?.trim() || null,
    priceCents: item.priceCents,
    isAvailable: item.isAvailable,
    sortOrder: item.sortOrder ?? index,
    imageUrl: null,
    basketMaxQuantity: null,
    modifierGroupDeliverectIds: [] as string[],
  }));

  const menu: MennyuCanonicalMenu = {
    schemaVersion: 1,
    vendorId,
    deliverect: {
      sourcePayloadKind: "open_order_builder_v1",
    },
    categories: canonicalCategories,
    modifierGroupDefinitions: [],
    products,
  };

  const parsed = mennyuCanonicalMenuSchema.safeParse(menu);
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
  const { categories, items } = await loadBuilderRows(vendorId);

  const validation = validateOpenOrderMenuBuilderState({ categories, items });
  if (!validation.ready) {
    throw new OpenOrderMenuPublishError(
      "VALIDATION_FAILED",
      validation.issues[0]?.message ?? "Menu is not ready to publish."
    );
  }

  const menu = buildOpenOrderCanonicalMenu(vendorId, categories, items);
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

export { MenuPublishValidationError };
