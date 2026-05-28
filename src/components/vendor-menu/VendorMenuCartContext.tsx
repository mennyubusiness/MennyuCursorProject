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
import type { Cart, CartItem, CartItemSelection } from "@/domain/types";
import {
  CART_CLEARED_EVENT,
  CART_UPDATED_EVENT,
  dispatchCartUpdated,
  emptyCartSnapshot,
  ensureCartSnapshotScalars,
  shouldApplyCartSnapshot,
  cartClearAppliesToContext,
  type CartClearedDetail,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";
import {
  optimisticPendingModifierLine,
  optimisticSimpleAdd,
  type OptimisticSimpleAddParams,
} from "@/lib/cart-optimistic";

export type CartMutationError = {
  message: string;
  code?: string;
};

export type ModifierAddOptimisticParams = {
  menuItemId: string;
  vendorId: string;
  vendorName: string;
  menuItemName: string;
  unitPriceCents: number;
  selections: CartItemSelection[];
};

type VendorMenuCartContextValue = {
  cart: Cart;
  cartId: string;
  vendorId: string;
  vendorCartItems: CartItem[];
  cartMutationError: CartMutationError | null;
  clearCartMutationError: () => void;
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
  /** Close modal first, then optimistic add + server action in background. */
  runModifierAddInBackground: (params: {
    optimistic: ModifierAddOptimisticParams;
    add: () => Promise<
      | { success: true; cart: Cart }
      | { success: false; error: string; code?: string }
    >;
  }) => void;
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
  const [cartMutationError, setCartMutationError] = useState<CartMutationError | null>(null);
  const syncedInitialRef = useRef(false);
  const modifierAddInFlightRef = useRef(false);
  const snapshotContext = useMemo(
    () => ({ cartId: initialCart.id, podId: initialCart.podId }),
    [initialCart.id, initialCart.podId]
  );

  useEffect(() => {
    if (syncedInitialRef.current) return;
    syncedInitialRef.current = true;
    dispatchCartUpdated({ cart: initialCart, source: "vendor-menu" });
  }, [initialCart]);

  useEffect(() => {
    const onCartUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CartUpdatedDetail>).detail;
      if (!shouldApplyCartSnapshot(detail, "vendor-menu", snapshotContext)) return;
      setCart(detail!.cart!);
    };
    const onCartCleared = (event: Event) => {
      const detail = (event as CustomEvent<CartClearedDetail>).detail;
      if (!cartClearAppliesToContext(detail, snapshotContext)) return;
      const empty =
        detail!.cart ??
        emptyCartSnapshot({
          id: snapshotContext.cartId,
          podId: snapshotContext.podId,
          sessionId: cart.sessionId,
        });
      setCart(empty);
    };
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);
    window.addEventListener(CART_CLEARED_EVENT, onCartCleared);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
      window.removeEventListener(CART_CLEARED_EVENT, onCartCleared);
    };
  }, [snapshotContext, cart.sessionId]);

  const vendorCartItems = useMemo(
    () => cart.items.filter((i) => i.vendorId === vendorId),
    [cart.items, vendorId]
  );

  const applyServerCart = useCallback(
    (next: Cart) => {
      const normalized = ensureCartSnapshotScalars(next, {
        id: cart.id,
        podId: cart.podId,
        sessionId: cart.sessionId,
      });
      setCart(normalized);
      dispatchCartUpdated({ cart: normalized, source: "vendor-menu" });
    },
    [cart.id, cart.podId, cart.sessionId]
  );

  const applyServerCartFromMutation = applyServerCart;

  const clearCartMutationError = useCallback(() => {
    setCartMutationError(null);
  }, []);

  const reportCartMutationError = useCallback((error: CartMutationError) => {
    setCartMutationError(error);
  }, []);

  const runModifierAddInBackground = useCallback(
    ({
      optimistic,
      add,
    }: {
      optimistic: ModifierAddOptimisticParams;
      add: () => Promise<
        | { success: true; cart: Cart }
        | { success: false; error: string; code?: string }
      >;
    }) => {
      if (modifierAddInFlightRef.current) return;
      modifierAddInFlightRef.current = true;

      const snapshot = cart;
      const optimisticCart = ensureCartSnapshotScalars(
        optimisticPendingModifierLine(snapshot, optimistic),
        { id: cart.id, podId: cart.podId, sessionId: cart.sessionId }
      );
      setCart(optimisticCart);
      dispatchCartUpdated({ cart: optimisticCart, source: "vendor-menu" });

      void (async () => {
        try {
          const result = await add();
          if (result.success) {
            setCartMutationError(null);
            setCart(result.cart);
            dispatchCartUpdated({ cart: result.cart, source: "vendor-menu" });
          } else {
            setCart(snapshot);
            dispatchCartUpdated({ cart: snapshot, source: "vendor-menu" });
            reportCartMutationError({ message: result.error, code: result.code });
          }
        } catch (e) {
          setCart(snapshot);
          dispatchCartUpdated({ cart: snapshot, source: "vendor-menu" });
          reportCartMutationError({
            message: e instanceof Error ? e.message : "Could not add to cart",
          });
        } finally {
          modifierAddInFlightRef.current = false;
        }
      })();
    },
    [cart, reportCartMutationError]
  );

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
      const optimisticRaw = optimisticSimpleAdd(snapshot, optimisticParams);
      const optimistic = optimisticRaw
        ? ensureCartSnapshotScalars(optimisticRaw, {
            id: cart.id,
            podId: cart.podId,
            sessionId: cart.sessionId,
          })
        : null;
      if (optimistic) {
        setCart(optimistic);
        dispatchCartUpdated({ cart: optimistic, source: "vendor-menu" });
      }

      const result = await add();
      if (result.success) {
        setCartMutationError(null);
        setCart(result.cart);
        dispatchCartUpdated({ cart: result.cart, source: "vendor-menu" });
        return result;
      }

      setCart(snapshot);
      dispatchCartUpdated({ cart: snapshot, source: "vendor-menu" });
      reportCartMutationError({ message: result.error, code: result.code });
      return result;
    },
    [cart, reportCartMutationError]
  );

  const value = useMemo(
    () => ({
      cart,
      cartId: cart.id,
      vendorId,
      vendorCartItems,
      cartMutationError,
      clearCartMutationError,
      applyServerCart,
      runSimpleAddToCart,
      applyServerCartFromMutation,
      runModifierAddInBackground,
    }),
    [
      cart,
      vendorId,
      vendorCartItems,
      cartMutationError,
      clearCartMutationError,
      applyServerCart,
      runSimpleAddToCart,
      applyServerCartFromMutation,
      runModifierAddInBackground,
    ]
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
