import "server-only";

import { prisma } from "@/lib/db";
import {
  isSquareModifierOptionDeliverectId,
  isSquareProductDeliverectId,
} from "@/lib/integrations/square/square-menu-ids";
import { getOperationalMenuItemIdsForVendor } from "@/services/menu-active-scope.service";

export type SquareRoutingReadinessBlockerCode =
  | "LOCATION_UNSET"
  | "NEVER_MAPPED"
  | "MAPPING_INACTIVE"
  | "MAPPING_AT_DIFFERENT_LOCATION"
  | "MISSING_REQUIRED_MODIFIER_GROUP"
  | "MISSING_REQUIRED_MODIFIER_OPTION"
  | "INVALID_SQUARE_INTERNAL_ID"
  | "ARCHIVED_OR_INACTIVE_MAPPING";

export type SquareRoutingReadinessBlocker = {
  code: SquareRoutingReadinessBlockerCode;
  entityType: "menu_item" | "modifier_group" | "modifier_option" | "location";
  internalId: string;
  name?: string;
  selectedLocationId: string | null;
  alternateLocationIds?: string[];
  message: string;
};

export type SquareMenuMappingCoverage = {
  ready: boolean;
  totalSellableItems: number;
  mappedSellableItems: number;
  missingItemIds: string[];
  /** Square maps variations as menu_item PEM external IDs — same as items missing variation mapping. */
  missingVariationIds: string[];
  missingRequiredModifierGroupIds: string[];
  missingRequiredModifierOptionIds: string[];
  selectedLocationId: string | null;
  mappingsExistForAnotherLocation: boolean;
  alternateLocationIds: string[];
  blockers: SquareRoutingReadinessBlocker[];
};

function isRequiredGroupLink(link: {
  required: boolean;
  minSelections: number;
  modifierGroup: { isRequired: boolean; minSelections: number; isAvailable: boolean };
}): boolean {
  if (!link.modifierGroup.isAvailable) return false;
  return (
    link.required ||
    link.minSelections > 0 ||
    link.modifierGroup.isRequired ||
    link.modifierGroup.minSelections > 0
  );
}

/**
 * Full sellable-menu Square mapping coverage for a vendor at the selected location.
 * Unavailable / non-operational items are excluded (not counted as missing).
 */
