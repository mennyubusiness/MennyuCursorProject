/**
 * Canonical snapshot → live MenuItem / ModifierGroup / ModifierOption.
 * No `server-only` so CLI repairs can use the same path as Menu Builder publish.
 */
import type { Prisma } from "@prisma/client";
import {
  type OpenOrderCanonicalMenu,
  type OpenOrderCanonicalProduct,
} from "@/domain/menu-import/canonical.schema";
import {
  productExternalId,
  variantParentName,
  variantParentPlu,
} from "@/domain/menu-import/canonical-identity";
import { orderModifierGroupsForPublish } from "@/domain/menu-import/modifier-group-publish-order";
import { menuSourceProvider, type MenuSourceProvider } from "@/domain/menu-import/menu-source-provider";
import {
  OPEN_ORDER_MODIFIER_GROUP_ID_PREFIX,
  OPEN_ORDER_PRODUCT_ID_PREFIX,
} from "@/lib/open-order-menu-ids";
import {
  SQUARE_MODIFIER_GROUP_ID_PREFIX,
  SQUARE_PRODUCT_ID_PREFIX,
} from "@/lib/integrations/square/square-menu-ids";

export class MenuPublishValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "MenuPublishValidationError";
  }
}

function logMenuPublish(
  phase: string,
  data: Record<string, unknown> & { jobId?: string; vendorId?: string }
): void {
  console.info("[menu-publish]", phase, { ...data, atMs: Date.now() });
}

function staleRowsOfOriginWhere(
  vendorId: string,
  origin: Exclude<MenuSourceProvider, "unknown">,
  keepIds: string[],
  kind: "product" | "group"
): Prisma.MenuItemWhereInput | Prisma.ModifierGroupWhereInput {
  const field = kind === "product" ? "deliverectProductId" : "deliverectModifierGroupId";
  const notIn = keepIds.length > 0 ? { notIn: keepIds } : {};
  const openOrderPrefix =
    kind === "product" ? OPEN_ORDER_PRODUCT_ID_PREFIX : OPEN_ORDER_MODIFIER_GROUP_ID_PREFIX;
  const squarePrefix = kind === "product" ? SQUARE_PRODUCT_ID_PREFIX : SQUARE_MODIFIER_GROUP_ID_PREFIX;

  if (origin === "open_order") {
    return { vendorId, [field]: { startsWith: openOrderPrefix, ...notIn } };
  }
  if (origin === "square") {
    return { vendorId, [field]: { startsWith: squarePrefix, ...notIn } };
  }
  return {
    vendorId,
    AND: [
      { [field]: { not: null, ...notIn } },
      { NOT: { [field]: { startsWith: openOrderPrefix } } },
      { NOT: { [field]: { startsWith: squarePrefix } } },
    ],
  };
}

