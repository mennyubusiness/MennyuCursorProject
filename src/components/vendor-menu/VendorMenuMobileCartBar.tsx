"use client";

import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { useVendorMenuCartOptional } from "@/components/vendor-menu/VendorMenuCartContext";
import { cn } from "@/lib/cn";
import { mobileStickyCartBarFixedClass } from "@/lib/mobile-sticky-cart-bar-classes";

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
    window.location.href = "/cart";
  };

  return (
    <div className={cn(mobileStickyCartBarFixedClass, "lg:hidden", className)}>
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-oo-charcoal">
            {itemCount} in cart · ${(displayCart.subtotalCents / 100).toFixed(2)}
          </p>
          <p className="truncate text-xs text-oo-charcoal/70">Shared pod cart · tap to review</p>
        </div>
        <button
          type="button"
          onClick={openCart}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          View cart
        </button>
      </div>
    </div>
  );
}
