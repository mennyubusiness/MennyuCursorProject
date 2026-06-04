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
import { usePathname } from "next/navigation";
import type { Cart, QuickCartApiResponse } from "@/domain/types";
import {
  CART_CLEARED_EVENT,
  CART_UPDATED_EVENT,
  dispatchCartUpdated,
  emptyCartSnapshot,
  shouldQuickCartApplyCartSnapshot,
  shouldApplyCartFetchResult,
  cartClearAppliesToContext,
  type CartClearedDetail,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";
import { getBrowsingPodIdFromClient } from "@/lib/quick-cart-pod";
import { buildCartPodContextForDisplay } from "@/lib/quick-cart-display";
import type { CartPodContext } from "@/lib/cart-pod-context";

const NEUTRAL_POD_CONTEXT: CartPodContext = {
  cartScope: "neutral",
  cartPodId: null,
  cartPodName: null,
  browsingPodId: null,
  browsingPodName: null,
  assignedPodId: null,
  canStartOrderHere: false,
  requiresClearToSwitchPod: false,
};

type QuickCartContextValue = {
  enabled: boolean;
  hasServerSession: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  cart: Cart | null;
  podContext: CartPodContext;
  loading: boolean;
  itemCount: number;
  refreshCart: () => Promise<void>;
  setCart: (cart: Cart | null) => void;
  applyCartSnapshot: (cart: Cart | null) => void;
};

const QuickCartContext = createContext<QuickCartContextValue | null>(null);

function podContextFromPayload(payload: QuickCartApiResponse): CartPodContext {
  return buildCartPodContextForDisplay({
    cart: payload.cart,
    browsingPodId: payload.browsingPodId,
    browsingPodName: payload.browsingPodName,
    assignedPodId: payload.assignedPodId,
    assignedPodName: payload.assignedPodName,
    requiresClearToSwitchPod: payload.requiresClearToSwitchPod,
  });
}

export function QuickCartProvider({
  children,
  enabled = true,
  hasServerSession = false,
}: {
  children: ReactNode;
  enabled?: boolean;
  hasServerSession?: boolean;
}) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [podContext, setPodContext] = useState<CartPodContext>(NEUTRAL_POD_CONTEXT);
  const [loading, setLoading] = useState(false);
  const cartRef = useRef<Cart | null>(null);
  const snapshotGenerationRef = useRef(0);
  const activeBrowsePodRef = useRef<string | null>(null);

  cartRef.current = cart;

  const itemCount = useMemo(
    () => cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0,
    [cart]
  );

  const applyPayload = useCallback((payload: QuickCartApiResponse) => {
    setCart(payload.cart);
    setPodContext(podContextFromPayload(payload));
    setLoading(false);
  }, []);

  const applyCartSnapshot = useCallback((next: Cart | null) => {
    snapshotGenerationRef.current += 1;
    setCart(next);
    if (!next) {
      setPodContext(NEUTRAL_POD_CONTEXT);
    } else {
      setPodContext(
        buildCartPodContextForDisplay({
          cart: next,
          browsingPodId: getBrowsingPodIdFromClient(),
          browsingPodName: null,
          assignedPodId: next.cartScope === "assigned_pod" || next.cartScope === "group_order" ? next.podId : null,
          assignedPodName: next.podName ?? null,
          requiresClearToSwitchPod: false,
        })
      );
    }
    setLoading(false);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!enabled) return;
    const browsePodId = getBrowsingPodIdFromClient();
    const generationAtStart = snapshotGenerationRef.current;
    const podAtStart = browsePodId;
    setLoading(true);
    try {
      const qs = browsePodId
        ? `?browsePodId=${encodeURIComponent(browsePodId)}`
        : "";
      const res = await fetch(`/api/cart${qs}`, {
        credentials: "same-origin",
      });
      if (
        !shouldApplyCartFetchResult({
          generationAtStart,
          currentGeneration: snapshotGenerationRef.current,
          podAtStart,
          currentPodId: getBrowsingPodIdFromClient(),
        })
      ) {
        return;
      }
      if (!res.ok) {
        setCart(null);
        setPodContext(NEUTRAL_POD_CONTEXT);
        return;
      }
      const data = (await res.json()) as QuickCartApiResponse;
      if (
        !shouldApplyCartFetchResult({
          generationAtStart,
          currentGeneration: snapshotGenerationRef.current,
          podAtStart,
          currentPodId: getBrowsingPodIdFromClient(),
        })
      ) {
        return;
      }
      applyPayload(data);
    } catch {
      if (
        shouldApplyCartFetchResult({
          generationAtStart,
          currentGeneration: snapshotGenerationRef.current,
          podAtStart,
          currentPodId: getBrowsingPodIdFromClient(),
        })
      ) {
        setCart(null);
        setPodContext(NEUTRAL_POD_CONTEXT);
      }
    } finally {
      if (
        shouldApplyCartFetchResult({
          generationAtStart,
          currentGeneration: snapshotGenerationRef.current,
          podAtStart,
          currentPodId: getBrowsingPodIdFromClient(),
        })
      ) {
        setLoading(false);
      }
    }
  }, [enabled, applyPayload]);

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
    const browsePodId = getBrowsingPodIdFromClient();
    const prevPod = activeBrowsePodRef.current;
    if (prevPod && browsePodId && prevPod !== browsePodId) {
      snapshotGenerationRef.current += 1;
      setCart(null);
      setPodContext(NEUTRAL_POD_CONTEXT);
    }
    activeBrowsePodRef.current = browsePodId;
    void refreshCart();
  }, [enabled, pathname, refreshCart]);

  useEffect(() => {
    if (!enabled) return;
    const onCartUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CartUpdatedDetail>).detail;
      if (detail?.cart !== undefined) {
        if (
          !shouldQuickCartApplyCartSnapshot(
            detail,
            cartRef.current,
            getBrowsingPodIdFromClient()
          )
        ) {
          return;
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
      const local = cartRef.current;
      const currentPodId = getBrowsingPodIdFromClient() ?? local?.podId ?? "";
      const ctx = {
        cartId: local?.id ?? detail?.cartId ?? "",
        podId: currentPodId || detail?.podId || "",
      };
      if (!detail || !ctx.podId || !cartClearAppliesToContext(detail, ctx)) return;
      const empty =
        detail.cart ??
        emptyCartSnapshot({
          id: detail.cartId,
          podId: detail.podId,
          sessionId: local?.sessionId,
        });
      applyCartSnapshot(empty);
    };
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);
    window.addEventListener(CART_CLEARED_EVENT, onCartCleared);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
      window.removeEventListener(CART_CLEARED_EVENT, onCartCleared);
    };
  }, [enabled, applyCartSnapshot, refreshCart]);

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
      hasServerSession,
      isOpen,
      openCart,
      closeCart,
      cart,
      podContext,
      loading,
      itemCount,
      refreshCart,
      setCart,
      applyCartSnapshot,
    }),
    [
      enabled,
      hasServerSession,
      isOpen,
      openCart,
      closeCart,
      cart,
      podContext,
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
