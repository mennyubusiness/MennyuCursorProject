/**
 * Cached customer vendor menu **display** structure (names, prices, modifiers, layout).
 * Live availability/snooze is applied via {@link loadCustomerVendorMenuAvailabilityOverlay}.
 */
import "server-only";

import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { MenuVersionState, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  openOrderCanonicalMenuSchema,
  type OpenOrderCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";
import { computeCustomerMenuBrowseExcludedProductIds } from "@/domain/menu-import/customer-menu-browse";
import { variantChildCountByParentPluFromProducts } from "@/lib/deliverect-variant-child-count";
import { computeOperationalProductPools } from "@/services/menu-active-scope.service";
import { loadActiveMenuVersionIdForVendor } from "@/lib/vendor-active-menu-version.server";
import {
  CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
  type CustomerVendorMenuCategorySection,
  type CustomerVendorMenuItem,
  type CustomerVendorMenuLoadResult,
} from "@/services/vendor-customer-menu.service";

export function customerVendorMenuCacheTag(vendorId: string): string {
  return `customer-vendor-menu:${vendorId}`;
}

export function revalidateCustomerVendorMenuCacheForVendor(vendorId: string): void {
  revalidateTag(customerVendorMenuCacheTag(vendorId));
}

export type CachedCustomerVendorMenuDisplay = {
  menuVersionId: string | null;
  source: CustomerVendorMenuLoadResult["source"];
  sections: CustomerVendorMenuCategorySection[];
  variantChildCountByParentPlu: Record<string, number>;
  /** Canonical product id → operational pool MenuItem row ids (availability merge). */
  availabilityPoolByProductId: Record<string, string[]>;
  modifierGroupIds: string[];
  modifierOptionIds: string[];
};

export type CustomerVendorMenuAvailabilityOverlay = {
  itemAvailableByMenuItemId: Map<string, boolean>;
  modifierGroupAvailableById: Map<string, boolean>;
  modifierOptionAvailableById: Map<string, boolean>;
};

function sortItems(a: CustomerVendorMenuItem, b: CustomerVendorMenuItem): number {
  if (a.isAvailable === b.isAvailable) return a.sortOrder - b.sortOrder;
  return a.isAvailable ? -1 : 1;
}

function buildSectionsFromCanonical(
  menu: OpenOrderCanonicalMenu,
  byProductId: Map<string, CustomerVendorMenuItem>
): CustomerVendorMenuCategorySection[] {
  const sections: CustomerVendorMenuCategorySection[] = [];
  const browseExcludedProductIds = computeCustomerMenuBrowseExcludedProductIds(menu);

  const sortedCategories = [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const cat of sortedCategories) {
    const items: CustomerVendorMenuItem[] = [];
    for (const pid of cat.productDeliverectIds) {
      if (browseExcludedProductIds.has(pid)) continue;
      const row = byProductId.get(pid);
      if (row) items.push(row);
    }
    items.sort(sortItems);
    if (items.length > 0) {
      sections.push({
        id: cat.deliverectId,
        name: cat.name,
        sortOrder: cat.sortOrder,
        items,
      });
    }
  }

  const inAnyCategory = new Set<string>();
  for (const c of menu.categories) {
    for (const pid of c.productDeliverectIds) inAnyCategory.add(pid);
  }

  const uncategorized: CustomerVendorMenuItem[] = [];
  const sortedProducts = [...menu.products].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const p of sortedProducts) {
    if (inAnyCategory.has(p.deliverectId)) continue;
    if (browseExcludedProductIds.has(p.deliverectId)) continue;
    const row = byProductId.get(p.deliverectId);
    if (row) uncategorized.push(row);
  }
  uncategorized.sort(sortItems);
  if (uncategorized.length > 0) {
    const maxCatOrder = sortedCategories.length
      ? Math.max(...sortedCategories.map((c) => c.sortOrder))
      : -1;
    sections.push({
      id: "uncategorized",
      name: "Other",
      sortOrder: maxCatOrder + 1,
      items: uncategorized,
    });
  }

  sections.sort((a, b) => a.sortOrder - b.sortOrder);
  return sections;
}

