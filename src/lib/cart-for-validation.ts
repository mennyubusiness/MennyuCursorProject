import type { CartForValidation } from "@/services/order.service";

/**
 * POS open/closed is not wired for customer cart/checkout validation yet: Vendor has no
 * persisted posOpen field, and Deliverect busy-mode uses mennyuOrdersPaused instead.
 * VENDOR_CLOSED in order.service applies only when vendor.posOpen === false is supplied.
 * Do not show customer copy implying POS-hours blocking until that field is sourced.
 */
const POS_OPEN_FOR_VALIDATION: boolean | undefined = undefined;

/** Display-cart row shape used by /cart SSR and revalidation (CART_DISPLAY_SESSION_CART_INCLUDE). */
export type DisplayCartRowForValidation = {
  podId: string;
  items: Array<{
    id: string;
    menuItemId: string;
    vendorId: string;
    quantity: number;
    priceCents: number;
    menuItem: {
      priceCents: number;
      isAvailable: boolean;
      name: string;
      basketMaxQuantity?: number | null;
      deliverectProductId?: string | null;
      deliverectPlu?: string | null;
      deliverectVariantParentPlu?: string | null;
    };
    vendor: {
      isActive?: boolean;
      mennyuOrdersPaused?: boolean | null;
      posOpen?: boolean;
      deliverectChannelLinkId?: string | null;
    };
    selections?: Array<{
      modifierOptionId: string;
      quantity: number;
      modifierOption?: { priceCents: number };
    }>;
  }>;
};

export function buildCartForValidationFromDisplayCart(
  cart: DisplayCartRowForValidation
): CartForValidation {
  return {
    podId: cart.podId,
    items: cart.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      vendorId: i.vendorId,
      quantity: i.quantity,
      priceCents: i.priceCents,
      menuItem: {
        priceCents: i.menuItem.priceCents,
        isAvailable: i.menuItem.isAvailable,
        name: i.menuItem.name,
        basketMaxQuantity: i.menuItem.basketMaxQuantity ?? null,
        deliverectProductId: i.menuItem.deliverectProductId ?? null,
        deliverectPlu: i.menuItem.deliverectPlu ?? null,
        deliverectVariantParentPlu: i.menuItem.deliverectVariantParentPlu ?? null,
      },
      vendor: {
        isActive: i.vendor.isActive,
        mennyuOrdersPaused: i.vendor.mennyuOrdersPaused ?? undefined,
        posOpen: POS_OPEN_FOR_VALIDATION,
        deliverectChannelLinkId: i.vendor.deliverectChannelLinkId ?? null,
      },
      selections: i.selections?.map((s) => ({
        modifierOptionId: s.modifierOptionId,
        quantity: s.quantity,
        modifierOption: s.modifierOption ? { priceCents: s.modifierOption.priceCents } : undefined,
      })),
    })),
  };
}
