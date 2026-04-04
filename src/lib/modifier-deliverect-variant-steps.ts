/**
 * Shared totals for modifier UI (selection counts per group / nested group).
 */
import type { ModifierGroupLinkForUI, ModifierOptionForUI } from "./modifier-config";

export function totalSelectedInGroup(
  link: ModifierGroupLinkForUI,
  state: Record<string, number>
): number {
  let n = 0;
  for (const opt of link.modifierGroup.options) {
    n += state[opt.id] ?? 0;
  }
  return n;
}

export function totalSelectedInNested(
  options: ModifierOptionForUI[],
  state: Record<string, number>
): number {
  let n = 0;
  for (const opt of options) {
    n += state[opt.id] ?? 0;
  }
  return n;
}
