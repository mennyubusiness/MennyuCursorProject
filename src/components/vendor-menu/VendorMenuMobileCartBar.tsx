"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Cart } from "@/domain/types";
import { cn } from "@/lib/cn";

type VendorMenuMobileCartBarProps = {
  cart: Cart;
  className?: string;
};

export function VendorMenuMobileCartBar({ cart, className }: VendorMenuMobileCartBarProps) {
  const router = useRouter();
  const itemCount = cart.items.reduce((n, i) => n + i.quantity, 0);

  useEffect(() => {
    const onCartChange = () => router.refresh();
    window.addEventListener("mennyu:cart-added", onCartChange);
    return () => window.removeEventListener("mennyu:cart-added", onCartChange);
  }, [router]);

  if (itemCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 xl:hidden",
        className
      )}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-black">
            {itemCount} in cart · ${(cart.subtotalCents / 100).toFixed(2)}
          </p>
          <p className="truncate text-xs text-zinc-600">Shared pod cart · one checkout</p>
        </div>
        <Link
          href="/cart"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          View cart
        </Link>
      </div>
    </div>
  );
}
