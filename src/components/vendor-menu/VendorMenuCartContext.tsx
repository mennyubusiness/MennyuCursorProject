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
  enqueueCartMutation,
  markCartSnapshotCommitted,
} from "@/lib/cart-mutation-queue";
import {
  optimisticPendingModifierLine,
  optimisticSimpleAdd,
  type OptimisticSimpleAddParams,
} from "@/lib/cart-optimistic";

export const CART_MUTATION_ERROR_MESSAGE =
  "We couldn't update your cart. Please try again.";

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
  const cartRef = useRef<Cart>(initialCart);
  const syncedInitialRef = useRef(false);

  cartRef.current = cart;

  const snapshotContext = useMemo(
    () => ({ cartId: cart.id, podId: cart.podId }),
    [cart.id, cart.podId]
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

  const publishCart = useCallback(
    (next: Cart) => {
      const normalized = ensureCartSnapshotScalars(next, {
        id: cartRef.current.id,
        podId: cartRef.current.podId,
        sessionId: cartRef.current.sessionId,
      });
      cartRef.current = normalized;
      setCart(normalized);
      markCartSnapshotCommitted(normalized.id);
      dispatchCartUpdated({ cart: normalized, source: "vendor-menu" });
    },
    []
  );

  const applyServerCart = useCallback((next: Cart) => {
    publishCart(next);
  }, [publishCart]);

  const applyServerCartFromMutation = applyServerCart;

  const clearCartMutationError = useCallback(() => {
    setCartMutationError(null);
  }, []);

  const reportCartMutationError = useCallback((error: CartMutationError) => {
    setCartMutationError({
      message: error.message || CART_MUTATION_ERROR_MESSAGE,
      code: error.code,
    });
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
      const cartId = cartRef.current.id;
      void enqueueCartMutation(cartId, async () => {
        const snapshot = cartRef.current;
        const optimisticCart = ensureCartSnapshotScalars(
          optimisticPendingModifierLine(snapshot, optimistic),
          { id: snapshot.id, podId: snapshot.podId, sessionId: snapshot.sessionId }
        );
        cartRef.current = optimisticCart;
        setCart(optimisticCart);
        dispatchCartUpdated({ cart: optimisticCart, source: "vendor-menu" });

        try {
          const result = await add();
          if (result.success) {
            setCartMutationError(null);
            publishCart(result.cart);
          } else {
            cartRef.current = snapshot;
            setCart(snapshot);
            dispatchCartUpdated({ cart: snapshot, source: "vendor-menu" });
            reportCartMutationError({ message: result.error, code: result.code });
          }
        } catch (e) {
          cartRef.current = snapshot;
          setCart(snapshot);
          dispatchCartUpdated({ cart: snapshot, source: "vendor-menu" });
          reportCartMutationError({
            message: e instanceof Error ? e.message : CART_MUTATION_ERROR_MESSAGE,
          });
        }
      });
    },
    [publishCart, reportCartMutationError]
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
      const cartId = cartRef.current.id;
      return enqueueCartMutation(cartId, async () => {
        const snapshot = cartRef.current;
        const optimisticRaw = optimisticSimpleAdd(snapshot, optimisticParams);
        const optimisticCart = optimisticRaw
          ? ensureCartSnapshotScalars(optimisticRaw, {
              id: snapshot.id,
              podId: snapshot.podId,
              sessionId: snapshot.sessionId,
            })
          : null;
        if (optimisticCart) {
          cartRef.current = optimisticCart;
          setCart(optimisticCart);
          dispatchCartUpdated({ cart: optimisticCart, source: "vendor-menu" });
        }

        const result = await add();
        if (result.success) {
          setCartMutationError(null);
          publishCart(result.cart);
          return result;
        }

        cartRef.current = snapshot;
        setCart(snapshot);
        dispatchCartUpdated({ cart: snapshot, source: "vendor-menu" });
        reportCartMutationError({ message: result.error, code: result.code });
        return result;
      });
    },
    [publishCart, reportCartMutationError]
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
