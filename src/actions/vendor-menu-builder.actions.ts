"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { buildPodCustomerPath, buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { parseMenuPriceToCents } from "@/lib/menu-price";
import { authorizeVendorSettingsWrite } from "@/lib/server/vendor-settings-authorization";
import {
  openOrderCategoryDeliverectId,
  openOrderProductDeliverectId,
} from "@/lib/open-order-menu-ids";
import { isOpenOrderMenuSource } from "@/lib/vendor-menu-source";
import {
  OpenOrderMenuPublishError,
  publishOpenOrderMenuFromBuilder,
} from "@/services/open-order-menu-publish.service";
import { revalidateCustomerVendorMenuCacheForVendor } from "@/services/vendor-customer-menu-cache.service";
import { revalidateOperationalMenuCacheForVendor } from "@/services/menu-active-scope.service";

type ActionResult = { ok: true } | { ok: false; error: string };

export type { ActionResult };

export async function authorizeOpenOrderMenuBuilder(vendorId: string): Promise<ActionResult | { ok: true }> {
  const authz = await authorizeVendorSettingsWrite(vendorId);
  if (!authz.ok) return authz;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { menuSource: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (!isOpenOrderMenuSource(vendor)) {
    return { ok: false, error: "This vendor uses Deliverect menu sync, not the Open Order Menu Builder." };
  }
  return { ok: true };
}

export async function revalidateCustomerMenuSurfaces(vendorId: string) {
  const id = vendorId.trim();
  revalidateOperationalMenuCacheForVendor(id);
  revalidateCustomerVendorMenuCacheForVendor(id);

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { slug: true },
  });

  const pods = await prisma.podVendor.findMany({
    where: { vendorId: id },
    select: { podId: true, pod: { select: { slug: true } } },
  });
  for (const { podId, pod } of pods) {
    revalidatePath(`/pod/${podId}`);
    if (pod.slug) {
      revalidatePath(buildPodCustomerPath(pod.slug));
      if (vendor?.slug) {
        revalidatePath(buildVendorMenuCustomerPath(pod.slug, vendor.slug));
      }
    }
    revalidatePath(`/pod/${podId}/vendor/${id}`);
  }
}

async function revalidateMenuBuilderSurfaces(vendorId: string) {
  const id = vendorId.trim();
  await revalidateCustomerMenuSurfaces(id);
  revalidatePath(`/vendor/${id}/menu-builder`);
  revalidatePath(`/vendor/${id}/menu`);
  revalidatePath(`/vendor/${id}/setup`);
  revalidatePath(`/vendor/${id}/dashboard`);
}

function parsePriceToCents(raw: string): number | null {
  const parsed = parseMenuPriceToCents(raw);
  return parsed.ok ? parsed.cents : null;
}

export async function createOpenOrderMenuCategory(
  vendorId: string,
  input: { name: string }
): Promise<ActionResult & { categoryId?: string }> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const name = input.name?.trim() ?? "";
  if (!name) return { ok: false, error: "Category name is required." };
  if (name.length > 120) return { ok: false, error: "Category name must be at most 120 characters." };

  const maxSort = await prisma.vendorMenuCategory.aggregate({
    where: { vendorId },
    _max: { sortOrder: true },
  });

  const category = await prisma.vendorMenuCategory.create({
    data: {
      vendorId,
      name,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true, categoryId: category.id };
}

export async function updateOpenOrderMenuCategory(
  vendorId: string,
  categoryId: string,
  input: { name?: string; isVisible?: boolean; sortOrder?: number }
): Promise<ActionResult> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const existing = await prisma.vendorMenuCategory.findFirst({
    where: { id: categoryId, vendorId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Category not found." };

  const data: { name?: string; isVisible?: boolean; sortOrder?: number } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Category name is required." };
    if (name.length > 120) return { ok: false, error: "Category name must be at most 120 characters." };
    data.name = name;
  }
  if (input.isVisible !== undefined) data.isVisible = input.isVisible;
  if (input.sortOrder !== undefined) {
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
      return { ok: false, error: "Invalid sort order." };
    }
    data.sortOrder = input.sortOrder;
  }

  await prisma.vendorMenuCategory.update({ where: { id: categoryId }, data });
  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true };
}

