/**
 * Short, consistent helper lines for modifier groups (min/max only — no raw POS blurbs).
 */
import { modifierMaxSelectionsIsUnbounded } from "@/domain/modifier-selection-unbounded";

export function formatModifierGroupShortNote(input: {
  minSelections: number;
  maxSelections: number;
}): string {
  const { minSelections, maxSelections } = input;
  if (modifierMaxSelectionsIsUnbounded(maxSelections)) {
    if (minSelections === 0) return "choose any";
    return `choose at least ${minSelections}`;
  }
  if (minSelections === maxSelections) {
    return `choose ${minSelections}`;
  }
  if (minSelections === 0) {
    return `choose up to ${maxSelections}`;
  }
  return `choose ${minSelections}–${maxSelections}`;
}
