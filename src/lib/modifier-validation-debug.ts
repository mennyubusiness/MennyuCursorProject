/**
 * Temporary diagnostics for modifier / Deliverect variant add-to-cart failures.
 * Enable with DEBUG_ADD_TO_CART_TRACE in cart.service / cart.actions / ModifierModal.
 */

import type { OpenOrderModifierGroupKind } from "@/domain/modifier-group-kind";
import {
  classifyMenuItemModifierLink,
  formatModifierGroupNoteFromClassification,
} from "@/lib/modifier-group-rules";
import { isTopLevelDeliverectVariantGroupModifierGroup } from "@/lib/deliverect-subitem-nesting";

export type ModifierGroupValidationDebugRow = {
  groupId: string;
  groupName: string;
  source: "open_order_db";
  deliverectIsVariantGroup: boolean;
  isTopLevelVariantGroup: boolean;
  groupAvailable: boolean;
  linkRequired: boolean;
  linkMinSelections: number;
  linkMaxSelections: number;
  groupMinSelections: number;
  groupMaxSelections: number;
  variantChildMenuItemCount: number;
  openOrderGroupKind: OpenOrderModifierGroupKind;
  optionCount: number;
  availableOptionCount: number;
  uiShortNote: string;
  selectedCount: number;
  validationPassed: boolean;
  failReason?: string;
};

type GroupLinkLike = {
  required: boolean;
  minSelections: number;
  maxSelections: number;
  modifierGroup: {
    id: string;
    name: string;
    minSelections: number;
    maxSelections: number;
    isAvailable: boolean;
    deliverectIsVariantGroup?: boolean | null;
    parentModifierOptionId?: string | null;
    options?: Array<{ id: string; isAvailable: boolean }>;
  };
};

export function buildModifierGroupValidationDebugRows(
  groups: GroupLinkLike[],
  selectionByOptionId: Map<string, number>,
  variantChildMenuItemCount = 0
): ModifierGroupValidationDebugRow[] {
  const rows: ModifierGroupValidationDebugRow[] = [];

  for (const link of groups) {
    if (link.modifierGroup.parentModifierOptionId != null) continue;

    const group = link.modifierGroup;
    const options = group.options ?? [];
    const availableOptions = options.filter((o) => o.isAvailable);
    let selectedCount = 0;
    for (const opt of options) {
      selectedCount += selectionByOptionId.get(opt.id) ?? 0;
    }

    const classification = classifyMenuItemModifierLink(link, variantChildMenuItemCount);
    const isTopLevelVariant = isTopLevelDeliverectVariantGroupModifierGroup({
      deliverectIsVariantGroup: group.deliverectIsVariantGroup ?? null,
      parentModifierOptionId: group.parentModifierOptionId ?? null,
    });

    let validationPassed = true;
    let failReason: string | undefined;

    if (!classification.isAvailable && classification.required) {
      validationPassed = false;
      failReason = "group_unavailable_but_required";
    } else if (classification.isAvailable) {
      if (classification.blocksAddToCartWhenEmpty && selectedCount < classification.minSelections) {
        validationPassed = false;
        failReason = "required_min_not_met";
      } else if (selectedCount < classification.minSelections) {
        validationPassed = false;
        failReason = "min_selections_not_met";
      } else if (selectedCount > classification.maxSelections) {
        validationPassed = false;
        failReason = "max_selections_exceeded";
      }
    }

    rows.push({
      groupId: group.id,
      groupName: group.name,
      source: "open_order_db",
      deliverectIsVariantGroup: classification.deliverectIsVariantGroup,
      isTopLevelVariantGroup: isTopLevelVariant,
      groupAvailable: group.isAvailable,
      linkRequired: link.required,
      linkMinSelections: link.minSelections,
      linkMaxSelections: link.maxSelections,
      groupMinSelections: group.minSelections,
      groupMaxSelections: group.maxSelections,
      variantChildMenuItemCount,
      openOrderGroupKind: classification.kind,
      optionCount: options.length,
      availableOptionCount: availableOptions.length,
      uiShortNote: formatModifierGroupNoteFromClassification(classification),
      selectedCount,
      validationPassed,
      failReason,
    });
  }

  return rows;
}

export function logModifierValidationDebug(
  context: string,
  payload: {
    menuItemId: string;
    menuItemName: string;
    deliverectPlu?: string | null;
    deliverectVariantParentPlu?: string | null;
    selectionCount: number;
    groups: ModifierGroupValidationDebugRow[];
    extra?: Record<string, unknown>;
  }
): void {
  console.warn(`[modifier-validation-debug] ${context}`, payload);
}
