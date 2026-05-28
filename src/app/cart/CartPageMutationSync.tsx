"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Cart } from "@/domain/types";
import {
  CART_UPDATED_EVENT,
  cartSnapshotAppliesToContext,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";

type CartPageMutationContextValue = {
  cart: Cart;
  cartId: string;
  podId: string;
  itemById: (cartItemId: string) => Cart["items"][number] | undefined;
  vendorSubtotalCents: (vendorId: string) => number;
  vendorLineCount: (vendorId: string) => number;
};

const CartPageMutationContext = createContext<CartPageMutationContextValue | null>(null);

function useCartPageMutation(): CartPageMutationContextValue {
  const ctx = useContext(CartPageMutationContext);
  if (!ctx) {
    throw new Error("Cart page live components must render inside CartPageMutationProvider");
  }
  return ctx;
}

/** Applies cart-page mutation snapshots locally so /cart UI stays in sync without router.refresh(). */
export function CartPageMutationProvider({
  cartId,
  podId,
  initialCart,
  children,
}: {
  cartId: string;
  podId: string;
  initialCart: Cart;
  children: ReactNode;
}) {
  const [cart, setCart] = useState(initialCart);

  useEffect(() => {
    setCart(initialCart);
  }, [initialCart]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<CartUpdatedDetail>).detail;
      if (detail?.source !== "cart-page") return;
      if (!detail.cart || !cartSnapshotAppliesToContext(detail.cart, { cartId, podId })) return;
      setCart(detail.cart);
    };
    window.addEventListener(CART_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onUpdate);
  }, [cartId, podId]);

  const value = useMemo<CartPageMutationContextValue>(() => {
    const itemById = (cartItemId: string) => cart.items.find((i) => i.id === cartItemId);
    return {
      cart,
      cartId,
      podId,
      itemById,
      vendorSubtotalCents: (vendorId: string) =>
        cart.items
          .filter((i) => i.vendorId === vendorId)
          .reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
      vendorLineCount: (vendorId: string) =>
        cart.items.filter((i) => i.vendorId === vendorId).length,
    };
  }, [cart, cartId, podId]);

  return (
    <CartPageMutationContext.Provider value={value}>{children}</CartPageMutationContext.Provider>
  );
}

export function CartPageLiveEmptyNotice() {
  const { cart } = useCartPageMutation();
  if (cart.items.length > 0) return null;
  return (
    <p className="mt-10 rounded-xl border border-stone-200 bg-stone-50 p-6 text-center text-stone-700">
      Your cart is empty. Browse vendors on this pod to add items.
    </p>
  );
}

export function CartPageLiveVendorSection({
  vendorId,
  children,
}: {
  vendorId: string;
  children: ReactNode;
}) {
  const { vendorLineCount } = useCartPageMutation();
  if (vendorLineCount(vendorId) === 0) return null;
  return children;
}

export function CartPageLiveLineGate({
  cartItemId,
  children,
}: {
  cartItemId: string;
  children: ReactNode;
}) {
  const { itemById } = useCartPageMutation();
  if (!itemById(cartItemId)) return null;
  return children;
}

export function CartPageLiveQuantity({
  cartItemId,
  fallback,
}: {
  cartItemId: string;
  fallback: number;
}) {
  const { itemById } = useCartPageMutation();
  return <>{itemById(cartItemId)?.quantity ?? fallback}</>;
}

export function CartPageLiveLineTotal({
  cartItemId,
  fallbackCents,
}: {
  cartItemId: string;
  fallbackCents: number;
}) {
  const { itemById } = useCartPageMutation();
  const item = itemById(cartItemId);
  const cents = item ? item.priceCents * item.quantity : fallbackCents;
  return <>${(cents / 100).toFixed(2)}</>;
}

export function CartPageLiveVendorSubtotal({
  vendorId,
  fallbackCents,
}: {
  vendorId: string;
  fallbackCents: number;
}) {
  const { vendorSubtotalCents } = useCartPageMutation();
  const cents = vendorSubtotalCents(vendorId);
  return <>${((cents || fallbackCents) / 100).toFixed(2)}</>;
}

export function CartPageLiveVendorLineCountLabel({
  vendorId,
  fallback,
}: {
  vendorId: string;
  fallback: number;
}) {
  const { vendorLineCount } = useCartPageMutation();
  const count = vendorLineCount(vendorId) || fallback;
  return (
    <>
      {count} line{count !== 1 ? "s" : ""} in this group
    </>
  );
}

export function CartPageLiveFoodSubtotal({ fallbackCents }: { fallbackCents: number }) {
  const { cart } = useCartPageMutation();
  const computed = cart.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  return <>${((computed || cart.subtotalCents || fallbackCents) / 100).toFixed(2)}</>;
}

export function CartPageLiveCheckoutGate({ children }: { children: ReactNode }) {
  const { cart } = useCartPageMutation();
  if (cart.items.length === 0) return null;
  return children;
}
