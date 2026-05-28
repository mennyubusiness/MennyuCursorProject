/**
 * Client-side cart grouping/subtotal (mirrors server toCartWithGroups shape).
 */
import type { Cart, CartGroup, CartItem } from "@/domain/types";

export function rebuildCartFromItems(cart: Cart, items: CartItem[]): Cart {
  const byVendor = new Map<string, { vendorName: string; items: CartItem[]; subtotalCents: number }>();
  let subtotalCents = 0;

  for (const item of items) {
    const lineTotal = item.priceCents * item.quantity;
    subtotalCents += lineTotal;
    const vendorName =
      cart.groups.find((g) => g.vendorId === item.vendorId)?.vendorName ??
      cart.items.find((i) => i.vendorId === item.vendorId)?.menuItem?.name ??
      "Vendor";

    const existing = byVendor.get(item.vendorId);
    if (existing) {
      existing.items.push(item);
      existing.subtotalCents += lineTotal;
    } else {
      const fromGroup = cart.groups.find((g) => g.vendorId === item.vendorId);
      byVendor.set(item.vendorId, {
        vendorName: fromGroup?.vendorName ?? vendorName,
        items: [item],
        subtotalCents: lineTotal,
      });
    }
  }

  const groups: CartGroup[] = Array.from(byVendor.entries()).map(([vendorId, v]) => ({
    vendorId,
    vendorName: v.vendorName,
    items: v.items,
    subtotalCents: v.subtotalCents,
  }));

  return {
    ...cart,
    items,
    groups,
    subtotalCents,
  };
}

export function cartItemCount(cart: Pick<Cart, "items">): number {
  return cart.items.reduce((n, i) => n + i.quantity, 0);
}