export async function applyCanonicalMenuToLiveTables(
  tx: Prisma.TransactionClient,
  vendorId: string,
  menu: OpenOrderCanonicalMenu,
  logCtx?: { jobId?: string; source?: string }
): Promise<void> {
  const orderedGroups = orderModifierGroupsForPublish(menu.modifierGroupDefinitions);
  const groupDeliverectToDbId = new Map<string, string>();
  const optionDeliverectToDbId = new Map<string, string>();

  let sectionMs = Date.now();
  logMenuPublish("apply_phase", {
    phase: "modifier_groups_start",
    vendorId,
    ...logCtx,
    modifierGroupCount: orderedGroups.length,
    modifierOptionCount: orderedGroups.reduce((n, g) => n + g.options.length, 0),
  });

  for (const g of orderedGroups) {
    let parentDbId: string | null = null;
    if (g.parentDeliverectOptionId != null) {
      parentDbId = optionDeliverectToDbId.get(g.parentDeliverectOptionId) ?? null;
      if (!parentDbId) {
        throw new MenuPublishValidationError(
          "MODIFIER_PARENT_MISSING",
          `Modifier group ${g.deliverectId} references unknown parent option ${g.parentDeliverectOptionId}`
        );
      }
    }

    const existingG = await tx.modifierGroup.findFirst({
      where: { vendorId, deliverectModifierGroupId: g.deliverectId },
    });

    const groupData = {
      name: g.name,
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      isRequired: g.isRequired,
      sortOrder: g.sortOrder,
      isAvailable: true,
      parentModifierOptionId: parentDbId,
      deliverectModifierGroupId: g.deliverectId,
      deliverectIsVariantGroup: g.isVariantGroup === true,
      deliverectMultiMax: g.multiMax ?? null,
    };

    const dbGroup = existingG
      ? await tx.modifierGroup.update({
          where: { id: existingG.id },
          data: groupData,
        })
      : await tx.modifierGroup.create({
          data: { vendorId, ...groupData },
        });

    groupDeliverectToDbId.set(g.deliverectId, dbGroup.id);

    const sortedOpts = [...g.options].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const o of sortedOpts) {
      const existingO = await tx.modifierOption.findFirst({
        where: { modifierGroupId: dbGroup.id, deliverectModifierId: o.deliverectId },
      });
      const optData = {
        name: o.name,
        priceCents: o.priceCents,
        sortOrder: o.sortOrder,
        isDefault: o.isDefault,
        isAvailable: o.isAvailable,
        deliverectModifierId: o.deliverectId,
        deliverectModifierPlu: o.plu ?? null,
      };
      const dbOpt = existingO
        ? await tx.modifierOption.update({
            where: { id: existingO.id },
            data: optData,
          })
        : await tx.modifierOption.create({
            data: { modifierGroupId: dbGroup.id, ...optData },
          });
      optionDeliverectToDbId.set(o.deliverectId, dbOpt.id);
    }
  }

  logMenuPublish("apply_phase", {
    phase: "modifier_groups_done",
    vendorId,
    ...logCtx,
    elapsedMs: Date.now() - sectionMs,
  });

  sectionMs = Date.now();
  logMenuPublish("apply_phase", {
    phase: "menu_items_start",
    vendorId,
    ...logCtx,
    categoryCount: menu.categories.length,
    productCount: menu.products.length,
  });

  const draftProductIds = new Set(menu.products.map((p) => p.deliverectId));
  const draftGroupIds = new Set(menu.modifierGroupDefinitions.map((g) => g.deliverectId));
  const productById = new Map(menu.products.map((p) => [p.deliverectId, p]));

  const inCategory = new Set<string>();
  let sort = 0;
  const sortedCats = [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const cat of sortedCats) {
    for (const pid of cat.productDeliverectIds) {
      const p = productById.get(pid);
      if (!p) continue;
      inCategory.add(pid);
      await upsertMenuItemAndLinks(tx, vendorId, menu, p, sort++, cat.deliverectId, groupDeliverectToDbId);
    }
  }
  const sortedProducts = [...menu.products].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const p of sortedProducts) {
    if (!inCategory.has(p.deliverectId)) {
      await upsertMenuItemAndLinks(tx, vendorId, menu, p, sort++, null, groupDeliverectToDbId);
    }
  }

  logMenuPublish("apply_phase", {
    phase: "menu_items_done",
    vendorId,
    ...logCtx,
    elapsedMs: Date.now() - sectionMs,
  });

  sectionMs = Date.now();
  logMenuPublish("apply_phase", { phase: "orphan_options_off_start", vendorId, ...logCtx });

  for (const g of menu.modifierGroupDefinitions) {
    const dbGid = groupDeliverectToDbId.get(g.deliverectId);
    if (!dbGid) continue;
    const expected = new Set(g.options.map((o) => o.deliverectId));
    const dbOpts = await tx.modifierOption.findMany({
      where: { modifierGroupId: dbGid },
      select: { id: true, deliverectModifierId: true },
    });
    for (const row of dbOpts) {
      const mid = row.deliverectModifierId;
      if (mid && !expected.has(mid)) {
        await tx.modifierOption.update({
          where: { id: row.id },
          data: { isAvailable: false },
        });
      }
    }
  }

  logMenuPublish("apply_phase", {
    phase: "orphan_options_off_done",
    vendorId,
    ...logCtx,
    elapsedMs: Date.now() - sectionMs,
  });

  sectionMs = Date.now();
  logMenuPublish("apply_phase", {
    phase: "soft_disable_stale_start",
    vendorId,
    ...logCtx,
    draftProductIdCount: draftProductIds.size,
    draftGroupIdCount: draftGroupIds.size,
  });

  const publishedOrigin = menuSourceProvider(menu.deliverect.sourcePayloadKind);

  if (draftProductIds.size > 0 && publishedOrigin !== "unknown") {
    await tx.menuItem.updateMany({
      where: staleRowsOfOriginWhere(
        vendorId,
        publishedOrigin,
        [...draftProductIds],
        "product"
      ) as Prisma.MenuItemWhereInput,
      data: { isAvailable: false },
    });
  }

  if (draftGroupIds.size > 0 && publishedOrigin !== "unknown") {
    await tx.modifierGroup.updateMany({
      where: staleRowsOfOriginWhere(
        vendorId,
        publishedOrigin,
        [...draftGroupIds],
        "group"
      ) as Prisma.ModifierGroupWhereInput,
      data: { isAvailable: false },
    });
  }

  logMenuPublish("apply_phase", {
    phase: "soft_disable_stale_done",
    vendorId,
    ...logCtx,
    elapsedMs: Date.now() - sectionMs,
  });
}

