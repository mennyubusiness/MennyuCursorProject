/**
 * Customer-facing vendor menu: source of truth is the latest published MenuVersion canonical,
 * so we never list soft-disabled legacy MenuItem rows (e.g. null deliverectProductId or
 * products removed from the current publish set).
 *
 * Display structure is cached per vendor + published menu version; availability is overlaid dynamically.
 */
import "server-only";

import { type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getOperationalMenuItemIdsForVendor,
} from "@/services/menu-active-scope.service";
import {
  loadCachedCustomerVendorMenuDisplay,
  loadCustomerVendorMenuAvailabilityOverlay,
  loadPublishedMenuVersionId,
  mergeCachedDisplayWithAvailability,
  type CachedCustomerVendorMenuDisplay,
} from "@/services/vendor-customer-menu-cache.service";

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
  /** Parent shell PLU → variant leaf MenuItem count (for modifier group classification in UI). */
  variantChildCountByParentPlu: Map<string, number>;
  /** How the menu was built (for debugging / future telemetry). */
  source: "published_canonical" | "fallback_active_with_deliverect_id";
};

const DEBUG_VENDOR_MENU_LOAD = process.env.NODE_ENV === "development";

function devLogVendorMenuLoad(label: string, vendorId: string, ms: number, extra?: Record<string, unknown>) {
  if (!DEBUG_VENDOR_MENU_LOAD) return;
  console.info("[vendor-menu-load]", { label, vendorId, ms, ...extra });
}

async function loadFallbackMenuDisplay(vendorId: string): Promise<CachedCustomerVendorMenuDisplay> {
  const [rows, operationalIds] = await Promise.all([
    prisma.menuItem.findMany({
      where: {
        vendorId,
        deliverectProductId: { not: null },
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: CUSTOMER_VENDOR_MENU_ITEM_INCLUDE,
    }),
    getOperationalMenuItemIdsForVendor(vendorId),
  ]);

  const activeRows = rows.filter(
    (r) =>
      operationalIds.has(r.id) &&
      !r.deliverectVariantParentPlu?.trim()
  );

  const variantChildCountByParentPlu: Record<string, number> = {};
  for (const row of activeRows) {
    const parentPlu = row.deliverectVariantParentPlu?.trim();
    if (!parentPlu) continue;
    variantChildCountByParentPlu[parentPlu] =
      (variantChildCountByParentPlu[parentPlu] ?? 0) + 1;
  }

  const availabilityPoolByProductId: Record<string, string[]> = {};
  for (const row of activeRows) {
    if (!row.deliverectProductId) continue;
    availabilityPoolByProductId[row.deliverectProductId] = [row.id];
  }

  const sections: CustomerVendorMenuCategorySection[] =
    activeRows.length === 0
      ? []
      : [
          {
            id: "all",
            name: "Menu",
            sortOrder: 0,
            items: activeRows.map((r) => ({ ...r, isAvailable: true })),
          },
        ];

  const modifierGroupIds = new Set<string>();
  const modifierOptionIds = new Set<string>();
  for (const item of activeRows) {
    for (const link of item.modifierGroups) {
      modifierGroupIds.add(link.modifierGroup.id);
      for (const opt of link.modifierGroup.options) {
        modifierOptionIds.add(opt.id);
        for (const ng of opt.nestedModifierGroups ?? []) {
          modifierGroupIds.add(ng.id);
          for (const nestedOpt of ng.options) modifierOptionIds.add(nestedOpt.id);
        }
      }
    }
  }

  return {
    menuVersionId: null,
    source: "fallback_active_with_deliverect_id",
    sections,
    variantChildCountByParentPlu,
    availabilityPoolByProductId,
    modifierGroupIds: [...modifierGroupIds],
    modifierOptionIds: [...modifierOptionIds],
  };
}

/**
 * Load menu sections for the customer vendor page from the published canonical + live MenuItem rows.
 * Display structure is cached; availability/snooze is refreshed on every request.
 */
export async function loadCustomerVendorMenuSections(
  vendorId: string
): Promise<CustomerVendorMenuLoadResult> {
  const versionStarted = Date.now();
  const menuVersionId = await loadPublishedMenuVersionId(vendorId);
  devLogVendorMenuLoad("menuVersionMeta", vendorId, Date.now() - versionStarted);

  const displayStarted = Date.now();
  const display: CachedCustomerVendorMenuDisplay = menuVersionId
    ? await loadCachedCustomerVendorMenuDisplay(vendorId, menuVersionId)
    : await loadFallbackMenuDisplay(vendorId);
  devLogVendorMenuLoad("menuDisplay", vendorId, Date.now() - displayStarted, {
    source: display.source,
    menuVersionId: display.menuVersionId,
    sectionCount: display.sections.length,
    cached: Boolean(menuVersionId),
  });

  const overlayStarted = Date.now();
  const overlay = await loadCustomerVendorMenuAvailabilityOverlay(display);
  devLogVendorMenuLoad("availabilityOverlay", vendorId, Date.now() - overlayStarted, {
    itemCount: overlay.itemAvailableByMenuItemId.size,
  });

  return mergeCachedDisplayWithAvailability(display, overlay);
}

export { customerMenuCategoryDomId } from "@/lib/vendor-menu-category-id";
