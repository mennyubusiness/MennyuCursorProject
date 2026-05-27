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
import { getCurrentPodIdFromClient } from "@/lib/quick-cart-pod";
import { dispatchCartItemAdded } from "@/lib/cart-ui-feedback";

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
    void refreshCart();
  }, [enabled, refreshCart]);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refreshCart();
  }, [enabled, refreshCart]);

  useEffect(() => {
    if (!enabled) return;
    const onCartChange = () => {
      void refreshCart();
    };
    window.addEventListener("mennyu:cart-added", onCartChange);
    return () => window.removeEventListener("mennyu:cart-added", onCartChange);
  }, [enabled, refreshCart]);

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
    }),
    [enabled, isOpen, openCart, closeCart, cart, loading, itemCount, refreshCart]
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
  dispatchCartItemAdded();
  return cart;
}
