/**
 * Deliverect (and similar) payloads often use min=0, max=0 for optional multi-select
 * groups meaning "no minimum, no fixed maximum". Mennyu stores a finite Int in DB;
 * this sentinel represents unbounded max for validation/UI.
 *
 * Use exact equality checks so real caps (e.g. max=12) are never misclassified.
 */
export const MODIFIER_MAX_SELECTIONS_UNBOUNDED = 2_147_483_647;

export function modifierMaxSelectionsIsUnbounded(maxSelections: number): boolean {
  return maxSelections === MODIFIER_MAX_SELECTIONS_UNBOUNDED;
}

/** For admin/debug displays — avoid rendering the sentinel as a huge integer. */
export function formatModifierMaxSelectionsLabel(maxSelections: number): string {
  return modifierMaxSelectionsIsUnbounded(maxSelections) ? "unlimited" : String(maxSelections);
}