export async function deleteOpenOrderMenuCategory(
  vendorId: string,
  categoryId: string
): Promise<ActionResult> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const existing = await prisma.vendorMenuCategory.findFirst({
    where: { id: categoryId, vendorId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Category not found." };

  const itemCount = await prisma.menuItem.count({
    where: {
      vendorId,
      deliverectCategoryId: openOrderCategoryDeliverectId(categoryId),
    },
  });
  if (itemCount > 0) {
    return {
      ok: false,
      error: "Move or delete items in this category before deleting it.",
    };
  }

  await prisma.vendorMenuCategory.delete({ where: { id: categoryId } });
  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true };
}

export async function createOpenOrderMenuItem(
  vendorId: string,
  input: {
    name: string;
    description?: string;
    price: string;
    categoryId: string;
  }
): Promise<ActionResult & { itemId?: string }> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const name = input.name?.trim() ?? "";
  if (!name) return { ok: false, error: "Item name is required." };
  if (name.length > 160) return { ok: false, error: "Item name must be at most 160 characters." };

  const category = await prisma.vendorMenuCategory.findFirst({
    where: { id: input.categoryId, vendorId },
    select: { id: true },
  });
  if (!category) return { ok: false, error: "Category not found." };

  const priceCents = parsePriceToCents(input.price);
  if (priceCents == null) {
    return { ok: false, error: "Price must be a valid dollar amount." };
  }

  const description = input.description?.trim() || null;
  if (description && description.length > 2000) {
    return { ok: false, error: "Description must be at most 2000 characters." };
  }

  const maxSort = await prisma.menuItem.aggregate({
    where: { vendorId, deliverectProductId: { startsWith: "oo:prod:" } },
    _max: { sortOrder: true },
  });

  const item = await prisma.menuItem.create({
    data: {
      vendorId,
      name,
      description,
      priceCents,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      deliverectCategoryId: openOrderCategoryDeliverectId(category.id),
      isAvailable: true,
    },
    select: { id: true },
  });

  await prisma.menuItem.update({
    where: { id: item.id },
    data: { deliverectProductId: openOrderProductDeliverectId(item.id) },
  });

  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true, itemId: item.id };
}

export async function updateOpenOrderMenuItem(
  vendorId: string,
  itemId: string,
  input: {
    name?: string;
    description?: string;
    price?: string;
    categoryId?: string;
    isAvailable?: boolean;
    sortOrder?: number;
  }
): Promise<ActionResult> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const existing = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      vendorId,
      deliverectProductId: { startsWith: "oo:prod:" },
    },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Item not found." };

  const data: {
    name?: string;
    description?: string | null;
    priceCents?: number;
    deliverectCategoryId?: string;
    isAvailable?: boolean;
    sortOrder?: number;
  } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Item name is required." };
    if (name.length > 160) return { ok: false, error: "Item name must be at most 160 characters." };
    data.name = name;
  }
  if (input.description !== undefined) {
    const description = input.description.trim() || null;
    if (description && description.length > 2000) {
      return { ok: false, error: "Description must be at most 2000 characters." };
    }
    data.description = description;
  }
  if (input.price !== undefined) {
    const priceCents = parsePriceToCents(input.price);
    if (priceCents == null) return { ok: false, error: "Price must be a valid dollar amount." };
    data.priceCents = priceCents;
  }
  if (input.categoryId !== undefined) {
    const category = await prisma.vendorMenuCategory.findFirst({
      where: { id: input.categoryId, vendorId },
      select: { id: true },
    });
    if (!category) return { ok: false, error: "Category not found." };
    data.deliverectCategoryId = openOrderCategoryDeliverectId(category.id);
  }
  if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
  if (input.sortOrder !== undefined) {
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0) {
      return { ok: false, error: "Invalid sort order." };
    }
    data.sortOrder = input.sortOrder;
  }

  await prisma.menuItem.update({ where: { id: itemId }, data });
  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true };
}

export async function deleteOpenOrderMenuItem(vendorId: string, itemId: string): Promise<ActionResult> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const existing = await prisma.menuItem.findFirst({
    where: {
      id: itemId,
      vendorId,
      deliverectProductId: { startsWith: "oo:prod:" },
    },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Item not found." };

  const cartUse = await prisma.cartItem.count({ where: { menuItemId: itemId } });
  const orderUse = await prisma.orderLineItem.count({ where: { menuItemId: itemId } });
  if (cartUse > 0 || orderUse > 0) {
    await prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: false },
    });
    await revalidateCustomerMenuSurfaces(vendorId);
    return {
      ok: false,
      error: "This item has order history and was marked unavailable instead of deleted.",
    };
  }

  await prisma.menuItem.delete({ where: { id: itemId } });
  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true };
}

export async function publishOpenOrderMenuAction(vendorId: string): Promise<ActionResult & { message?: string }> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  try {
    await publishOpenOrderMenuFromBuilder({
      vendorId,
      publishedBy: "vendor_menu_builder",
    });
    await revalidateMenuBuilderSurfaces(vendorId);
    return { ok: true, message: "Menu published to your storefront." };
  } catch (err) {
    if (err instanceof OpenOrderMenuPublishError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
