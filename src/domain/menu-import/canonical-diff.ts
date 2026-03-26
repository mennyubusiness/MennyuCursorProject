/**
 * Pure draft vs published comparison for Mennyu canonical menus (Deliverect IDs as identity).
 * Used for admin review only — does not touch live menu tables.
 */
import type {
  MennyuCanonicalMenu,
  MennyuCanonicalModifierGroup,
  MennyuCanonicalModifierOption,
  MennyuCanonicalProduct,
} from "@/domain/menu-import/canonical.schema";

function stableJson(v: unknown): string {
  return JSON.stringify(v);
}

function describeProductChanges(
  d: MennyuCanonicalProduct,
  p: MennyuCanonicalProduct
): { priceChanged: boolean; otherLabels: string[] } {
  const otherLabels: string[] = [];
  if (d.name !== p.name) otherLabels.push(`name (${p.name} → ${d.name})`);
  const descD = d.description ?? null;
  const descP = p.description ?? null;
  if (descD !== descP) otherLabels.push("description");
  if (d.isAvailable !== p.isAvailable) otherLabels.push("availability");
  if (d.sortOrder !== p.sortOrder) otherLabels.push("sort order");
  const imgD = d.imageUrl ?? null;
  const imgP = p.imageUrl ?? null;
  if (imgD !== imgP) otherLabels.push("image URL");
  const basketD = d.basketMaxQuantity ?? null;
  const basketP = p.basketMaxQuantity ?? null;
  if (basketD !== basketP) otherLabels.push("basket max");
  const pluD = d.plu ?? null;
  const pluP = p.plu ?? null;
  if (pluD !== pluP) otherLabels.push("Deliverect PLU (snooze key)");
  if (stableJson(d.modifierGroupDeliverectIds) !== stableJson(p.modifierGroupDeliverectIds)) {
    otherLabels.push("modifier group links");
  }
  return { priceChanged: d.priceCents !== p.priceCents, otherLabels };
}

function describeGroupMetaChanges(
  d: MennyuCanonicalModifierGroup,
  p: MennyuCanonicalModifierGroup
): string[] {
  const out: string[] = [];
  if (d.name !== p.name) out.push(`name (${p.name} → ${d.name})`);
  if (d.minSelections !== p.minSelections || d.maxSelections !== p.maxSelections) {
    out.push(`selections min/max (${p.minSelections}/${p.maxSelections} → ${d.minSelections}/${d.maxSelections})`);
  }
  if (d.isRequired !== p.isRequired) out.push("required flag");
  if (d.sortOrder !== p.sortOrder) out.push("sort order");
  const parentD = d.parentDeliverectOptionId ?? null;
  const parentP = p.parentDeliverectOptionId ?? null;
  if (parentD !== parentP) out.push("parent option");
  return out;
}

function describeOptionChanges(d: MennyuCanonicalModifierOption, p: MennyuCanonicalModifierOption): string[] {
  const out: string[] = [];
  if (d.name !== p.name) out.push(`name (${p.name} → ${d.name})`);
  if (d.priceCents !== p.priceCents) out.push(`price (${p.priceCents}¢ → ${d.priceCents}¢)`);
  if (d.isDefault !== p.isDefault) out.push("default");
  if (d.isAvailable !== p.isAvailable) out.push("availability");
  if (d.sortOrder !== p.sortOrder) out.push("sort order");
  if (stableJson(d.nestedGroupDeliverectIds) !== stableJson(p.nestedGroupDeliverectIds)) {
    out.push("nested modifier groups");
  }
  return out;
}

function diffOptionsInGroup(
  groupId: string,
  groupName: string,
  dOpts: MennyuCanonicalModifierOption[],
  pOpts: MennyuCanonicalModifierOption[]
): {
  added: CanonicalMenuDiff["modifierChanges"]["addedOptions"];
  removed: CanonicalMenuDiff["modifierChanges"]["removedOptions"];
  changed: CanonicalMenuDiff["modifierChanges"]["changedOptions"];
} {
  const dm = new Map(dOpts.map((o) => [o.deliverectId, o]));
  const pm = new Map(pOpts.map((o) => [o.deliverectId, o]));

  const added: CanonicalMenuDiff["modifierChanges"]["addedOptions"] = [];
  const removed: CanonicalMenuDiff["modifierChanges"]["removedOptions"] = [];
  const changed: CanonicalMenuDiff["modifierChanges"]["changedOptions"] = [];

  for (const [id, o] of dm) {
    if (!pm.has(id)) {
      added.push({ groupId, groupName, optionId: id, optionName: o.name });
    }
  }
  for (const [id, o] of pm) {
    if (!dm.has(id)) {
      removed.push({ groupId, groupName, optionId: id, optionName: o.name });
    }
  }
  for (const [id, d] of dm) {
    const p = pm.get(id);
    if (!p) continue;
    const labels = describeOptionChanges(d, p);
    if (labels.length > 0) {
      changed.push({
        groupId,
        groupName,
        optionId: id,
        optionName: d.name,
        details: labels.join("; "),
      });
    }
  }
  return { added, removed, changed };
}

