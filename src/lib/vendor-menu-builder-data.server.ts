import "server-only";

import { prisma } from "@/lib/db";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { loadOpenOrderMenuBuilderValidation, loadOpenOrderMenuPublishState } from "@/services/open-order-menu-publish.service";
import { requireVendorMenuSourceContext } from "@/lib/vendor-menu-route-guard.server";
import type { OpenOrderBuilderModifierGroupRow } from "@/lib/open-order-menu-builder-modifiers.server";
import { loadOpenOrderBuilderModifierGroupsByItemId } from "@/lib/open-order-menu-builder-modifiers.server";

export type VendorMenuBuilderModifierOption = OpenOrderBuilderModifierGroupRow["options"][number];
export type VendorMenuBuilderModifierGroup = OpenOrderBuilderModifierGroupRow;

export type VendorMenuBuilderPageData = {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  categories: Array<{
    id: string;
    name: string;
    sortOrder: number;
    isVisible: boolean;
    itemCount: number;
  }>;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    isAvailable: boolean;
    sortOrder: number;
    categoryId: string | null;
    imageUrl: string | null;
    updatedAt: string;
    modifierGroups: VendorMenuBuilderModifierGroup[];
  }>;
  validation: Awaited<ReturnType<typeof loadOpenOrderMenuBuilderValidation>>;
  hasPublishedOpenOrderMenu: boolean;
  hasUnpublishedChanges: boolean;
  publishedAtIso: string | null;
  lastUpdatedIso: string | null;
  storefrontHref: string | null;
};

export async function loadVendorMenuBuilderPageData(
  vendorId: string
): Promise<VendorMenuBuilderPageData | null> {
  const vendor = await requireVendorMenuSourceContext(vendorId);

  const [categories, items, validation, publishState, podLink] = await Promise.all([
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
        imageUrl: true,
        deliverectCategoryId: true,
        updatedAt: true,
      },
    }),
    loadOpenOrderMenuBuilderValidation(vendorId),
    loadOpenOrderMenuPublishState(vendorId),
    prisma.podVendor.findFirst({
      where: { vendorId, isActive: true, pod: { isActive: true } },
      select: { pod: { select: { slug: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const itemCountByCategory = new Map<string, number>();
  for (const item of items) {
    const match = item.deliverectCategoryId?.match(/^oo:cat:(.+)$/);
    if (match?.[1]) {
      itemCountByCategory.set(match[1], (itemCountByCategory.get(match[1]) ?? 0) + 1);
    }
  }

  const lastUpdated = items.reduce<Date | null>(
    (max, item) => (!max || item.updatedAt > max ? item.updatedAt : max),
    null
  );

  const itemIds = items.map((item) => item.id);
  const modifierGroupsByItemId = await loadOpenOrderBuilderModifierGroupsByItemId(vendorId, itemIds);

  const podSlug = podLink?.pod.slug;
  const storefrontHref = podSlug
    ? buildVendorMenuCustomerPath(podSlug, vendor.slug)
    : null;

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorSlug: vendor.slug,
    categories: categories.map((c) => ({
      ...c,
      itemCount: itemCountByCategory.get(c.id) ?? 0,
    })),
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      priceCents: item.priceCents,
      isAvailable: item.isAvailable,
      sortOrder: item.sortOrder,
      imageUrl: item.imageUrl,
      categoryId: item.deliverectCategoryId?.replace(/^oo:cat:/, "") ?? null,
      updatedAt: item.updatedAt.toISOString(),
      modifierGroups: modifierGroupsByItemId.get(item.id) ?? [],
    })),
    validation,
    hasPublishedOpenOrderMenu: publishState.hasPublishedOpenOrderMenu,
    hasUnpublishedChanges: publishState.hasUnpublishedChanges,
    publishedAtIso: publishState.publishedAtIso,
    lastUpdatedIso: lastUpdated?.toISOString() ?? null,
    storefrontHref,
  };
}

export function isOpenOrderBuilderMenuItem(deliverectProductId: string | null): boolean {
  return deliverectProductId?.startsWith("oo:prod:") ?? false;
}
