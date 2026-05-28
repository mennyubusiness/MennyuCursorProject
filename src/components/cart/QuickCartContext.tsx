"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Cart } from "@/domain/types";
import {
  CART_CLEARED_EVENT,
  CART_UPDATED_EVENT,
  dispatchCartUpdated,
  emptyCartSnapshot,
  shouldApplyCartSnapshot,
  cartClearAppliesToContext,
  type CartClearedDetail,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";
import { getCurrentPodIdFromClient } from "@/lib/quick-cart-pod";

type QuickCartContextValue = {
  enabled: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  cart: Cart | null;
  loading: boolean;
  itemCount: number;
  refreshCart: () => Promise<void>;
  setCart: (cart: Cart | null) => void;
  applyCartSnapshot: (cart: Cart | null) => void;
};

const QuickCartContext = createContext<QuickCartContextValue | null>(null);

export function QuickCartProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const itemCount = useMemo(
    () => cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0,
    [cart]
  );

  const applyCartSnapshot = useCallback((next: Cart | null) => {
    setCart(next);
    setLoading(false);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!enabled) return;
    const podId = getCurrentPodIdFromClient();
    if (!podId) {
      setCart(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cart?podId=${encodeURIComponent(podId)}`, {
        credentials: "same-origin",
      });
      if (!res.ok) {
        setCart(null);
        return;
      }
      const data = (await res.json()) as Cart;
      setCart(data);
    } catch {
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const openCart = useCallback(() => {
    if (!enabled) return;
    setIsOpen(true);
    if (!cart) {
      void refreshCart();
    }
  }, [enabled, cart, refreshCart]);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refreshCart();
  }, [enabled, refreshCart]);

  useEffect(() => {
    if (!enabled) return;
    const onCartUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CartUpdatedDetail>).detail;
      if (detail?.cart !== undefined) {
        if (detail.source === "quick-cart") return;

        const currentPodId = getCurrentPodIdFromClient();
        if (detail.cart && currentPodId && detail.cart.podId !== currentPodId) return;

        if (cart?.id && cart.podId) {
          if (
            !shouldApplyCartSnapshot(detail, "quick-cart", {
              cartId: cart.id,
              podId: cart.podId,
            })
          ) {
            return;
          }
        }

        applyCartSnapshot(detail.cart);
        return;
      }
      if (detail?.refresh) {
        void refreshCart();
      }
    };
    const onCartCleared = (event: Event) => {
      const detail = (event as CustomEvent<CartClearedDetail>).detail;
      const currentPodId = getCurrentPodIdFromClient() ?? cart?.podId ?? "";
      const ctx = {
        cartId: cart?.id ?? detail?.cartId ?? "",
        podId: currentPodId || detail?.podId || "",
      };
      if (!detail || !ctx.podId || !cartClearAppliesToContext(detail, ctx)) return;
      const empty =
        detail.cart ??
        emptyCartSnapshot({
          id: detail.cartId,
          podId: detail.podId,
          sessionId: cart?.sessionId,
        });
      applyCartSnapshot(empty);
    };
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);
    window.addEventListener(CART_CLEARED_EVENT, onCartCleared);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
      window.removeEventListener(CART_CLEARED_EVENT, onCartCleared);
    };
  }, [enabled, applyCartSnapshot, refreshCart, cart?.id, cart?.podId, cart?.sessionId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, closeCart]);

  const value = useMemo(
    () => ({
      enabled,
      isOpen,
      openCart,
      closeCart,
      cart,
      loading,
      itemCount,
      refreshCart,
      setCart,
      applyCartSnapshot,
    }),
    [
      enabled,
      isOpen,
      openCart,
      closeCart,
      cart,
      loading,
      itemCount,
      refreshCart,
      applyCartSnapshot,
    ]
  );

  return <QuickCartContext.Provider value={value}>{children}</QuickCartContext.Provider>;
}

export function useQuickCart(): QuickCartContextValue {
  const ctx = useContext(QuickCartContext);
  if (!ctx) {
    throw new Error("useQuickCart must be used within QuickCartProvider");
  }
  return ctx;
}

export function useQuickCartOptional(): QuickCartContextValue | null {
  return useContext(QuickCartContext);
}

/** After server cart mutations from drawer controls. */
export function notifyQuickCartUpdated(cart: Cart | null) {
  dispatchCartUpdated({ cart, source: "quick-cart" });
  return cart;
}
