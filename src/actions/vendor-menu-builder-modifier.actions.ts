"use server";

import { prisma } from "@/lib/db";
import { parseMenuPriceToCents } from "@/lib/menu-price";
import {
  openOrderModifierGroupDeliverectId,
  openOrderModifierOptionDeliverectId,
} from "@/lib/open-order-menu-ids";
import { validateModifierGroupBounds } from "@/lib/open-order-modifier-validation";
import {
  authorizeOpenOrderMenuBuilder,
  revalidateCustomerMenuSurfaces,
  type ActionResult,
} from "@/actions/vendor-menu-builder.actions";

async function assertOpenOrderBuilderMenuItem(vendorId: string, menuItemId: string) {
  const item = await prisma.menuItem.findFirst({
    where: {
      id: menuItemId,
      vendorId,
      deliverectProductId: { startsWith: "oo:prod:" },
    },
    select: { id: true },
  });
  if (!item) return { ok: false as const, error: "Item not found." };
  return { ok: true as const, item };
}

async function assertOpenOrderBuilderModifierGroup(
  vendorId: string,
  groupId: string,
  menuItemId?: string
) {
  const group = await prisma.modifierGroup.findFirst({
    where: {
      id: groupId,
      vendorId,
      deliverectModifierGroupId: { startsWith: "oo:modgrp:" },
      parentModifierOptionId: null,
    },
    select: {
      id: true,
      menuItems: menuItemId
        ? { where: { menuItemId }, select: { id: true, menuItemId: true } }
        : { select: { id: true, menuItemId: true }, take: 1 },
    },
  });
  if (!group) return { ok: false as const, error: "Modifier group not found." };
  if (menuItemId && group.menuItems.length === 0) {
    return { ok: false as const, error: "Modifier group not found on this item." };
  }
  return { ok: true as const, group };
}

function parseModifierBounds(input: {
  required?: boolean;
  minSelections?: number;
  maxSelections?: number;
}) {
  if (
    input.minSelections !== undefined &&
    (!Number.isInteger(input.minSelections) || input.minSelections < 0)
  ) {
    return { ok: false as const, error: "Min selections must be a whole number of 0 or more." };
  }
  if (
    input.maxSelections !== undefined &&
    (!Number.isInteger(input.maxSelections) || input.maxSelections < 1)
  ) {
    return { ok: false as const, error: "Max selections must be at least 1." };
  }

  return validateModifierGroupBounds({
    required: input.required ?? false,
    minSelections: input.minSelections ?? 0,
    maxSelections: input.maxSelections ?? 1,
  });
}

export async function createOpenOrderModifierGroup(
  vendorId: string,
  menuItemId: string,
  input?: { name?: string; required?: boolean; minSelections?: number; maxSelections?: number }
): Promise<ActionResult & { groupId?: string; linkId?: string }> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const itemCheck = await assertOpenOrderBuilderMenuItem(vendorId, menuItemId);
  if (!itemCheck.ok) return itemCheck;

  const bounds = parseModifierBounds({
    required: input?.required ?? false,
    minSelections: input?.minSelections ?? 0,
    maxSelections: input?.maxSelections ?? 1,
  });
  if (!bounds.ok) return { ok: false, error: bounds.error };

  const name = input?.name?.trim() || "New modifier group";
  if (name.length > 120) return { ok: false, error: "Group name must be at most 120 characters." };

  const [maxGroupSort, maxLinkSort] = await Promise.all([
    prisma.modifierGroup.aggregate({
      where: { vendorId, deliverectModifierGroupId: { startsWith: "oo:modgrp:" } },
      _max: { sortOrder: true },
    }),
    prisma.menuItemModifierGroup.aggregate({
      where: { menuItemId },
      _max: { sortOrder: true },
    }),
  ]);

  const group = await prisma.modifierGroup.create({
    data: {
      vendorId,
      name,
      minSelections: bounds.bounds.minSelections,
      maxSelections: bounds.bounds.maxSelections,
      isRequired: bounds.bounds.required,
      isAvailable: true,
      sortOrder: (maxGroupSort._max.sortOrder ?? -1) + 1,
      deliverectIsVariantGroup: false,
    },
    select: { id: true },
  });

  await prisma.modifierGroup.update({
    where: { id: group.id },
    data: { deliverectModifierGroupId: openOrderModifierGroupDeliverectId(group.id) },
  });

  const link = await prisma.menuItemModifierGroup.create({
    data: {
      menuItemId,
      modifierGroupId: group.id,
      required: bounds.bounds.required,
      minSelections: bounds.bounds.minSelections,
      maxSelections: bounds.bounds.maxSelections,
      sortOrder: (maxLinkSort._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true, groupId: group.id, linkId: link.id };
}

export async function updateOpenOrderModifierGroup(
  vendorId: string,
  menuItemId: string,
  groupId: string,
  input: {
    name?: string;
    required?: boolean;
    minSelections?: number;
    maxSelections?: number;
    isAvailable?: boolean;
  }
): Promise<ActionResult> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const groupCheck = await assertOpenOrderBuilderModifierGroup(vendorId, groupId, menuItemId);
  if (!groupCheck.ok) return groupCheck;

  const link = await prisma.menuItemModifierGroup.findUnique({
    where: {
      menuItemId_modifierGroupId: { menuItemId, modifierGroupId: groupId },
    },
    select: { required: true, minSelections: true, maxSelections: true },
  });
  if (!link) return { ok: false, error: "Modifier group not found on this item." };

  const bounds = parseModifierBounds({
    required: input.required ?? link.required,
    minSelections: input.minSelections ?? link.minSelections,
    maxSelections: input.maxSelections ?? link.maxSelections,
  });
  if (!bounds.ok) return { ok: false, error: bounds.error };

  const groupData: {
    name?: string;
    minSelections?: number;
    maxSelections?: number;
    isRequired?: boolean;
    isAvailable?: boolean;
  } = {
    minSelections: bounds.bounds.minSelections,
    maxSelections: bounds.bounds.maxSelections,
    isRequired: bounds.bounds.required,
  };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Group name is required." };
    if (name.length > 120) return { ok: false, error: "Group name must be at most 120 characters." };
    groupData.name = name;
  }
  if (input.isAvailable !== undefined) groupData.isAvailable = input.isAvailable;

  await prisma.$transaction([
    prisma.modifierGroup.update({ where: { id: groupId }, data: groupData }),
    prisma.menuItemModifierGroup.update({
      where: { menuItemId_modifierGroupId: { menuItemId, modifierGroupId: groupId } },
      data: {
        required: bounds.bounds.required,
        minSelections: bounds.bounds.minSelections,
        maxSelections: bounds.bounds.maxSelections,
      },
    }),
  ]);

  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true };
}

