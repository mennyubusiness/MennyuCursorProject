/**
 * Merge a confirmed/server cart with newer local optimistic state.
 * Keeps pending optimistic lines and higher local quantities so the UI never regresses.
 */
import type { Cart, CartItem } from "@/domain/types";
import { rebuildCartFromItems } from "@/lib/cart-totals";
import { normalizedConfigurationKey } from "@/lib/cart-line-identity";

function lineConfigKey(line: CartItem): string {
  return `${line.menuItemId}|${normalizedConfigurationKey(
    line.specialInstructions,
    line.selections?.map((s) => ({
      modifierOptionId: s.modifierOptionId,
      quantity: s.quantity,
    })) ?? null
  )}`;
}

function isOptimisticLineId(id: string): boolean {
  return id.startsWith("optimistic:");
}

/**
 * Build the cart customers should see: server/confirmed baseline + unresolved local additions.
 * - Preserves optimistic:* lines not yet present on the server
 * - Prefers the higher quantity when the same line identity exists in both
 */
export function mergeServerCartWithLocalPending(server: Cart, local: Cart): Cart {
  if (server.id !== local.id) {
    // Different carts — prefer local (active UI) when identities diverge mid-session.
    return local;
  }

  const serverById = new Map(server.items.map((item) => [item.id, item]));
  const serverByConfig = new Map(server.items.map((item) => [lineConfigKey(item), item]));
  const mergedById = new Map<string, CartItem>();

  for (const item of server.items) {
    mergedById.set(item.id, item);
  }

  for (const localItem of local.items) {
    if (isOptimisticLineId(localItem.id)) {
      const configKey = lineConfigKey(localItem);
      const serverMatch = serverByConfig.get(configKey);
      if (!serverMatch) {
        mergedById.set(localItem.id, localItem);
        continue;
      }
      if (localItem.quantity > serverMatch.quantity) {
        mergedById.set(serverMatch.id, { ...serverMatch, quantity: localItem.quantity });
      }
      continue;
    }

    const serverItem = serverById.get(localItem.id);
    if (!serverItem) {
      // Local-only real id (unusual) — keep so we don't drop an in-flight edit.
      mergedById.set(localItem.id, localItem);
      continue;
    }
    if (localItem.quantity > serverItem.quantity) {
      mergedById.set(serverItem.id, { ...serverItem, quantity: localItem.quantity });
    }
  }

  // Preserve a stable order: server order first, then any extra local-only lines.
  const ordered: CartItem[] = [];
  const seen = new Set<string>();
  for (const item of server.items) {
    const merged = mergedById.get(item.id);
    if (merged) {
      ordered.push(merged);
      seen.add(merged.id);
    }
  }
  for (const item of local.items) {
    const merged = mergedById.get(item.id);
    if (merged && !seen.has(merged.id)) {
      ordered.push(merged);
      seen.add(merged.id);
    }
  }

  return rebuildCartFromItems(server, ordered);
}