export type CanonicalMenuDiff = {
  isFirstPublish: boolean;
  /** Latest published MenuVersion id used as baseline, if any */
  publishedVersionId: string | null;
  summary: {
    addedCategories: number;
    removedCategories: number;
    changedCategories: number;
    addedProducts: number;
    removedProducts: number;
    changedPrices: number;
    changedProductsOther: number;
    addedModifierGroups: number;
    removedModifierGroups: number;
    changedModifierGroups: number;
    addedModifierOptions: number;
    removedModifierOptions: number;
    changedModifierOptions: number;
  };
  addedCategories: Array<{ deliverectId: string; name: string }>;
  removedCategories: Array<{ deliverectId: string; name: string }>;
  changedCategories: Array<{ deliverectId: string; name: string; details: string }>;
  addedProducts: Array<{ deliverectId: string; name: string; priceCents: number }>;
  removedProducts: Array<{ deliverectId: string; name: string; priceCents: number }>;
  changedPrices: Array<{ deliverectId: string; name: string; oldCents: number; newCents: number }>;
  changedProductsOther: Array<{ deliverectId: string; name: string; details: string }>;
  modifierChanges: {
    addedGroups: Array<{ deliverectId: string; name: string }>;
    removedGroups: Array<{ deliverectId: string; name: string }>;
    changedGroups: Array<{ deliverectId: string; name: string; details: string }>;
    addedOptions: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
    }>;
    removedOptions: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
    }>;
    changedOptions: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      details: string;
    }>;
  };
};

/**
 * Compare draft menu to published baseline. If `published` is null, all draft entities are treated as new (first publish).
 */
