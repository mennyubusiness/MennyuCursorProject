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
import type { ActiveCartRecovery, Cart, QuickCartApiResponse } from "@/domain/types";
import {
  CART_CLEARED_EVENT,
  CART_UPDATED_EVENT,
  dispatchCartCleared,
  dispatchCartUpdated,
  emptyCartSnapshot,
  shouldQuickCartApplyCartSnapshot,
  shouldApplyCartFetchResult,
  cartClearAppliesToContext,
  mergeAcceptedCartSnapshotMeta,
  shouldAcceptApiCartPayload,
  shouldAcceptCartSnapshot,
  rememberAcceptedCartSnapshot,
  resolveInitialVendorMenuCart,
  type CartClearedDetail,
  type CartSnapshotMeta,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";
import { getBrowsingPodIdFromClient } from "@/lib/quick-cart-pod";
import { buildCartPodContextForDisplay, quickCartHasActiveGroupOrder } from "@/lib/quick-cart-display";
import { normalizeAuthoritativeCartSnapshot, normalizeQuickCartApiCart } from "@/lib/cart-group-metadata";
import { isQuickCartEnabledForPath } from "@/lib/quick-cart-enabled";
import type { CartPodContext } from "@/lib/cart-pod-context";
import {
  shouldShowActiveRecovery,
} from "@/lib/quick-cart-active-recovery";

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
  hasActiveGroupOrder: boolean;
  hasServerSession: boolean;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  cart: Cart | null;
  podContext: CartPodContext;
  activeCartRecovery: ActiveCartRecovery | null;
  showActiveRecovery: boolean;
  loading: boolean;
  itemCount: number;
  refreshCart: () => Promise<void>;
  setCart: (cart: Cart | null) => void;
  applyCartSnapshot: (cart: Cart | null) => void;
  clearActiveSoloCart: () => Promise<void>;
  clearAndSwitchSoloCart: () => Promise<void>;
};

const QuickCartContext = createContext<QuickCartContextValue | null>(null);

