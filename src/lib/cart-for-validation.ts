import type { CartForValidation } from "@/services/order.service";
import { resolveVendorPosOpen, resolveVendorHoursTimezone, type VendorHoursSourceFields } from "@/lib/vendor-customer-ordering-hours";

/** Display-cart row shape used by /cart SSR and revalidation (CART_DISPLAY_SESSION_CART_INCLUDE). */
export type DisplayCartRowForValidation = {
  podId: string;
  pod?: { pickupTimezone?: string | null };
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
      menuSource?: import("@prisma/client").VendorMenuSource;
      deliverectChannelLinkId?: string | null;
      syncCustomerOrderingHoursFromDeliverect?: boolean;
      customerOrderingHours?: unknown;
      deliverectSyncedCustomerOrderingHours?: unknown;
    };
    selections?: Array<{
      modifierOptionId: string;
      quantity: number;
      modifierOption?: { priceCents: number };
    }>;
  }>;
};

function vendorHoursFields(
  vendor: DisplayCartRowForValidation["items"][number]["vendor"]
): VendorHoursSourceFields {
  return {
    syncCustomerOrderingHoursFromDeliverect: vendor.syncCustomerOrderingHoursFromDeliverect ?? false,
    customerOrderingHours: vendor.customerOrderingHours ?? null,
    deliverectSyncedCustomerOrderingHours: vendor.deliverectSyncedCustomerOrderingHours ?? null,
  };
}

export function buildCartForValidationFromDisplayCart(
  cart: DisplayCartRowForValidation
): CartForValidation {
  const timeZone = resolveVendorHoursTimezone(cart.pod?.pickupTimezone);

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
        posOpen: resolveVendorPosOpen(vendorHoursFields(i.vendor), timeZone),
        menuSource: i.vendor.menuSource,
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
