/**
 * Open Order modifier group contract — single source of truth for UI, cart, variant resolution,
 * and Deliverect outbound serialization. Classify from published link bounds + Deliverect flags
 * + product variant-family context (variant child MenuItem count).
 */
import { modifierMaxSelectionsIsUnbounded } from "@/domain/modifier-selection-unbounded";

export const OPEN_ORDER_MODIFIER_GROUP_KINDS = [
  "REQUIRED_VARIANT_GROUP",
  "OPTIONAL_VARIANT_OR_MODIFIER_GROUP",
  "REQUIRED_MODIFIER_GROUP",
  "LIMITED_OPTIONAL_MODIFIER_GROUP",
  "FREE_CHOICE_MODIFIER_GROUP",
] as const;

export type OpenOrderModifierGroupKind = (typeof OPEN_ORDER_MODIFIER_GROUP_KINDS)[number];

export type ModifierGroupClassificationInput = {
  deliverectIsVariantGroup: boolean;
  minSelections: number;
  maxSelections: number;
  required: boolean;
  isAvailable: boolean;
  /** Leaf MenuItem rows with `deliverectVariantParentPlu` = this product's PLU. */
  variantChildMenuItemCount: number;
  isNested?: boolean;
};

export type ModifierGroupClassificationResult = {
  kind: OpenOrderModifierGroupKind;
  minSelections: number;
  maxSelections: number;
  required: boolean;
  isAvailable: boolean;
  deliverectIsVariantGroup: boolean;
  variantChildMenuItemCount: number;
  blocksAddToCartWhenEmpty: boolean;
  requiresDeliverectVariantLeafResolution: boolean;
  usesDeliverectSubItemsChain: boolean;
  uiShowsAsRequired: boolean;
};

function effectiveRequired(input: ModifierGroupClassificationInput): boolean {
  return input.required || input.minSelections > 0;
}

/**
 * Classify a modifier group for a specific menu item (parent shell) attachment.
 */
export function classifyOpenOrderModifierGroup(
  input: ModifierGroupClassificationInput
): ModifierGroupClassificationResult {
  const min = Math.max(0, input.minSelections);
  const max = input.maxSelections;
  const required = effectiveRequired(input);
  const isVariant = input.deliverectIsVariantGroup;
  const hasVariantChildren = input.variantChildMenuItemCount > 0;
  const maxUnbounded = modifierMaxSelectionsIsUnbounded(max);

  let kind: OpenOrderModifierGroupKind;

  if (isVariant && hasVariantChildren && required) {
    kind = "REQUIRED_VARIANT_GROUP";
  } else if (isVariant && hasVariantChildren && min > 0) {
    kind = "REQUIRED_VARIANT_GROUP";
  } else if (isVariant && !required && !hasVariantChildren) {
    kind = "OPTIONAL_VARIANT_OR_MODIFIER_GROUP";
  } else if (isVariant && !required) {
    kind = "OPTIONAL_VARIANT_OR_MODIFIER_GROUP";
  } else if (isVariant && !hasVariantChildren && required) {
    kind = "REQUIRED_MODIFIER_GROUP";
  } else if (!isVariant && required) {
    kind = "REQUIRED_MODIFIER_GROUP";
  } else if (min === 0 && !maxUnbounded && max > 0) {
    kind = "LIMITED_OPTIONAL_MODIFIER_GROUP";
  } else {
    kind = "FREE_CHOICE_MODIFIER_GROUP";
  }

  const blocksAddToCartWhenEmpty =
    input.isAvailable &&
    (kind === "REQUIRED_VARIANT_GROUP" || kind === "REQUIRED_MODIFIER_GROUP");

  const requiresDeliverectVariantLeafResolution = kind === "REQUIRED_VARIANT_GROUP";

  const usesDeliverectSubItemsChain =
    !input.isNested && isVariant && kind === "REQUIRED_VARIANT_GROUP";

  const uiShowsAsRequired =
    input.isAvailable &&
    (kind === "REQUIRED_VARIANT_GROUP" || kind === "REQUIRED_MODIFIER_GROUP");

  return {
    kind,
    minSelections: min,
    maxSelections: max,
    required,
    isAvailable: input.isAvailable,
    deliverectIsVariantGroup: isVariant,
    variantChildMenuItemCount: input.variantChildMenuItemCount,
    blocksAddToCartWhenEmpty,
    requiresDeliverectVariantLeafResolution,
    usesDeliverectSubItemsChain,
    uiShowsAsRequired,
  };
}

export function classificationInputFromMenuItemLink(
  link: {
    required: boolean;
    minSelections: number;
    maxSelections: number;
    modifierGroup: {
      deliverectIsVariantGroup?: boolean | null;
      isAvailable: boolean;
      parentModifierOptionId?: string | null;
    };
  },
  variantChildMenuItemCount: number
): ModifierGroupClassificationInput {
  return {
    deliverectIsVariantGroup: link.modifierGroup.deliverectIsVariantGroup === true,
    minSelections: link.minSelections,
    maxSelections: link.maxSelections,
    required: link.required,
    isAvailable: link.modifierGroup.isAvailable,
    variantChildMenuItemCount,
    isNested: link.modifierGroup.parentModifierOptionId != null,
  };
}

export function classificationInputFromCanonicalGroup(
  group: {
    isVariantGroup?: boolean;
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
  },
  variantChildMenuItemCount: number,
  opts?: { isNested?: boolean; isAvailable?: boolean }
): ModifierGroupClassificationInput {
  return {
    deliverectIsVariantGroup: group.isVariantGroup === true,
    minSelections: group.minSelections,
    maxSelections: group.maxSelections,
    required: group.isRequired,
    isAvailable: opts?.isAvailable ?? true,
    variantChildMenuItemCount,
    isNested: opts?.isNested,
  };
}

export function groupSatisfiesCartRules(
  classification: ModifierGroupClassificationResult,
  selectedCount: number
): { ok: boolean; code?: string } {
  if (!classification.isAvailable && classification.required) {
    return { ok: false, code: "MODIFIER_GROUP_UNAVAILABLE" };
  }
  if (!classification.isAvailable) {
    return { ok: true };
  }
  if (selectedCount < classification.minSelections) {
    return { ok: false, code: "MODIFIER_MIN_SELECTIONS" };
  }
  if (selectedCount > classification.maxSelections) {
    return { ok: false, code: "MODIFIER_MAX_SELECTIONS" };
  }
  return { ok: true };
}
