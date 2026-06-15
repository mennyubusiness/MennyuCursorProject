"use client";

import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { MobileBottomActionBar } from "@/components/mobile/MobileBottomActionBar";
import { flushCartMutations } from "@/lib/cart-mutation-queue";
import { formatMobileBottomActionSummary } from "@/lib/mobile-customer-ui";
import { useVendorMenuCartOptional } from "@/components/vendor-menu/VendorMenuCartContext";

type VendorMenuMobileCartBarProps = {
  className?: string;
};

/** Mobile shortcut to open the global quick cart (replaces local full-width cart link). */
export function VendorMenuMobileCartBar({ className }: VendorMenuMobileCartBarProps) {
  const quickCart = useQuickCartOptional();
  const vendorMenuCart = useVendorMenuCartOptional();
  const displayCart = quickCart?.cart ?? vendorMenuCart?.cart ?? null;
  const itemCount = displayCart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

  if (!displayCart || itemCount === 0) return null;

  const openCart = () => {
    if (quickCart?.enabled) {
      quickCart.openCart();
      return;
    }
    const cartId = displayCart?.id;
    void flushCartMutations(cartId).then(() => {
      window.location.href = "/cart";
    });
  };

  return (
    <MobileBottomActionBar
      className={className}
      summaryTitle={formatMobileBottomActionSummary(itemCount, displayCart.subtotalCents)}
      summarySubtitle="Shared pod cart · tap to review"
      primaryLabel="View cart"
      onPrimaryClick={openCart}
      aria-label={`View cart, ${itemCount} items`}
    />
  );
}
