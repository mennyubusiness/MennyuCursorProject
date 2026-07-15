"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuickCartOptional } from "@/components/cart/QuickCartContext";
import { MobileBottomActionBar } from "@/components/mobile/MobileBottomActionBar";
import { flushAllCartWork } from "@/lib/cart-sync-scheduler";
import { formatMobileBottomActionSummary } from "@/lib/mobile-customer-ui";
import { useVendorMenuCartOptional } from "@/components/vendor-menu/VendorMenuCartContext";

type VendorMenuMobileCartBarProps = {
  className?: string;
};

/** Mobile shortcut to open the global quick cart (replaces local full-width cart link). */
export function VendorMenuMobileCartBar({ className }: VendorMenuMobileCartBarProps) {
  const router = useRouter();
  const quickCart = useQuickCartOptional();
  const vendorMenuCart = useVendorMenuCartOptional();
  const displayCart = quickCart?.cart ?? vendorMenuCart?.cart ?? null;
  const itemCount = displayCart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const [navigating, setNavigating] = useState(false);

  if (!displayCart || itemCount === 0) return null;

  const openCart = () => {
    if (navigating) return;
    if (quickCart?.enabled) {
      quickCart.openCart();
      return;
    }
    const cartId = displayCart?.id;
    setNavigating(true);
    try {
      router.prefetch("/cart");
    } catch {
      // best-effort
    }
    void flushAllCartWork(cartId)
      .then(() => {
        router.push("/cart");
      })
      .catch(() => {
        setNavigating(false);
      });
  };

  return (
    <MobileBottomActionBar
      className={className}
      summaryTitle={formatMobileBottomActionSummary(itemCount, displayCart.subtotalCents)}
      summarySubtitle="Shared pod cart · tap to review"
      primaryLabel={navigating ? "Opening cart…" : "View cart"}
      primaryLoading={navigating}
      onPrimaryClick={openCart}
      aria-label={`View cart, ${itemCount} items`}
    />
  );
}