async function upsertMenuItemAndLinks(
  tx: Prisma.TransactionClient,
  vendorId: string,
  menu: OpenOrderCanonicalMenu,
  p: OpenOrderCanonicalProduct,
  sortOrder: number,
  deliverectCategoryId: string | null,
  groupDeliverectToDbId: Map<string, string>
): Promise<void> {
  const existing = await tx.menuItem.findFirst({
    where: { vendorId, deliverectProductId: productExternalId(p) },
  });

  const itemData = {
    name: p.name,
    description: p.description ?? null,
    priceCents: p.priceCents,
    imageUrl: p.imageUrl ?? null,
    sortOrder,
    isAvailable: p.isAvailable,
    basketMaxQuantity: p.basketMaxQuantity ?? null,
    deliverectProductId: productExternalId(p),
    deliverectPlu: p.plu ?? null,
    deliverectVariantParentPlu: variantParentPlu(p),
    deliverectVariantParentName: variantParentName(p),
    deliverectCategoryId,
  };

  const row = existing
    ? await tx.menuItem.update({
        where: { id: existing.id },
        data: itemData,
      })
    : await tx.menuItem.create({
        data: { vendorId, ...itemData },
      });

  await tx.menuItem.updateMany({
    where: {
      vendorId,
      deliverectProductId: productExternalId(p),
      NOT: { id: row.id },
    },
    data: {
      name: itemData.name,
      description: itemData.description,
      priceCents: itemData.priceCents,
      imageUrl: itemData.imageUrl,
      sortOrder: itemData.sortOrder,
      isAvailable: itemData.isAvailable,
      basketMaxQuantity: itemData.basketMaxQuantity,
      deliverectPlu: itemData.deliverectPlu,
      deliverectVariantParentPlu: variantParentPlu(p),
      deliverectVariantParentName: variantParentName(p),
      deliverectCategoryId: itemData.deliverectCategoryId,
    },
  });

  await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId: row.id } });

  let linkOrder = 0;
  for (const gid of p.modifierGroupDeliverectIds) {
    const dbGid = groupDeliverectToDbId.get(gid);
    if (!dbGid) {
      throw new MenuPublishValidationError(
        "UNKNOWN_MODIFIER_GROUP_ON_PRODUCT",
        `Product ${productExternalId(p)} references unknown modifier group ${gid}`
      );
    }
    const gdef = menu.modifierGroupDefinitions.find((x) => x.deliverectId === gid);
    await tx.menuItemModifierGroup.create({
      data: {
        menuItemId: row.id,
        modifierGroupId: dbGid,
        required: gdef?.isRequired ?? false,
        minSelections: gdef?.minSelections ?? 0,
        maxSelections: gdef?.maxSelections ?? 1,
        sortOrder: linkOrder++,
      },
    });
  }
}
