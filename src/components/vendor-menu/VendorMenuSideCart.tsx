"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Cart } from "@/domain/types";
import { ButtonLink } from "@/components/ui/button";
import { shortCartLineLabel } from "@/lib/cart-line-identity";
import { cn } from "@/lib/cn";

type VendorMenuSideCartProps = {
  cart: Cart;
  podId: string;
  podName: string;
  currentVendorName: string;
  className?: string;
};

export function VendorMenuSideCart({
  cart,
  podId,
  podName,
  currentVendorName,
  className,
}: VendorMenuSideCartProps) {
  const router = useRouter();
  const itemCount = cart.items.reduce((n, i) => n + i.quantity, 0);

  useEffect(() => {
    const onCartChange = () => router.refresh();
    window.addEventListener("mennyu:cart-added", onCartChange);
    return () => window.removeEventListener("mennyu:cart-added", onCartChange);
  }, [router]);

  return (
    <aside
      className={cn(
        "hidden xl:flex xl:w-72 xl:shrink-0",
        "sticky top-[calc(4.25rem+1px)] self-start",
        className
      )}
      aria-label="Your cart"
    >
      <div className="flex max-h-[calc(100vh-5.5rem)] w-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-bold text-black">Your cart</h2>
          <p className="mt-0.5 text-xs text-zinc-600">
            <Link href={`/pod/${podId}`} className="font-medium text-zinc-800 hover:underline">
              {podName}
            </Link>
            {" · "}
            multi-vendor checkout
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {cart.items.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Add items from {currentVendorName} or other kitchens at this pod.
            </p>
          ) : (
            <ul className="space-y-3">
              {cart.groups.map((group) => (
                <li key={group.vendorId}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    {group.vendorName}
                  </p>
                  <ul className="mt-1.5 space-y-2">
                    {group.items.map((line) => (
                      <li key={line.id} className="text-sm">
                        <div className="flex justify-between gap-2">
                          <span className="min-w-0 font-medium text-zinc-900">
                            <span className="tabular-nums text-zinc-600">{line.quantity}×</span>{" "}
                            {line.menuItem?.name ?? "Item"}
                          </span>
                          <span className="shrink-0 tabular-nums text-zinc-800">
                            ${((line.priceCents * line.quantity) / 100).toFixed(2)}
                          </span>
                        </div>
                        {(line.selections?.length ?? 0) > 0 && (
                          <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                            {shortCartLineLabel(line)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-zinc-100 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-600">Subtotal</span>
            <span className="font-bold tabular-nums text-black">
              ${(cart.subtotalCents / 100).toFixed(2)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {itemCount} item{itemCount === 1 ? "" : "s"} · taxes at checkout
          </p>
          <ButtonLink
            href="/cart"
            className="mt-3 w-full"
            size="sm"
            variant={cart.items.length > 0 ? "primary" : "outline"}
          >
            {cart.items.length > 0 ? "Review cart & checkout" : "View cart"}
          </ButtonLink>
        </div>
      </div>
    </aside>
  );
}
