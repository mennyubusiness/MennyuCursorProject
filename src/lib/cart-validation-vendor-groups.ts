import type { Cart } from "@/domain/types";
import type { CartItemValidationError } from "@/services/order.service";
import { buildErrorByCartItemId } from "@/lib/cart-page-validation";

export type CartValidationVendorGroup = {
  vendorId: string;
  vendorName: string;
  issues: Array<{
    cartItemId: string;
    itemName: string;
    message: string;
  }>;
};

/** Group line-level validation errors by vendor for cart page display. */
export function buildCartValidationVendorGroups(
  cart: Cart,
  errors: CartItemValidationError[]
): CartValidationVendorGroup[] {
  const errorByCartItemId = buildErrorByCartItemId(
    errors,
    cart.items.map((i) => ({ id: i.id, menuItemId: i.menuItemId }))
  );
  const byVendor = new Map<string, CartValidationVendorGroup>();

  for (const item of cart.items) {
    const message = errorByCartItemId.get(item.id);
    if (!message) continue;
    const vendorName =
      cart.groups.find((g) => g.vendorId === item.vendorId)?.vendorName ?? "Vendor";
    const existing = byVendor.get(item.vendorId);
    const issue = {
      cartItemId: item.id,
      itemName: item.menuItem?.name ?? "Item",
      message,
    };
    if (existing) {
      existing.issues.push(issue);
    } else {
      byVendor.set(item.vendorId, { vendorId: item.vendorId, vendorName, issues: [issue] });
    }
  }

  return [...byVendor.values()].sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}
