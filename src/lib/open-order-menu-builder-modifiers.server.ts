import "server-only";

import type { OpenOrderCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import {
  isOpenOrderModifierGroupDeliverectId,
  isOpenOrderModifierOptionDeliverectId,
  openOrderModifierGroupDeliverectId,
} from "@/lib/open-order-menu-ids";
import type { OpenOrderModifierGroupValidationRow } from "@/lib/open-order-modifier-validation";
import { toModifierValidationRow } from "@/lib/open-order-modifier-validation";

export type OpenOrderBuilderModifierOptionRow = {
  id: string;
  name: string;
  priceCents: number;
  isAvailable: boolean;
  sortOrder: number;
};

export type OpenOrderBuilderModifierGroupRow = {
  id: string;
  linkId: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  isAvailable: boolean;
  sortOrder: number;
  options: OpenOrderBuilderModifierOptionRow[];
};

export function toModifierValidationRowFromBuilderGroup(
  group: OpenOrderBuilderModifierGroupRow
): OpenOrderModifierGroupValidationRow {
  return toModifierValidationRow(group);
}

export async function loadOpenOrderBuilderModifierGroupsByItemId(
  vendorId: string,
  menuItemIds: string[]
): Promise<Map<string, OpenOrderBuilderModifierGroupRow[]>> {
  const result = new Map<string, OpenOrderBuilderModifierGroupRow[]>();
  if (menuItemIds.length === 0) return result;

  const links = await prisma.menuItemModifierGroup.findMany({
    where: {
      menuItemId: { in: menuItemIds },
      modifierGroup: {
        vendorId,
        parentModifierOptionId: null,
        deliverectModifierGroupId: { startsWith: "oo:modgrp:" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      modifierGroup: {
        include: {
          options: {
            where: { deliverectModifierId: { startsWith: "oo:modopt:" } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  for (const link of links) {
    const group = link.modifierGroup;
    if (!isOpenOrderModifierGroupDeliverectId(group.deliverectModifierGroupId)) continue;

    const row: OpenOrderBuilderModifierGroupRow = {
      id: group.id,
      linkId: link.id,
      name: group.name,
      required: link.required,
      minSelections: link.minSelections,
      maxSelections: link.maxSelections,
      isAvailable: group.isAvailable,
      sortOrder: link.sortOrder,
      options: group.options
        .filter((opt) => isOpenOrderModifierOptionDeliverectId(opt.deliverectModifierId))
        .map((opt) => ({
          id: opt.id,
          name: opt.name,
          priceCents: opt.priceCents,
          isAvailable: opt.isAvailable,
          sortOrder: opt.sortOrder,
        })),
    };

    const list = result.get(link.menuItemId) ?? [];
    list.push(row);
    result.set(link.menuItemId, list);
  }

  return result;
}

export function buildCanonicalModifierGroupDefinitions(
  groups: OpenOrderBuilderModifierGroupRow[]
): OpenOrderCanonicalMenu["modifierGroupDefinitions"] {
  const seen = new Set<string>();
  const definitions: OpenOrderCanonicalMenu["modifierGroupDefinitions"] = [];

  for (const group of groups) {
    const deliverectId = openOrderModifierGroupDeliverectId(group.id);
    if (seen.has(deliverectId)) continue;
    seen.add(deliverectId);

    definitions.push({
      deliverectId,
      name: group.name.trim(),
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      isRequired: group.required,
      sortOrder: group.sortOrder,
      parentDeliverectOptionId: null,
      isVariantGroup: false,
      multiMax: null,
      options: group.options.map((opt, index) => ({
        deliverectId: `oo:modopt:${opt.id}`,
        plu: null,
        name: opt.name.trim(),
        priceCents: opt.priceCents,
        sortOrder: opt.sortOrder ?? index,
        isDefault: false,
        isAvailable: opt.isAvailable,
        nestedGroupDeliverectIds: [],
      })),
    });
  }

  return definitions.sort((a, b) => a.sortOrder - b.sortOrder);
}
