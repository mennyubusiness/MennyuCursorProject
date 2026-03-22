/**
 * Order modifier groups so parents (and their options) are created before nested groups
 * that reference `parentDeliverectOptionId`.
 */
import type { MennyuCanonicalModifierGroup } from "@/domain/menu-import/canonical.schema";

export function orderModifierGroupsForPublish(groups: MennyuCanonicalModifierGroup[]): MennyuCanonicalModifierGroup[] {
  const byId = new Map(groups.map((g) => [g.deliverectId, g]));
  const result: MennyuCanonicalModifierGroup[] = [];
  const placedGroupIds = new Set<string>();
  const placedOptionIds = new Set<string>();
  const remaining = new Set(groups.map((g) => g.deliverectId));

  const place = (g: MennyuCanonicalModifierGroup): boolean => {
    if (placedGroupIds.has(g.deliverectId)) return true;
    if (g.parentDeliverectOptionId != null && !placedOptionIds.has(g.parentDeliverectOptionId)) {
      return false;
    }
    result.push(g);
    placedGroupIds.add(g.deliverectId);
    for (const o of g.options) {
      placedOptionIds.add(o.deliverectId);
    }
    remaining.delete(g.deliverectId);
    return true;
  };

  let guard = 0;
  const maxPasses = groups.length + 5;
  while (remaining.size > 0 && guard++ < maxPasses) {
    let progressed = false;
    for (const id of [...remaining]) {
      const g = byId.get(id);
      if (g && place(g)) progressed = true;
    }
    if (!progressed) break;
  }

  if (remaining.size > 0) {
    throw new Error(
      `[menu publish] Modifier group dependency error — cycle or missing parent option. Remaining: ${[...remaining].join(", ")}`
    );
  }

  return result;
}
