/**
 * Counts Deliverect "variant group" selections for subItems nesting limits.
 * Must match {@link assertDeliverectVariantGroupNestingAllowed} in cart.service and ModifierModal UX.
 *
 * One step per distinct option with quantity ≥ 1 in a group (or nested group) marked
 * `deliverectIsVariantGroup`, across the whole modifier config for the line.
 */
import { modifierMaxSelectionsIsUnbounded } from "@/domain/modifier-selection-unbounded";
import type {
  ModifierConfigForUI,
  ModifierGroupLinkForUI,
  ModifierOptionForUI,
  NestedModifierGroupForUI,
} from "./modifier-config";

export function countDeliverectVariantGroupSelectionsInState(
  state: Record<string, number>,
  cfg: ModifierConfigForUI
): number {
  let n = 0;
  for (const link of cfg.groups) {
    if (!link.modifierGroup.deliverectIsVariantGroup) continue;
    for (const opt of link.modifierGroup.options) {
      if ((state[opt.id] ?? 0) >= 1) n += 1;
    }
  }
  for (const link of cfg.groups) {
    for (const opt of link.modifierGroup.options) {
      if ((state[opt.id] ?? 0) < 1) continue;
      for (const nested of opt.nestedModifierGroups ?? []) {
        if (!nested.deliverectIsVariantGroup) continue;
        for (const nopt of nested.options) {
          if ((state[nopt.id] ?? 0) >= 1) n += 1;
        }
      }
    }
  }
  return n;
}

/**
 * When increasing an option from 0 → positive in a variant group, check global cap.
 * Increasing quantity on an already-selected option does not add variant steps.
 */
export function wouldExceedDeliverectVariantCapOnFirstSelect(
  state: Record<string, number>,
  cfg: ModifierConfigForUI,
  optionId: string,
  currentQty: number,
  isVariantGroup: boolean,
  maxSteps: number | null
): boolean {
  if (maxSteps == null || !isVariantGroup) return false;
  if (currentQty >= 1) return false;
  const next = { ...state, [optionId]: 1 };
  return countDeliverectVariantGroupSelectionsInState(next, cfg) > maxSteps;
}

/** Minimum variant-group selections required by rules (for impossible-menu detection). */
export function minimumDeliverectVariantStepsRequiredByRules(cfg: ModifierConfigForUI): number {
  let sum = 0;
  for (const link of cfg.groups) {
    if (!link.modifierGroup.deliverectIsVariantGroup) continue;
    if (!link.modifierGroup.isAvailable) continue;
    sum += Math.max(0, link.minSelections);
  }
  for (const link of cfg.groups) {
    for (const opt of link.modifierGroup.options) {
      if ((opt.nestedModifierGroups?.length ?? 0) === 0) continue;
      for (const nested of opt.nestedModifierGroups ?? []) {
        if (!nested.deliverectIsVariantGroup || !nested.isAvailable) continue;
        sum += Math.max(0, nested.minSelections);
      }
    }
  }
  return sum;
}

export function totalSelectedInGroup(link: ModifierGroupLinkForUI, state: Record<string, number>): number {
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

export function groupAllowsMoreSelections(link: ModifierGroupLinkForUI, totalInGroup: number): boolean {
  if (modifierMaxSelectionsIsUnbounded(link.maxSelections)) return true;
  return totalInGroup < link.maxSelections;
}

export function nestedAllowsMoreSelections(nested: { maxSelections: number }, nTotal: number): boolean {
  if (modifierMaxSelectionsIsUnbounded(nested.maxSelections)) return true;
  return nTotal < nested.maxSelections;
}

export function canIncreaseTopLevelModifierOption(args: {
  link: ModifierGroupLinkForUI;
  option: ModifierOptionForUI;
  state: Record<string, number>;
  cfg: ModifierConfigForUI;
  maxDeliverectVariantSteps: number | null;
  deliverectOnlineOrderApplies: boolean;
}): boolean {
  const { link, option, state, cfg, maxDeliverectVariantSteps, deliverectOnlineOrderApplies } = args;
  if (!option.isAvailable) return false;
  const total = totalSelectedInGroup(link, state);
  if (!groupAllowsMoreSelections(link, total)) return false;
  if (!deliverectOnlineOrderApplies || maxDeliverectVariantSteps == null || !link.modifierGroup.deliverectIsVariantGroup) {
    return true;
  }
  const cur = state[option.id] ?? 0;
  return !wouldExceedDeliverectVariantCapOnFirstSelect(
    state,
    cfg,
    option.id,
    cur,
    true,
    maxDeliverectVariantSteps
  );
}

export function canIncreaseNestedModifierOption(args: {
  nested: NestedModifierGroupForUI;
  option: Omit<ModifierOptionForUI, "nestedModifierGroups">;
  state: Record<string, number>;
  cfg: ModifierConfigForUI;
  nTotal: number;
  maxDeliverectVariantSteps: number | null;
  deliverectOnlineOrderApplies: boolean;
}): boolean {
  const { nested, option, state, cfg, nTotal, maxDeliverectVariantSteps, deliverectOnlineOrderApplies } = args;
  if (!option.isAvailable) return false;
  if (!nestedAllowsMoreSelections(nested, nTotal)) return false;
  if (!deliverectOnlineOrderApplies || maxDeliverectVariantSteps == null || !nested.deliverectIsVariantGroup) {
    return true;
  }
  const cur = state[option.id] ?? 0;
  return !wouldExceedDeliverectVariantCapOnFirstSelect(
    state,
    cfg,
    option.id,
    cur,
    true,
    maxDeliverectVariantSteps
  );
}