export async function deleteOpenOrderModifierGroup(
  vendorId: string,
  menuItemId: string,
  groupId: string
): Promise<ActionResult> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const groupCheck = await assertOpenOrderBuilderModifierGroup(vendorId, groupId, menuItemId);
  if (!groupCheck.ok) return groupCheck;

  const optionIds = await prisma.modifierOption.findMany({
    where: { modifierGroupId: groupId },
    select: { id: true },
  });
  if (optionIds.length > 0) {
    const [cartUse, orderUse] = await Promise.all([
      prisma.cartItemSelection.count({
        where: { modifierOptionId: { in: optionIds.map((o) => o.id) } },
      }),
      prisma.orderLineItemSelection.count({
        where: { modifierOptionId: { in: optionIds.map((o) => o.id) } },
      }),
    ]);
    if (cartUse > 0 || orderUse > 0) {
      return {
        ok: false,
        error: "This modifier group is in active carts or orders and cannot be deleted.",
      };
    }
  }

  await prisma.modifierGroup.delete({ where: { id: groupId } });
  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true };
}

export async function createOpenOrderModifierOption(
  vendorId: string,
  menuItemId: string,
  groupId: string,
  input: { name: string; price?: string }
): Promise<ActionResult & { optionId?: string }> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const groupCheck = await assertOpenOrderBuilderModifierGroup(vendorId, groupId, menuItemId);
  if (!groupCheck.ok) return groupCheck;

  const name = input.name?.trim() ?? "";
  if (!name) return { ok: false, error: "Option name is required." };
  if (name.length > 120) return { ok: false, error: "Option name must be at most 120 characters." };

  const parsed = parseMenuPriceToCents(input.price ?? "0");
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const maxSort = await prisma.modifierOption.aggregate({
    where: { modifierGroupId: groupId },
    _max: { sortOrder: true },
  });

  const option = await prisma.modifierOption.create({
    data: {
      modifierGroupId: groupId,
      name,
      priceCents: parsed.cents,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      isAvailable: true,
      isDefault: false,
    },
    select: { id: true },
  });

  await prisma.modifierOption.update({
    where: { id: option.id },
    data: { deliverectModifierId: openOrderModifierOptionDeliverectId(option.id) },
  });

  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true, optionId: option.id };
}

export async function updateOpenOrderModifierOption(
  vendorId: string,
  menuItemId: string,
  groupId: string,
  optionId: string,
  input: { name?: string; price?: string; isAvailable?: boolean }
): Promise<ActionResult> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const groupCheck = await assertOpenOrderBuilderModifierGroup(vendorId, groupId, menuItemId);
  if (!groupCheck.ok) return groupCheck;

  const existing = await prisma.modifierOption.findFirst({
    where: {
      id: optionId,
      modifierGroupId: groupId,
      deliverectModifierId: { startsWith: "oo:modopt:" },
    },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Modifier option not found." };

  const data: { name?: string; priceCents?: number; isAvailable?: boolean } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Option name is required." };
    if (name.length > 120) return { ok: false, error: "Option name must be at most 120 characters." };
    data.name = name;
  }
  if (input.price !== undefined) {
    const parsed = parseMenuPriceToCents(input.price);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    data.priceCents = parsed.cents;
  }
  if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;

  await prisma.modifierOption.update({ where: { id: optionId }, data });
  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true };
}

export async function deleteOpenOrderModifierOption(
  vendorId: string,
  menuItemId: string,
  groupId: string,
  optionId: string
): Promise<ActionResult> {
  const authz = await authorizeOpenOrderMenuBuilder(vendorId);
  if (!authz.ok) return authz;

  const groupCheck = await assertOpenOrderBuilderModifierGroup(vendorId, groupId, menuItemId);
  if (!groupCheck.ok) return groupCheck;

  const existing = await prisma.modifierOption.findFirst({
    where: {
      id: optionId,
      modifierGroupId: groupId,
      deliverectModifierId: { startsWith: "oo:modopt:" },
    },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Modifier option not found." };

  const [cartUse, orderUse] = await Promise.all([
    prisma.cartItemSelection.count({ where: { modifierOptionId: optionId } }),
    prisma.orderLineItemSelection.count({ where: { modifierOptionId: optionId } }),
  ]);
  if (cartUse > 0 || orderUse > 0) {
    return {
      ok: false,
      error: "This option is in active carts or orders and cannot be deleted.",
    };
  }

  await prisma.modifierOption.delete({ where: { id: optionId } });
  await revalidateCustomerMenuSurfaces(vendorId);
  return { ok: true };
}
