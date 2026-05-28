/**
 * Optimistic cart updates for simple add-to-cart (no modifier selections).
 */
import type { Cart, CartItem, CartItemSelection } from "@/domain/types";
import { rebuildCartFromItems } from "@/lib/cart-totals";
import { normalizedConfigurationKey } from "@/lib/cart-line-identity";

export type OptimisticSimpleAddParams = {
  menuItemId: string;
  vendorId: string;
  vendorName: string;
  menuItemName: string;
  unitPriceCents: number;
  shellDeliverectPlu?: string | null;
  quantity?: number;
};

function lineMatchesSimpleAdd(
  line: CartItem,
  params: OptimisticSimpleAddParams
): boolean {
  if (line.menuItemId !== params.menuItemId) return false;
  if ((line.selections?.length ?? 0) > 0) return false;
  const shellPlu = params.shellDeliverectPlu?.trim();
  if (shellPlu && line.menuItem?.deliverectVariantParentPlu === shellPlu) return true;
  if (!shellPlu) return true;
  return line.menuItem?.deliverectVariantParentPlu === shellPlu;
}

/**
 * Bump qty on an existing simple line or append a temporary line. Returns null if unsafe to guess.
 */
export function optimisticSimpleAdd(
  cart: Cart,
  params: OptimisticSimpleAddParams
): Cart | null {
  const qty = params.quantity ?? 1;
  const matching = cart.items.filter((line) => lineMatchesSimpleAdd(line, params));

  if (matching.length > 1) {
    return null;
  }

  if (matching.length === 1) {
    const line = matching[0]!;
    const items = cart.items.map((i) =>
      i.id === line.id ? { ...i, quantity: i.quantity + qty } : i
    );
    return rebuildCartFromItems(cart, items);
  }

  const incomingKey = normalizedConfigurationKey(null, null);
  const dupConfig = cart.items.some((line) => {
    if (line.menuItemId !== params.menuItemId) return false;
    const key = normalizedConfigurationKey(
      line.specialInstructions,
      line.selections?.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity })) ?? null
    );
    return key === incomingKey;
  });
  if (dupConfig && matching.length === 0) {
    return null;
  }

  const tempLine: CartItem = {
    id: `optimistic:${params.menuItemId}:${Date.now()}`,
    menuItemId: params.menuItemId,
    vendorId: params.vendorId,
    quantity: qty,
    priceCents: params.unitPriceCents,
    specialInstructions: null,
    menuItem: {
      name: params.menuItemName,
      deliverectVariantParentPlu: params.shellDeliverectPlu?.trim() || undefined,
    },
  };

  return rebuildCartFromItems(cart, [...cart.items, tempLine]);
}

/** Pending modifier add — temporary line until server returns authoritative cart. */
export function optimisticPendingModifierLine(
  cart: Cart,
  params: OptimisticSimpleAddParams & { selections?: CartItemSelection[] }
): Cart {
  const tempLine: CartItem = {
    id: `optimistic:mod:${params.menuItemId}:${Date.now()}`,
    menuItemId: params.menuItemId,
    vendorId: params.vendorId,
    quantity: params.quantity ?? 1,
    priceCents: params.unitPriceCents,
    specialInstructions: null,
    menuItem: {
      name: params.menuItemName,
      deliverectVariantParentPlu: params.shellDeliverectPlu?.trim() || undefined,
    },
    selections: params.selections,
  };
  return rebuildCartFromItems(cart, [...cart.items, tempLine]);
}