function withPlaceholderAvailability(item: CustomerVendorMenuItem): CustomerVendorMenuItem {
  return {
    ...item,
    isAvailable: true,
    modifierGroups: item.modifierGroups.map((link) => ({
      ...link,
      modifierGroup: {
        ...link.modifierGroup,
        isAvailable: true,
        options: link.modifierGroup.options.map((opt) => ({
          ...opt,
          isAvailable: true,
          nestedModifierGroups: opt.nestedModifierGroups?.map((ng) => ({
            ...ng,
            isAvailable: true,
            options: ng.options.map((o) => ({ ...o, isAvailable: true })),
          })),
        })),
      },
    })),
  };
}

function collectModifierIds(sections: CustomerVendorMenuCategorySection[]): {
  modifierGroupIds: string[];
  modifierOptionIds: string[];
} {
  const groupIds = new Set<string>();
  const optionIds = new Set<string>();

  for (const section of sections) {
    for (const item of section.items) {
      for (const link of item.modifierGroups) {
        groupIds.add(link.modifierGroup.id);
        for (const opt of link.modifierGroup.options) {
          optionIds.add(opt.id);
          for (const ng of opt.nestedModifierGroups ?? []) {
            groupIds.add(ng.id);
            for (const nestedOpt of ng.options) {
              optionIds.add(nestedOpt.id);
            }
          }
        }
      }
    }
  }

  return {
    modifierGroupIds: [...groupIds],
    modifierOptionIds: [...optionIds],
  };
}

async function buildPublishedMenuDisplay(
  vendorId: string,
  menuVersionId: string
): Promise<CachedCustomerVendorMenuDisplay | null> {
  const published = await prisma.menuVersion.findFirst({
    where: {
      id: menuVersionId,
      vendorId,
      state: { in: [MenuVersionState.published, MenuVersionState.archived] },
    },
    select: { id: true, canonicalSnapshot: true },
  });
  if (!published?.canonicalSnapshot) return null;

  const parsed = openOrderCanonicalMenuSchema.safeParse(published.canonicalSnapshot);
  if (!parsed.success) return null;

  const menu = parsed.data;
  const productIds = [...new Set(menu.products.map((p) => p.deliverectId))];
  if (productIds.length === 0) {
    return {
      menuVersionId: published.id,
      source: "published_canonical",
      sections: [],
      variantChildCountByParentPlu: Object.fromEntries(
        variantChildCountByParentPluFromProducts(menu.products)
      ),
      availabilityPoolByProductId: {},
      modifierGroupIds: [],
      modifierOptionIds: [],
    };
  }

  const rows = await prisma.menuItem.findMany({
    where: { vendorId, deliverectProductId: { in: productIds } },
    include: CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
  });

  const pools = computeOperationalProductPools(menu, rows, { vendorId });
  const availabilityPoolByProductId: Record<string, string[]> = {};
  const byProductId = new Map<string, CustomerVendorMenuItem>();

  for (const [pid, pool] of pools) {
    availabilityPoolByProductId[pid] = pool.map((r) => r.id);
    byProductId.set(pid, withPlaceholderAvailability(pool[0]!));
  }

  const sections = buildSectionsFromCanonical(menu, byProductId);
  const { modifierGroupIds, modifierOptionIds } = collectModifierIds(sections);

  return {
    menuVersionId: published.id,
    source: "published_canonical",
    sections,
    variantChildCountByParentPlu: Object.fromEntries(
      variantChildCountByParentPluFromProducts(menu.products)
    ),
    availabilityPoolByProductId,
    modifierGroupIds,
    modifierOptionIds,
  };
}

function cachedPublishedMenuDisplay(vendorId: string, menuVersionId: string) {
  return unstable_cache(
    async () => {
      const built = await buildPublishedMenuDisplay(vendorId, menuVersionId);
      if (!built) {
        return {
          menuVersionId,
          source: "published_canonical" as const,
          sections: [],
          variantChildCountByParentPlu: {},
          availabilityPoolByProductId: {},
          modifierGroupIds: [],
          modifierOptionIds: [],
        };
      }
      return built;
    },
    ["customer-vendor-menu-display", vendorId, menuVersionId],
    { tags: [customerVendorMenuCacheTag(vendorId)] }
  )();
}

export async function loadPublishedMenuVersionId(vendorId: string): Promise<string | null> {
  return loadActiveMenuVersionIdForVendor(vendorId);
}

