/**
 * Customer-facing vendor menu: source of truth is the latest published MenuVersion canonical,
 * so we never list soft-disabled legacy MenuItem rows (e.g. null deliverectProductId or
 * products removed from the current publish set).
 */
import "server-only";
import { MenuVersionState, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  mennyuCanonicalMenuSchema,
  type MennyuCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";

export const CUSTOMER_VENDOR_MENU_ITEM_INCLUDE = {
  modifierGroups: {
    orderBy: { sortOrder: "asc" },
    include: {
      modifierGroup: {
        include: {
          options: {
            orderBy: { sortOrder: "asc" },
            include: {
              nestedModifierGroups: {
                include: {
                  options: { orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.MenuItemInclude;

export type CustomerVendorMenuItem = Prisma.MenuItemGetPayload<{
  include: typeof CUSTOMER_VENDOR_MENU_ITEM_INCLUDE;
}>;

export type CustomerVendorMenuCategorySection = {
  /** Stable id for anchors (Deliverect category id or `uncategorized`). */
  id: string;
  name: string;
  sortOrder: number;
  items: CustomerVendorMenuItem[];
};

export type CustomerVendorMenuLoadResult = {
  sections: CustomerVendorMenuCategorySection[];
  /** How the menu was built (for debugging / future telemetry). */
  source: "published_canonical" | "fallback_active_with_deliverect_id";
};

function sortItems(a: CustomerVendorMenuItem, b: CustomerVendorMenuItem): number {
  if (a.isAvailable === b.isAvailable) return a.sortOrder - b.sortOrder;
  return a.isAvailable ? -1 : 1;
}

function buildSectionsFromCanonical(
  menu: MennyuCanonicalMenu,
  byProductId: Map<string, CustomerVendorMenuItem>
): CustomerVendorMenuCategorySection[] {
  const sections: CustomerVendorMenuCategorySection[] = [];

  const sortedCategories = [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const cat of sortedCategories) {
    const items: CustomerVendorMenuItem[] = [];
    for (const pid of cat.productDeliverectIds) {
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

/**
 * Load menu sections for the customer vendor page from the published canonical + live MenuItem rows.
 */
export async function loadCustomerVendorMenuSections(
  vendorId: string
): Promise<CustomerVendorMenuLoadResult> {
  const published = await prisma.menuVersion.findFirst({
    where: { vendorId, state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { canonicalSnapshot: true },
  });

  if (published?.canonicalSnapshot != null) {
    const parsed = mennyuCanonicalMenuSchema.safeParse(published.canonicalSnapshot);
    if (parsed.success) {
      const menu = parsed.data;
      const productIds = [...new Set(menu.products.map((p) => p.deliverectId))];
      if (productIds.length === 0) {
        return { sections: [], source: "published_canonical" };
      }

      const rows = await prisma.menuItem.findMany({
        where: {
          vendorId,
          deliverectProductId: { in: productIds },
        },
        include: CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
      });

      /**
       * Multiple DB rows can share the same deliverectProductId (legacy publishes, etc.).
       * - Representative row: latest `updatedAt` (matches most recent publish/snooze).
       * - `isAvailable`: false if ANY duplicate is unavailable — must match cart/checkout
       *   {@link effectiveAvailabilityByMenuItemId} in `menu-item-availability.service`.
       */
      const groupedByProduct = new Map<string, CustomerVendorMenuItem[]>();
      for (const r of rows) {
        if (!r.deliverectProductId) continue;
        const list = groupedByProduct.get(r.deliverectProductId) ?? [];
        list.push(r);
        groupedByProduct.set(r.deliverectProductId, list);
      }

      const byProductId = new Map<string, CustomerVendorMenuItem>();
      for (const [pid, list] of groupedByProduct) {
        const sorted = [...list].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        const rep = sorted[0]!;
        const mergedAvailable = list.every((r) => r.isAvailable);
        byProductId.set(pid, { ...rep, isAvailable: mergedAvailable });
      }

      const sections = buildSectionsFromCanonical(menu, byProductId);
      return { sections, source: "published_canonical" };
    }
  }

  /** No valid published snapshot: exclude legacy rows without Deliverect id and soft-disabled items. */
  const rows = await prisma.menuItem.findMany({
    where: {
      vendorId,
      deliverectProductId: { not: null },
      isAvailable: true,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
  });

  return {
    sections:
      rows.length === 0
        ? []
        : [
            {
              id: "all",
              name: "Menu",
              sortOrder: 0,
              items: rows,
            },
          ],
    source: "fallback_active_with_deliverect_id",
  };
}

/** HTML-safe fragment id for category anchors. */
export function customerMenuCategoryDomId(sectionId: string): string {
  return `menu-cat-${sectionId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