export function diffCanonicalMenus(
  draft: MennyuCanonicalMenu,
  published: MennyuCanonicalMenu | null,
  publishedVersionId: string | null
): CanonicalMenuDiff {
  const emptyModifier = {
    addedGroups: [] as CanonicalMenuDiff["modifierChanges"]["addedGroups"],
    removedGroups: [] as CanonicalMenuDiff["modifierChanges"]["removedGroups"],
    changedGroups: [] as CanonicalMenuDiff["modifierChanges"]["changedGroups"],
    addedOptions: [] as CanonicalMenuDiff["modifierChanges"]["addedOptions"],
    removedOptions: [] as CanonicalMenuDiff["modifierChanges"]["removedOptions"],
    changedOptions: [] as CanonicalMenuDiff["modifierChanges"]["changedOptions"],
  };

  if (!published) {
    const addedCategories = draft.categories.map((c) => ({ deliverectId: c.deliverectId, name: c.name }));
    const addedProducts = draft.products.map((p) => ({
      deliverectId: p.deliverectId,
      name: p.name,
      priceCents: p.priceCents,
    }));
    const addedGroups = draft.modifierGroupDefinitions.map((g) => ({
      deliverectId: g.deliverectId,
      name: g.name,
    }));
    let addedOpts = 0;
    for (const g of draft.modifierGroupDefinitions) addedOpts += g.options.length;

    return {
      isFirstPublish: true,
      publishedVersionId: null,
      summary: {
        addedCategories: addedCategories.length,
        removedCategories: 0,
        changedCategories: 0,
        addedProducts: addedProducts.length,
        removedProducts: 0,
        changedPrices: 0,
        changedProductsOther: 0,
        addedModifierGroups: addedGroups.length,
        removedModifierGroups: 0,
        changedModifierGroups: 0,
        addedModifierOptions: addedOpts,
        removedModifierOptions: 0,
        changedModifierOptions: 0,
      },
      addedCategories,
      removedCategories: [],
      changedCategories: [],
      addedProducts,
      removedProducts: [],
      changedPrices: [],
      changedProductsOther: [],
      modifierChanges: {
        ...emptyModifier,
        addedGroups,
        addedOptions: (() => {
          const out: CanonicalMenuDiff["modifierChanges"]["addedOptions"] = [];
          for (const g of draft.modifierGroupDefinitions) {
            for (const o of g.options) {
              out.push({
                groupId: g.deliverectId,
                groupName: g.name,
                optionId: o.deliverectId,
                optionName: o.name,
              });
            }
          }
          return out;
        })(),
      },
    };
  }

  const catD = new Map(draft.categories.map((c) => [c.deliverectId, c]));
  const catP = new Map(published.categories.map((c) => [c.deliverectId, c]));

  const addedCategories: CanonicalMenuDiff["addedCategories"] = [];
  const removedCategories: CanonicalMenuDiff["removedCategories"] = [];
  const changedCategories: CanonicalMenuDiff["changedCategories"] = [];

  for (const [id, c] of catD) {
    if (!catP.has(id)) addedCategories.push({ deliverectId: id, name: c.name });
  }
  for (const [id, c] of catP) {
    if (!catD.has(id)) removedCategories.push({ deliverectId: id, name: c.name });
  }
  for (const [id, d] of catD) {
    const p = catP.get(id);
    if (!p) continue;
    const parts: string[] = [];
    if (d.name !== p.name) parts.push(`name (${p.name} → ${d.name})`);
    if (d.sortOrder !== p.sortOrder) parts.push(`sort order (${p.sortOrder} → ${d.sortOrder})`);
    if (stableJson(d.productDeliverectIds) !== stableJson(p.productDeliverectIds)) {
      parts.push("product membership / order in category");
    }
    if (parts.length > 0) {
      changedCategories.push({ deliverectId: id, name: d.name, details: parts.join("; ") });
    }
  }

  const prodD = new Map(draft.products.map((p) => [p.deliverectId, p]));
  const prodP = new Map(published.products.map((p) => [p.deliverectId, p]));

  const addedProducts: CanonicalMenuDiff["addedProducts"] = [];
  const removedProducts: CanonicalMenuDiff["removedProducts"] = [];
  const changedPrices: CanonicalMenuDiff["changedPrices"] = [];
  const changedProductsOther: CanonicalMenuDiff["changedProductsOther"] = [];

  for (const [id, p] of prodD) {
    if (!prodP.has(id)) {
      addedProducts.push({ deliverectId: id, name: p.name, priceCents: p.priceCents });
    }
  }
  for (const [id, p] of prodP) {
    if (!prodD.has(id)) {
      removedProducts.push({ deliverectId: id, name: p.name, priceCents: p.priceCents });
    }
  }
  for (const [id, d] of prodD) {
    const p = prodP.get(id);
    if (!p) continue;
    const { priceChanged, otherLabels } = describeProductChanges(d, p);
    if (priceChanged) {
      changedPrices.push({
        deliverectId: id,
        name: d.name,
        oldCents: p.priceCents,
        newCents: d.priceCents,
      });
    }
    if (otherLabels.length > 0) {
      changedProductsOther.push({
        deliverectId: id,
        name: d.name,
        details: otherLabels.join("; "),
      });
    }
  }

  const grpD = new Map(draft.modifierGroupDefinitions.map((g) => [g.deliverectId, g]));
  const grpP = new Map(published.modifierGroupDefinitions.map((g) => [g.deliverectId, g]));

  const modifierChanges: CanonicalMenuDiff["modifierChanges"] = {
    addedGroups: [],
    removedGroups: [],
    changedGroups: [],
    addedOptions: [],
    removedOptions: [],
    changedOptions: [],
  };

  for (const [id, g] of grpD) {
    if (!grpP.has(id)) modifierChanges.addedGroups.push({ deliverectId: id, name: g.name });
  }
  for (const [id, g] of grpP) {
    if (!grpD.has(id)) modifierChanges.removedGroups.push({ deliverectId: id, name: g.name });
  }

  for (const [id, d] of grpD) {
    const p = grpP.get(id);
    if (!p) continue;
    const meta = describeGroupMetaChanges(d, p);
    const optDiff = diffOptionsInGroup(id, d.name, d.options, p.options);
    modifierChanges.addedOptions.push(...optDiff.added);
    modifierChanges.removedOptions.push(...optDiff.removed);
    modifierChanges.changedOptions.push(...optDiff.changed);

    const optionStructural =
      optDiff.added.length > 0 || optDiff.removed.length > 0 || optDiff.changed.length > 0;
    if (meta.length > 0 || optionStructural) {
      const pieces = [...meta];
      if (optDiff.added.length) pieces.push(`+${optDiff.added.length} option(s)`);
      if (optDiff.removed.length) pieces.push(`−${optDiff.removed.length} option(s)`);
      if (optDiff.changed.length) pieces.push(`${optDiff.changed.length} option(s) field change(s)`);
      modifierChanges.changedGroups.push({
        deliverectId: id,
        name: d.name,
        details: pieces.join("; "),
      });
    }
  }

  const summary: CanonicalMenuDiff["summary"] = {
    addedCategories: addedCategories.length,
    removedCategories: removedCategories.length,
    changedCategories: changedCategories.length,
    addedProducts: addedProducts.length,
    removedProducts: removedProducts.length,
    changedPrices: changedPrices.length,
    changedProductsOther: changedProductsOther.length,
    addedModifierGroups: modifierChanges.addedGroups.length,
    removedModifierGroups: modifierChanges.removedGroups.length,
    changedModifierGroups: modifierChanges.changedGroups.length,
    addedModifierOptions: modifierChanges.addedOptions.length,
    removedModifierOptions: modifierChanges.removedOptions.length,
    changedModifierOptions: modifierChanges.changedOptions.length,
  };

  return {
    isFirstPublish: false,
    publishedVersionId,
    summary,
    addedCategories,
    removedCategories,
    changedCategories,
    addedProducts,
    removedProducts,
    changedPrices,
    changedProductsOther,
    modifierChanges,
  };
}
