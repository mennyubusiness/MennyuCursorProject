/**
 * Bridge: classify menu-item modifier links with variant-family context and expose UI/cart helpers.
 */
import {
  classifyOpenOrderModifierGroup,
  classificationInputFromMenuItemLink,
  type ModifierGroupClassificationResult,
  type OpenOrderModifierGroupKind,
} from "@/domain/modifier-group-kind";
import { formatModifierGroupShortNote } from "@/lib/modifier-group-display";

export type { OpenOrderModifierGroupKind, ModifierGroupClassificationResult };

export function classifyMenuItemModifierLink(
  link: Parameters<typeof classificationInputFromMenuItemLink>[0],
  variantChildMenuItemCount: number
): ModifierGroupClassificationResult {
  return classifyOpenOrderModifierGroup(
    classificationInputFromMenuItemLink(link, variantChildMenuItemCount)
  );
}

export function classifyNestedModifierGroup(
  nested: {
    minSelections: number;
    maxSelections: number;
    isRequired: boolean;
    isAvailable: boolean;
    deliverectIsVariantGroup?: boolean | null;
  },
  variantChildMenuItemCount = 0
): ModifierGroupClassificationResult {
  return classifyOpenOrderModifierGroup({
    deliverectIsVariantGroup: nested.deliverectIsVariantGroup === true,
    minSelections: nested.minSelections,
    maxSelections: nested.maxSelections,
    required: nested.isRequired,
    isAvailable: nested.isAvailable,
    variantChildMenuItemCount,
    isNested: true,
  });
}

export function formatModifierGroupNoteFromClassification(
  classification: ModifierGroupClassificationResult
): string {
  if (
    classification.kind === "OPTIONAL_VARIANT_OR_MODIFIER_GROUP" ||
    classification.kind === "FREE_CHOICE_MODIFIER_GROUP"
  ) {
    return "choose any";
  }
  if (classification.kind === "LIMITED_OPTIONAL_MODIFIER_GROUP") {
    return `choose up to ${classification.maxSelections}`;
  }
  return formatModifierGroupShortNote({
    minSelections: classification.minSelections,
    maxSelections: classification.maxSelections,
  });
}
