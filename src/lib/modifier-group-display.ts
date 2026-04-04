/**
 * Canonical customer-facing copy for modifier groups — derived only from structured rules
 * (min/max/required/flags), never from raw POS import strings.
 *
 * @see ModifierModal for UI context; keep wording aligned with modifier-validation and cart limits.
 */
import { modifierMaxSelectionsIsUnbounded } from "@/domain/modifier-selection-unbounded";

export type ModifierGroupHintContext = {
  minSelections: number;
  maxSelections: number;
  /** Link-level required (ModifierGroupLink.required) */
  required: boolean;
  /** ModifierGroup.deliverectIsVariantGroup */
  deliverectIsVariantGroup: boolean;
  /** Vendor uses Deliverect (channel link) — online subItems limits apply */
  deliverectOnlineOrderApplies: boolean;
  /**
   * From {@link maxDeliverectVariantGroupSelectionsForMenuItem} when online limits apply; else null.
   */
  deliverectMaxVariantStepsForItem: number | null;
};

/**
 * Single formatter for group subtitles / helper lines in the modifier modal (and anywhere else).
 */
export function formatModifierGroupSelectionHint(ctx: ModifierGroupHintContext): string {
  const {
    minSelections,
    maxSelections,
    required,
    deliverectIsVariantGroup,
    deliverectOnlineOrderApplies,
    deliverectMaxVariantStepsForItem,
  } = ctx;
  const unbounded = modifierMaxSelectionsIsUnbounded(maxSelections);

  // Optional + unbounded + Deliverect variant group: global online cap applies to wording
  if (
    deliverectIsVariantGroup &&
    unbounded &&
    minSelections === 0 &&
    deliverectOnlineOrderApplies &&
    deliverectMaxVariantStepsForItem != null
  ) {
    const m = deliverectMaxVariantStepsForItem;
    return `optional — up to ${m} variation choice${m === 1 ? "" : "s"} total (online order limit)`;
  }

  if (unbounded && minSelections === 0) {
    return "optional — choose any";
  }

  if (minSelections === maxSelections) {
    const core = `choose ${minSelections}`;
    return required ? `${core}, required` : core;
  }

  if (minSelections === 0) {
    const core = `choose up to ${maxSelections} total`;
    return required ? `${core}, required` : `optional — ${core}`;
  }

  const range = `choose ${minSelections} to ${maxSelections}`;
  return required ? `${range}, required` : `optional — ${range}`;
}

/**
 * True when published rules require more variant-group selections than the online API allows.
 * Indicates a menu configuration / import issue, not user error.
 */
export function deliverectVariantMenuRulesExceedOnlineCap(
  minimumVariantStepsRequired: number,
  deliverectMaxVariantStepsForItem: number | null
): boolean {
  if (deliverectMaxVariantStepsForItem == null) return false;
  return minimumVariantStepsRequired > deliverectMaxVariantStepsForItem;
}

export function menuConfigurationConflictMessage(): string {
  return "This item’s menu setup conflicts with online ordering limits. Please try different options or contact the restaurant.";
}