export async function evaluateSquareMenuMappingCoverage(input: {
  vendorId: string;
  selectedLocationId: string | null;
}): Promise<SquareMenuMappingCoverage> {
  const selectedLocationId = input.selectedLocationId?.trim() || null;
  const empty = (overrides?: Partial<SquareMenuMappingCoverage>): SquareMenuMappingCoverage => ({
    ready: false,
    totalSellableItems: 0,
    mappedSellableItems: 0,
    missingItemIds: [],
    missingVariationIds: [],
    missingRequiredModifierGroupIds: [],
    missingRequiredModifierOptionIds: [],
    selectedLocationId,
    mappingsExistForAnotherLocation: false,
    alternateLocationIds: [],
    blockers: [],
    ...overrides,
  });

  if (!selectedLocationId) {
    return empty({
      blockers: [
        {
          code: "LOCATION_UNSET",
          entityType: "location",
          internalId: input.vendorId,
          selectedLocationId: null,
          message: "Square location is not selected.",
        },
      ],
    });
  }

  const operationalIds = await getOperationalMenuItemIdsForVendor(input.vendorId);
  const operationalList = [...operationalIds];
  if (operationalList.length === 0) {
    return empty({ ready: true });
  }

  const [items, allMappings] = await Promise.all([
    prisma.menuItem.findMany({
      where: { id: { in: operationalList }, isAvailable: true },
      select: {
        id: true,
        name: true,
        deliverectProductId: true,
        modifierGroups: {
          select: {
            required: true,
            minSelections: true,
            modifierGroup: {
              select: {
                id: true,
                name: true,
                isRequired: true,
                minSelections: true,
                isAvailable: true,
                deliverectModifierGroupId: true,
                options: {
                  where: { isAvailable: true },
                  select: {
                    id: true,
                    name: true,
                    deliverectModifierId: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.providerEntityMapping.findMany({
      where: { vendorId: input.vendorId, provider: "square" },
      select: {
        internalEntityId: true,
        internalEntityType: true,
        externalLocationId: true,
        isActive: true,
        externalId: true,
      },
    }),
  ]);

  const atSelected = allMappings.filter(
    (m) => m.externalLocationId === selectedLocationId
  );
  const activeAtSelected = atSelected.filter((m) => m.isActive);
  const activeItemAtSelected = new Map(
    activeAtSelected
      .filter((m) => m.internalEntityType === "menu_item")
      .map((m) => [m.internalEntityId, m])
  );
  const activeModAtSelected = new Map(
    activeAtSelected
      .filter((m) => m.internalEntityType === "modifier_option")
      .map((m) => [m.internalEntityId, m])
  );
  const activeGroupAtSelected = new Map(
    activeAtSelected
      .filter((m) => m.internalEntityType === "modifier_group")
      .map((m) => [m.internalEntityId, m])
  );

  const alternateLocationSet = new Set<string>();
  for (const m of allMappings) {
    if (
      m.isActive &&
      m.externalLocationId &&
      m.externalLocationId !== selectedLocationId
    ) {
      alternateLocationSet.add(m.externalLocationId);
    }
  }
  const alternateLocationIds = [...alternateLocationSet].sort();

  const blockers: SquareRoutingReadinessBlocker[] = [];
  const missingItemIds: string[] = [];
  const missingVariationIds: string[] = [];
  const missingRequiredModifierGroupIds: string[] = [];
  const missingRequiredModifierOptionIds: string[] = [];
  let mappedSellableItems = 0;
  let mappingsExistForAnotherLocation = false;

  for (const item of items) {
    const productId = item.deliverectProductId?.trim() ?? "";
    let itemRoutable = true;

    if (!productId || !isSquareProductDeliverectId(productId)) {
      itemRoutable = false;
      missingItemIds.push(item.id);
      missingVariationIds.push(item.id);
      blockers.push({
        code: "INVALID_SQUARE_INTERNAL_ID",
        entityType: "menu_item",
        internalId: item.id,
        name: item.name,
        selectedLocationId,
        message: `Menu item "${item.name}" is missing a Square catalog identity.`,
      });
    } else {
      const atLoc = activeItemAtSelected.get(productId);
      if (atLoc?.externalId?.trim()) {
        // ok
      } else {
        itemRoutable = false;
        missingItemIds.push(item.id);
        missingVariationIds.push(item.id);

        const elsewhere = allMappings.filter(
          (m) =>
            m.internalEntityType === "menu_item" &&
            m.internalEntityId === productId &&
            m.isActive &&
            m.externalLocationId &&
            m.externalLocationId !== selectedLocationId
        );
        const inactiveHere = atSelected.some(
          (m) =>
            m.internalEntityType === "menu_item" &&
            m.internalEntityId === productId &&
            !m.isActive
        );

        if (elsewhere.length > 0) {
          mappingsExistForAnotherLocation = true;
          const alts = [...new Set(elsewhere.map((m) => m.externalLocationId!).filter(Boolean))];
          for (const a of alts) alternateLocationSet.add(a);
          blockers.push({
            code: "MAPPING_AT_DIFFERENT_LOCATION",
            entityType: "menu_item",
            internalId: item.id,
            name: item.name,
            selectedLocationId,
            alternateLocationIds: alts,
            message: `Menu item "${item.name}" is mapped only at another Square location.`,
          });
        } else if (inactiveHere) {
          blockers.push({
            code: "MAPPING_INACTIVE",
            entityType: "menu_item",
            internalId: item.id,
            name: item.name,
            selectedLocationId,
            message: `Square mapping for "${item.name}" is inactive at the selected location.`,
          });
        } else {
          blockers.push({
            code: "NEVER_MAPPED",
            entityType: "menu_item",
            internalId: item.id,
            name: item.name,
            selectedLocationId,
            message: `No Square mapping for menu item "${item.name}" at the selected location.`,
          });
        }
      }
    }

    for (const link of item.modifierGroups) {
      if (!isRequiredGroupLink(link)) continue;
      const group = link.modifierGroup;
      const groupExternalId = group.deliverectModifierGroupId?.trim() ?? "";

      if (groupExternalId) {
        const groupMapped = activeGroupAtSelected.get(groupExternalId);
        if (!groupMapped?.externalId?.trim()) {
          const groupElsewhere = allMappings.some(
            (m) =>
              m.internalEntityType === "modifier_group" &&
              m.internalEntityId === groupExternalId &&
              m.isActive &&
              m.externalLocationId &&
              m.externalLocationId !== selectedLocationId
          );
          if (groupElsewhere) mappingsExistForAnotherLocation = true;
          if (!missingRequiredModifierGroupIds.includes(group.id)) {
            missingRequiredModifierGroupIds.push(group.id);
          }
          blockers.push({
            code: groupElsewhere
              ? "MAPPING_AT_DIFFERENT_LOCATION"
              : "MISSING_REQUIRED_MODIFIER_GROUP",
            entityType: "modifier_group",
            internalId: group.id,
            name: group.name,
            selectedLocationId,
            message: `Required modifier group "${group.name}" is not mapped at the selected Square location.`,
          });
          itemRoutable = false;
        }
      }

      for (const option of group.options) {
        const modId = option.deliverectModifierId?.trim() ?? "";
        if (!modId || !isSquareModifierOptionDeliverectId(modId)) {
          if (!missingRequiredModifierOptionIds.includes(option.id)) {
            missingRequiredModifierOptionIds.push(option.id);
          }
          blockers.push({
            code: "INVALID_SQUARE_INTERNAL_ID",
            entityType: "modifier_option",
            internalId: option.id,
            name: option.name,
            selectedLocationId,
            message: `Required modifier "${option.name}" is missing a Square catalog identity.`,
          });
          itemRoutable = false;
          continue;
        }

        const modMapped = activeModAtSelected.get(modId);
        if (modMapped?.externalId?.trim()) continue;

        const modElsewhere = allMappings.filter(
          (m) =>
            m.internalEntityType === "modifier_option" &&
            m.internalEntityId === modId &&
            m.isActive &&
            m.externalLocationId &&
            m.externalLocationId !== selectedLocationId
        );
        if (modElsewhere.length > 0) {
          mappingsExistForAnotherLocation = true;
          blockers.push({
            code: "MAPPING_AT_DIFFERENT_LOCATION",
            entityType: "modifier_option",
            internalId: option.id,
            name: option.name,
            selectedLocationId,
            alternateLocationIds: [
              ...new Set(modElsewhere.map((m) => m.externalLocationId!).filter(Boolean)),
            ],
            message: `Required modifier "${option.name}" is mapped only at another Square location.`,
          });
        } else {
          const inactiveHere = atSelected.some(
            (m) =>
              m.internalEntityType === "modifier_option" &&
              m.internalEntityId === modId &&
              !m.isActive
          );
          blockers.push({
            code: inactiveHere ? "MAPPING_INACTIVE" : "MISSING_REQUIRED_MODIFIER_OPTION",
            entityType: "modifier_option",
            internalId: option.id,
            name: option.name,
            selectedLocationId,
            message: `Required modifier "${option.name}" is not mapped at the selected Square location.`,
          });
        }
        if (!missingRequiredModifierOptionIds.includes(option.id)) {
          missingRequiredModifierOptionIds.push(option.id);
        }
        itemRoutable = false;
      }
    }

    if (itemRoutable) mappedSellableItems += 1;
  }

  const totalSellableItems = items.length;
  // Zero sellable items: coverage vacuously ready (connection/menu gates are separate).
  const finalReady =
    totalSellableItems === 0
      ? true
      : mappedSellableItems === totalSellableItems &&
        missingItemIds.length === 0 &&
        missingRequiredModifierGroupIds.length === 0 &&
        missingRequiredModifierOptionIds.length === 0;

  return {
    ready: finalReady,
    totalSellableItems,
    mappedSellableItems,
    missingItemIds,
    missingVariationIds,
    missingRequiredModifierGroupIds,
    missingRequiredModifierOptionIds,
    selectedLocationId,
    mappingsExistForAnotherLocation:
      mappingsExistForAnotherLocation || alternateLocationIds.length > 0,
    alternateLocationIds: [...alternateLocationSet].sort(),
    blockers,
  };
}

/**
 * Exact cart-line Square routability at the vendor's selected location.
 * Does not create Square orders.
 */
export async function evaluateSquareCartLinesRoutability(input: {
  vendorId: string;
  selectedLocationId: string | null;
  lines: Array<{
    cartItemId: string;
    menuItemId: string;
    menuItemName: string;
    deliverectProductId?: string | null;
    isAvailable: boolean;
    selections?: Array<{
      modifierOptionId: string;
      deliverectModifierId?: string | null;
      name?: string;
    }>;
  }>;
}): Promise<{
  ok: boolean;
  selectedLocationId: string | null;
  missingMenuItemIds: string[];
  missingModifierOptionIds: string[];
  alternateLocationIds: string[];
  blockers: SquareRoutingReadinessBlocker[];
}> {
  const selectedLocationId = input.selectedLocationId?.trim() || null;
  if (!selectedLocationId) {
    return {
      ok: false,
      selectedLocationId: null,
      missingMenuItemIds: input.lines.map((l) => l.menuItemId),
      missingModifierOptionIds: [],
      alternateLocationIds: [],
      blockers: [
        {
          code: "LOCATION_UNSET",
          entityType: "location",
          internalId: input.vendorId,
          selectedLocationId: null,
          message: "Square location is not selected.",
        },
      ],
    };
  }

  const allMappings = await prisma.providerEntityMapping.findMany({
    where: { vendorId: input.vendorId, provider: "square" },
    select: {
      internalEntityId: true,
      internalEntityType: true,
      externalLocationId: true,
      isActive: true,
      externalId: true,
    },
  });

  const activeAtSelected = allMappings.filter(
    (m) => m.isActive && m.externalLocationId === selectedLocationId
  );
  const itemMap = new Map(
    activeAtSelected
      .filter((m) => m.internalEntityType === "menu_item")
      .map((m) => [m.internalEntityId, m])
  );
  const modMap = new Map(
    activeAtSelected
      .filter((m) => m.internalEntityType === "modifier_option")
      .map((m) => [m.internalEntityId, m])
  );

  const blockers: SquareRoutingReadinessBlocker[] = [];
  const missingMenuItemIds: string[] = [];
  const missingModifierOptionIds: string[] = [];
  const alternateLocationIds = new Set<string>();

  for (const line of input.lines) {
    if (!line.isAvailable) {
      missingMenuItemIds.push(line.menuItemId);
      blockers.push({
        code: "ARCHIVED_OR_INACTIVE_MAPPING",
        entityType: "menu_item",
        internalId: line.menuItemId,
        name: line.menuItemName,
        selectedLocationId,
        message: `"${line.menuItemName}" is no longer available.`,
      });
      continue;
    }

    const productId = line.deliverectProductId?.trim() ?? "";
    if (!productId || !isSquareProductDeliverectId(productId)) {
      missingMenuItemIds.push(line.menuItemId);
      blockers.push({
        code: "INVALID_SQUARE_INTERNAL_ID",
        entityType: "menu_item",
        internalId: line.menuItemId,
        name: line.menuItemName,
        selectedLocationId,
        message: `"${line.menuItemName}" is missing a Square catalog mapping.`,
      });
    } else {
      const mapped = itemMap.get(productId);
      if (!mapped?.externalId?.trim()) {
        missingMenuItemIds.push(line.menuItemId);
        const elsewhere = allMappings.filter(
          (m) =>
            m.internalEntityType === "menu_item" &&
            m.internalEntityId === productId &&
            m.isActive &&
            m.externalLocationId &&
            m.externalLocationId !== selectedLocationId
        );
        for (const m of elsewhere) {
          if (m.externalLocationId) alternateLocationIds.add(m.externalLocationId);
        }
        blockers.push({
          code: elsewhere.length > 0 ? "MAPPING_AT_DIFFERENT_LOCATION" : "NEVER_MAPPED",
          entityType: "menu_item",
          internalId: line.menuItemId,
          name: line.menuItemName,
          selectedLocationId,
          alternateLocationIds: elsewhere
            .map((m) => m.externalLocationId)
            .filter((x): x is string => Boolean(x)),
          message:
            elsewhere.length > 0
              ? `"${line.menuItemName}" is mapped only at another Square location.`
              : `No active Square mapping for "${line.menuItemName}" at the selected location.`,
        });
      }
    }

    for (const sel of line.selections ?? []) {
      const modId = sel.deliverectModifierId?.trim() ?? "";
      if (!modId || !isSquareModifierOptionDeliverectId(modId)) {
        missingModifierOptionIds.push(sel.modifierOptionId);
        blockers.push({
          code: "INVALID_SQUARE_INTERNAL_ID",
          entityType: "modifier_option",
          internalId: sel.modifierOptionId,
          name: sel.name,
          selectedLocationId,
          message: `Selected modifier is missing a Square mapping.`,
        });
        continue;
      }
      const mapped = modMap.get(modId);
      if (!mapped?.externalId?.trim()) {
        missingModifierOptionIds.push(sel.modifierOptionId);
        const elsewhere = allMappings.filter(
          (m) =>
            m.internalEntityType === "modifier_option" &&
            m.internalEntityId === modId &&
            m.isActive &&
            m.externalLocationId &&
            m.externalLocationId !== selectedLocationId
        );
        for (const m of elsewhere) {
          if (m.externalLocationId) alternateLocationIds.add(m.externalLocationId);
        }
        blockers.push({
          code: elsewhere.length > 0 ? "MAPPING_AT_DIFFERENT_LOCATION" : "MISSING_REQUIRED_MODIFIER_OPTION",
          entityType: "modifier_option",
          internalId: sel.modifierOptionId,
          name: sel.name,
          selectedLocationId,
          alternateLocationIds: elsewhere
            .map((m) => m.externalLocationId)
            .filter((x): x is string => Boolean(x)),
          message: `Selected modifier is not mapped at the selected Square location.`,
        });
      }
    }
  }

  return {
    ok: blockers.length === 0,
    selectedLocationId,
    missingMenuItemIds: [...new Set(missingMenuItemIds)],
    missingModifierOptionIds: [...new Set(missingModifierOptionIds)],
    alternateLocationIds: [...alternateLocationIds].sort(),
    blockers,
  };
}
