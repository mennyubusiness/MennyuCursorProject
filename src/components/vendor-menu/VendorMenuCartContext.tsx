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
  mergeAcceptedCartSnapshotMeta,
  shouldAcceptCartSnapshot,
  rememberAcceptedCartSnapshot,
  resolveInitialVendorMenuCart,
  type CartClearedDetail,
  type CartSnapshotMeta,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";
import {
  runOptimisticCartMutation,
} from "@/lib/cart-optimistic-mutations";
import { enqueueCartMutation, markCartSnapshotCommitted } from "@/lib/cart-mutation-queue";
import { normalizeAuthoritativeCartSnapshot } from "@/lib/cart-group-metadata";
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
  applyLocalCartUpdate: (cart: Cart) => void;
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
  getCartSnapshot: () => Cart;
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
  const [cart, setCart] = useState<Cart>(() => resolveInitialVendorMenuCart(initialCart));
  const [cartMutationError, setCartMutationError] = useState<CartMutationError | null>(null);
  const cartRef = useRef<Cart>(initialCart);
  const syncedInitialRef = useRef(false);
  const lastAcceptedMetaRef = useRef<CartSnapshotMeta | null>(null);

  cartRef.current = cart;

  const snapshotContext = useMemo(
    () => ({ cartId: cart.id, podId: cart.podId }),
    [cart.id, cart.podId]
  );

  useEffect(() => {
    if (syncedInitialRef.current) return;
    syncedInitialRef.current = true;
    const detail = dispatchCartUpdated({ cart, source: "vendor-menu" });
    if (detail && shouldAcceptCartSnapshot(detail, lastAcceptedMetaRef.current)) {
      lastAcceptedMetaRef.current = mergeAcceptedCartSnapshotMeta(
        lastAcceptedMetaRef.current,
        detail
      );
      rememberAcceptedCartSnapshot(cart);
    }
  }, [cart]);

  useEffect(() => {
    const onCartUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CartUpdatedDetail>).detail;
      if (detail?.cart && detail.source === "group-order-start") {
        if (detail.cart.podId !== cartRef.current.podId) return;
        if (!shouldAcceptCartSnapshot(detail, lastAcceptedMetaRef.current)) return;
        const normalized = ensureCartSnapshotScalars(detail.cart);
        cartRef.current = normalized;
        setCart(normalized);
        markCartSnapshotCommitted(normalized.id);
        lastAcceptedMetaRef.current = mergeAcceptedCartSnapshotMeta(
          lastAcceptedMetaRef.current,
          detail
        );
        rememberAcceptedCartSnapshot(normalized);
        return;
      }
      if (detail?.cart !== undefined && detail.source === "group-order-ended") {
        if (detail.cart && detail.cart.podId !== cartRef.current.podId) return;
        if (!shouldAcceptCartSnapshot(detail, lastAcceptedMetaRef.current)) return;
        const next =
          detail.cart ??
          emptyCartSnapshot({
            id: snapshotContext.cartId,
            podId: snapshotContext.podId,
            sessionId: cart.sessionId,
          });
        const normalized = normalizeAuthoritativeCartSnapshot(
          ensureCartSnapshotScalars(next),
          "group-order-ended"
        );
        cartRef.current = normalized;
        setCart(normalized);
        markCartSnapshotCommitted(normalized.id);
        lastAcceptedMetaRef.current = mergeAcceptedCartSnapshotMeta(
          lastAcceptedMetaRef.current,
          detail
        );
        rememberAcceptedCartSnapshot(normalized);
        return;
      }
      if (!shouldApplyCartSnapshot(detail, "vendor-menu", snapshotContext)) return;
      if (!shouldAcceptCartSnapshot(detail, lastAcceptedMetaRef.current)) return;
      const accepted = detail!.cart!;
      setCart(accepted);
      lastAcceptedMetaRef.current = mergeAcceptedCartSnapshotMeta(
        lastAcceptedMetaRef.current,
        detail!
      );
      rememberAcceptedCartSnapshot(accepted);
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
      const normalized = normalizeAuthoritativeCartSnapshot(
        ensureCartSnapshotScalars(next, {
          id: cartRef.current.id,
          podId: cartRef.current.podId,
          sessionId: cartRef.current.sessionId,
        }),
        "vendor-menu"
      );
      cartRef.current = normalized;
      setCart(normalized);
      markCartSnapshotCommitted(normalized.id);
      const detail = dispatchCartUpdated({ cart: normalized, source: "vendor-menu" });
      if (detail) {
        lastAcceptedMetaRef.current = mergeAcceptedCartSnapshotMeta(
          lastAcceptedMetaRef.current,
          detail
        );
        rememberAcceptedCartSnapshot(normalized);
      }
    },
    []
  );

  const applyServerCart = useCallback((next: Cart) => {
    publishCart(next);
  }, [publishCart]);

  const applyLocalCartUpdate = useCallback((next: Cart) => {
    const normalized = normalizeAuthoritativeCartSnapshot(
      ensureCartSnapshotScalars(next, {
        id: cartRef.current.id,
        podId: cartRef.current.podId,
        sessionId: cartRef.current.sessionId,
      }),
      "vendor-menu"
    );
    cartRef.current = normalized;
    setCart(normalized);
    rememberAcceptedCartSnapshot(normalized);
  }, []);

  const applyServerCartFromMutation = applyServerCart;

  const getCartSnapshot = useCallback(() => cartRef.current, []);

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
        const optimisticCart = normalizeAuthoritativeCartSnapshot(
          ensureCartSnapshotScalars(
            optimisticPendingModifierLine(snapshot, optimistic),
            { id: snapshot.id, podId: snapshot.podId, sessionId: snapshot.sessionId }
          ),
          "vendor-menu"
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
      return runOptimisticCartMutation({
        cartId: cartRef.current.id,
        source: "vendor-menu",
        getCurrentCart: () => cartRef.current,
        applyOptimistic: (snapshot) => optimisticSimpleAdd(snapshot, optimisticParams),
        runServer: add,
        applyLocal: applyLocalCartUpdate,
        setError: (message) => {
          if (message) {
            reportCartMutationError({ message });
          } else {
            setCartMutationError(null);
          }
        },
      });
    },
    [applyLocalCartUpdate, reportCartMutationError]
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
      applyLocalCartUpdate,
      runSimpleAddToCart,
      applyServerCartFromMutation,
      getCartSnapshot,
      runModifierAddInBackground,
    }),
    [
      cart,
      vendorId,
      vendorCartItems,
      cartMutationError,
      clearCartMutationError,
      applyServerCart,
      applyLocalCartUpdate,
      runSimpleAddToCart,
      applyServerCartFromMutation,
      getCartSnapshot,
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