export async function loadCachedCustomerVendorMenuDisplay(
  vendorId: string,
  menuVersionId: string
): Promise<CachedCustomerVendorMenuDisplay> {
  return cachedPublishedMenuDisplay(vendorId, menuVersionId);
}

/** Dynamic snooze / sold-out overlay — not cached. */
export async function loadCustomerVendorMenuAvailabilityOverlay(
  display: CachedCustomerVendorMenuDisplay
): Promise<CustomerVendorMenuAvailabilityOverlay> {
  const poolRowIds = [
    ...new Set(Object.values(display.availabilityPoolByProductId).flat()),
  ];

  const [itemRows, groupRows, optionRows] = await Promise.all([
    poolRowIds.length > 0
      ? prisma.menuItem.findMany({
          where: { id: { in: poolRowIds } },
          select: { id: true, isAvailable: true },
        })
      : Promise.resolve([]),
    display.modifierGroupIds.length > 0
      ? prisma.modifierGroup.findMany({
          where: { id: { in: display.modifierGroupIds } },
          select: { id: true, isAvailable: true },
        })
      : Promise.resolve([]),
    display.modifierOptionIds.length > 0
      ? prisma.modifierOption.findMany({
          where: { id: { in: display.modifierOptionIds } },
          select: { id: true, isAvailable: true },
        })
      : Promise.resolve([]),
  ]);

  const rowAvail = new Map(itemRows.map((r) => [r.id, r.isAvailable]));
  const itemAvailableByMenuItemId = new Map<string, boolean>();

  for (const section of display.sections) {
    for (const item of section.items) {
      const pid = item.deliverectProductId;
      if (pid && display.availabilityPoolByProductId[pid]) {
        const pool = display.availabilityPoolByProductId[pid]!;
        itemAvailableByMenuItemId.set(
          item.id,
          pool.every((id) => rowAvail.get(id) ?? false)
        );
      } else {
        itemAvailableByMenuItemId.set(item.id, rowAvail.get(item.id) ?? true);
      }
    }
  }

  return {
    itemAvailableByMenuItemId,
    modifierGroupAvailableById: new Map(groupRows.map((g) => [g.id, g.isAvailable])),
    modifierOptionAvailableById: new Map(optionRows.map((o) => [o.id, o.isAvailable])),
  };
}

export function applyAvailabilityOverlayToSections(
  sections: CustomerVendorMenuCategorySection[],
  overlay: CustomerVendorMenuAvailabilityOverlay
): CustomerVendorMenuCategorySection[] {
  return sections.map((section) => ({
    ...section,
    items: section.items
      .map((item) => ({
        ...item,
        isAvailable: overlay.itemAvailableByMenuItemId.get(item.id) ?? item.isAvailable,
        modifierGroups: item.modifierGroups.map((link) => ({
          ...link,
          modifierGroup: {
            ...link.modifierGroup,
            isAvailable:
              overlay.modifierGroupAvailableById.get(link.modifierGroup.id) ??
              link.modifierGroup.isAvailable,
            options: link.modifierGroup.options.map((opt) => ({
              ...opt,
              isAvailable:
                overlay.modifierOptionAvailableById.get(opt.id) ?? opt.isAvailable,
              nestedModifierGroups: opt.nestedModifierGroups?.map((ng) => ({
                ...ng,
                isAvailable:
                  overlay.modifierGroupAvailableById.get(ng.id) ?? ng.isAvailable,
                options: ng.options.map((nestedOpt) => ({
                  ...nestedOpt,
                  isAvailable:
                    overlay.modifierOptionAvailableById.get(nestedOpt.id) ??
                    nestedOpt.isAvailable,
                })),
              })),
            })),
          },
        })),
      }))
      .sort(sortItems),
  }));
}

export function mergeCachedDisplayWithAvailability(
  display: CachedCustomerVendorMenuDisplay,
  overlay: CustomerVendorMenuAvailabilityOverlay
): CustomerVendorMenuLoadResult {
  return {
    sections: applyAvailabilityOverlayToSections(display.sections, overlay),
    variantChildCountByParentPlu: new Map(Object.entries(display.variantChildCountByParentPlu)),
    source: display.source,
  };
}