export function QuickCartProvider({
  children,
  hasServerSession = false,
}: {
  children: ReactNode;
  /** @deprecated Route enablement is resolved client-side from pathname + group state. */
  enabled?: boolean;
  hasServerSession?: boolean;
}) {
  const pathname = usePathname();
  const routeQuickCartEnabled = isQuickCartEnabledForPath(pathname);
  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState<Cart | null>(null);
  const [podContext, setPodContext] = useState<CartPodContext>(NEUTRAL_POD_CONTEXT);
  const [activeCartRecovery, setActiveCartRecovery] = useState<ActiveCartRecovery | null>(null);
  const [showActiveRecovery, setShowActiveRecovery] = useState(false);
  const [loading, setLoading] = useState(false);
  const cartRef = useRef<Cart | null>(null);
  const activeCartRecoveryRef = useRef<ActiveCartRecovery | null>(null);
  const snapshotGenerationRef = useRef(0);
  const lastAcceptedMetaRef = useRef<CartSnapshotMeta | null>(null);
  const activeBrowsePodRef = useRef<string | null>(null);

  cartRef.current = cart;
  activeCartRecoveryRef.current = activeCartRecovery;

  const itemCount = useMemo(() => {
    const fromCart = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
    if (fromCart > 0) return fromCart;
    return activeCartRecovery?.itemCount ?? 0;
  }, [cart, activeCartRecovery]);

  const hasActiveGroupOrder = quickCartHasActiveGroupOrder(cart);
  const enabled = routeQuickCartEnabled || hasActiveGroupOrder;

  const applyPayload = useCallback((payload: QuickCartApiResponse) => {
    if (!shouldAcceptApiCartPayload(payload, lastAcceptedMetaRef.current)) {
      setLoading(false);
      return;
    }
    const normalizedCart = normalizeQuickCartApiCart(payload.cart, payload.scope);
    rememberAcceptedCartSnapshot(normalizedCart);
    setCart(normalizedCart);
    setPodContext(
      buildCartPodContextForDisplay({
        cart: normalizedCart,
        browsingPodId: payload.browsingPodId,
        browsingPodName: payload.browsingPodName,
        assignedPodId: payload.assignedPodId,
        assignedPodName: payload.assignedPodName,
        requiresClearToSwitchPod: payload.requiresClearToSwitchPod,
      })
    );
    setActiveCartRecovery(payload.activeCartRecovery ?? null);
    setShowActiveRecovery(
      shouldShowActiveRecovery(
        payload.activeCartRecovery,
        payload.scope,
        payload.requiresClearToSwitchPod
      )
    );
    setLoading(false);
  }, []);

  const applyCartSnapshot = useCallback((next: Cart | null, detail?: CartUpdatedDetail) => {
    snapshotGenerationRef.current += 1;
    if (detail?.clientSequence != null) {
      lastAcceptedMetaRef.current = mergeAcceptedCartSnapshotMeta(
        lastAcceptedMetaRef.current,
        detail
      );
    }
    const normalized =
      next != null ? normalizeAuthoritativeCartSnapshot(next, detail?.source) : null;
    rememberAcceptedCartSnapshot(normalized);
    setCart(normalized);
    if (!normalized) {
      setPodContext(NEUTRAL_POD_CONTEXT);
      setActiveCartRecovery(null);
      setShowActiveRecovery(false);
    } else {
      setPodContext(
        buildCartPodContextForDisplay({
          cart: normalized,
          browsingPodId: getBrowsingPodIdFromClient(),
          browsingPodName: null,
          assignedPodId:
            normalized.cartScope === "assigned_pod" || normalized.cartScope === "group_order"
              ? normalized.podId
              : null,
          assignedPodName: normalized.podName ?? null,
          requiresClearToSwitchPod: false,
        })
      );
    }
    setLoading(false);
  }, []);

  const refreshCart = useCallback(async () => {
    if (!enabled && !quickCartHasActiveGroupOrder(cartRef.current)) return;
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
        setActiveCartRecovery(null);
        setShowActiveRecovery(false);
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
        setActiveCartRecovery(null);
        setShowActiveRecovery(false);
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
    if (!routeQuickCartEnabled && !quickCartHasActiveGroupOrder(cartRef.current)) return;
    const browsePodId = getBrowsingPodIdFromClient();
    const prevPod = activeBrowsePodRef.current;
    if (prevPod && browsePodId && prevPod !== browsePodId) {
      snapshotGenerationRef.current += 1;
      setCart(null);
      setPodContext(NEUTRAL_POD_CONTEXT);
      setActiveCartRecovery(null);
      setShowActiveRecovery(false);
    }
    activeBrowsePodRef.current = browsePodId;
    void refreshCart();
  }, [routeQuickCartEnabled, pathname, refreshCart]);

  useEffect(() => {
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
        if (!shouldAcceptCartSnapshot(detail, lastAcceptedMetaRef.current)) {
          return;
        }
        if (detail.source === "group-order-ended") {
          snapshotGenerationRef.current += 1;
        }
        applyCartSnapshot(detail.cart, detail);
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
  }, [applyCartSnapshot, refreshCart]);

  const clearActiveSoloCart = useCallback(async () => {
    const recovery = activeCartRecoveryRef.current;
    if (!recovery || recovery.kind !== "solo_cart") {
      throw new Error("No solo cart to clear.");
    }
    const res = await fetch("/api/cart/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ cartId: recovery.cartId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Could not clear cart.");
    }
    dispatchCartCleared({
      cartId: recovery.cartId,
      podId: recovery.podId,
      source: "quick-cart",
    });
    await refreshCart();
  }, [refreshCart]);

  const clearAndSwitchSoloCart = useCallback(async () => {
    const recovery = activeCartRecoveryRef.current;
    if (!recovery || recovery.kind !== "solo_cart") {
      throw new Error("Only solo carts can be cleared to switch pods.");
    }
    const res = await fetch("/api/cart/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ cartId: recovery.cartId, switchPod: true }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Could not clear cart.");
    }
    dispatchCartCleared({
      cartId: recovery.cartId,
      podId: recovery.podId,
      source: "quick-cart",
    });
    await refreshCart();
  }, [refreshCart]);

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
      hasActiveGroupOrder,
      hasServerSession,
      isOpen,
      openCart,
      closeCart,
      cart,
      podContext,
      activeCartRecovery,
      showActiveRecovery,
      loading,
      itemCount,
      refreshCart,
      setCart,
      applyCartSnapshot,
      clearActiveSoloCart,
      clearAndSwitchSoloCart,
    }),
    [
      enabled,
      hasActiveGroupOrder,
      hasServerSession,
      isOpen,
      openCart,
      closeCart,
      cart,
      podContext,
      activeCartRecovery,
      showActiveRecovery,
      loading,
      itemCount,
      refreshCart,
      applyCartSnapshot,
      clearActiveSoloCart,
      clearAndSwitchSoloCart,
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
