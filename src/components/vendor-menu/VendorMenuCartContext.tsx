"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Cart, CartItem } from "@/domain/types";
import { dispatchCartUpdated } from "@/lib/cart-client-sync";
import { optimisticSimpleAdd, type OptimisticSimpleAddParams } from "@/lib/cart-optimistic";

type VendorMenuCartContextValue = {
  cart: Cart;
  cartId: string;
  vendorId: string;
  vendorCartItems: CartItem[];
  applyServerCart: (cart: Cart) => void;
  /** Optimistic simple add; runs server action; rolls back on failure. */
  runSimpleAddToCart: (
    params: OptimisticSimpleAddParams & {
      add: () => Promise<
        | { success: true; cart: Cart }
        | { success: false; error: string; code?: string }
      >;
    }
  ) => Promise<
    | { success: true; cart: Cart }
    | { success: false; error: string; code?: string }
  >;
  applyServerCartFromMutation: (cart: Cart) => void;
};

const VendorMenuCartContext = createContext<VendorMenuCartContextValue | null>(null);

export function VendorMenuCartProvider({
  children,
  initialCart,
  vendorId,
}: {
  children: ReactNode;
  initialCart: Cart;
  vendorId: string;
}) {
  const [cart, setCart] = useState<Cart>(initialCart);
  const syncedInitialRef = useRef(false);

  useEffect(() => {
    if (syncedInitialRef.current) return;
    syncedInitialRef.current = true;
    dispatchCartUpdated({ cart: initialCart });
  }, [initialCart]);

  const vendorCartItems = useMemo(
    () => cart.items.filter((i) => i.vendorId === vendorId),
    [cart.items, vendorId]
  );

  const applyServerCart = useCallback((next: Cart) => {
    setCart(next);
    dispatchCartUpdated({ cart: next });
  }, []);

  const applyServerCartFromMutation = applyServerCart;

  const runSimpleAddToCart = useCallback(
    async ({
      add,
      ...optimisticParams
    }: OptimisticSimpleAddParams & {
      add: () => Promise<
        | { success: true; cart: Cart }
        | { success: false; error: string; code?: string }
      >;
    }) => {
      const snapshot = cart;
      const optimistic = optimisticSimpleAdd(snapshot, optimisticParams);
      if (optimistic) {
        setCart(optimistic);
        dispatchCartUpdated({ cart: optimistic });
      }

      const result = await add();
      if (result.success) {
        setCart(result.cart);
        dispatchCartUpdated({ cart: result.cart });
        return result;
      }

      setCart(snapshot);
      dispatchCartUpdated({ cart: snapshot });
      return result;
    },
    [cart]
  );

  const value = useMemo(
    () => ({
      cart,
      cartId: cart.id,
      vendorId,
      vendorCartItems,
      applyServerCart,
      runSimpleAddToCart,
      applyServerCartFromMutation,
    }),
    [cart, vendorId, vendorCartItems, applyServerCart, runSimpleAddToCart, applyServerCartFromMutation]
  );

  return (
    <VendorMenuCartContext.Provider value={value}>{children}</VendorMenuCartContext.Provider>
  );
}

export function useVendorMenuCart(): VendorMenuCartContextValue {
  const ctx = useContext(VendorMenuCartContext);
  if (!ctx) {
    throw new Error("useVendorMenuCart must be used within VendorMenuCartProvider");
  }
  return ctx;
}

export function useVendorMenuCartOptional(): VendorMenuCartContextValue | null {
  return useContext(VendorMenuCartContext);
}
