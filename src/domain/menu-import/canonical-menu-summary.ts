import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";

export type CanonicalMenuSummaryCounts = {
  categories: number;
  products: number;
  modifierGroups: number;
  modifierOptions: number;
};

export function getCanonicalMenuSummaryCounts(snapshot: unknown):
  | { ok: true; summary: CanonicalMenuSummaryCounts }
  | { ok: false; parseError: string } {
  const parsed = mennyuCanonicalMenuSchema.safeParse(snapshot);
  if (!parsed.success) {
    return {
      ok: false,
      parseError: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  const menu = parsed.data;
  const modifierOptions = menu.modifierGroupDefinitions.reduce((n, g) => n + g.options.length, 0);
  return {
    ok: true,
    summary: {
      categories: menu.categories.length,
      products: menu.products.length,
      modifierGroups: menu.modifierGroupDefinitions.length,
      modifierOptions,
    },
  };
}
