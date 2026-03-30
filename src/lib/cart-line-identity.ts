/**
 * Canonical identity for a cart line: same menu item + same special instructions + same modifier
 * selection pairs (option id + quantity). Used client-side for UI matching and server-side so we
 * only merge `addCartItem` into an existing row when the full configuration matches — otherwise a
 * new row is created (e.g. second modifier variant of the same menu item).
 */
import type { CartItem, CartItemSelection } from "@/domain/types";

export type SelectionPairInput = { modifierOptionId: string; quantity: number };

export function normalizeSpecialInstructions(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

/** Stable string key for comparisons (not for display). */
export function normalizedConfigurationKey(
  specialInstructions: string | null | undefined,
  selections: SelectionPairInput[] | null | undefined
): string {
  const si = normalizeSpecialInstructions(specialInstructions) ?? "";
  const pairs = [...(selections ?? [])]
    .filter((x) => x.quantity >= 1)
    .map((x) => ({ id: x.modifierOptionId, q: x.quantity }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const sel = pairs.map((p) => `${p.id}:${p.q}`).join("|");
  return `${si}\0${sel}`;
}

export function configurationKeyFromCartItem(line: CartItem): string {
  const pairs: SelectionPairInput[] = (line.selections ?? []).map((s) => ({
    modifierOptionId: s.modifierOptionId,
    quantity: s.quantity,
  }));
  return normalizedConfigurationKey(line.specialInstructions, pairs);
}

/** Short label for stacked cart lines on the menu (mobile-friendly). */
export function shortCartLineLabel(line: CartItem): string {
  const s = line.selections?.filter((x) => x.quantity >= 1) ?? [];
  if (s.length === 0) return "Standard";
  const names = s.map((x) => x.modifierOptionName).filter(Boolean);
  if (names.length === 0) return "Custom";
  const joined = names.slice(0, 4).join(", ");
  return names.length > 4 ? `${joined}…` : joined;
}
