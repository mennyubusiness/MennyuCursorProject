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
  shouldQuickCartApplyCartSnapshot,
  shouldApplyCartFetchResult,
  cartClearAppliesToContext,
  mergeAcceptedCartSnapshotMeta,
  shouldAcceptApiCartPayload,
  shouldAcceptCartSnapshot,
  rememberAcceptedCartSnapshot,
  enrichCartUpdatedDetail,
  resolveInitialVendorMenuCart,
  type CartClearedDetail,
  type CartSnapshotMeta,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";
import { cartSnapshotItemCount } from "@/lib/cart-snapshot-freshness";
import { getBrowsingPodIdFromClient, resolveQuickCartBrowsePod } from "@/lib/quick-cart-pod";
import { buildCartPodContextForDisplay, buildBrowsingPodOnlyContext, quickCartHasActiveGroupOrder, resolveQuickCartSnapshotAfterUpdate } from "@/lib/quick-cart-display";
import { normalizeAuthoritativeCartSnapshot, normalizeQuickCartApiCart } from "@/lib/cart-group-metadata";
import { isQuickCartEnabledForPath } from "@/lib/quick-cart-enabled";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { CartPodContext } from "@/lib/cart-pod-context";
import {
  isActiveCartRecoveryDisplayable,
  shouldShowActiveRecovery,
} from "@/lib/quick-cart-active-recovery";
import { useCurrentPagePod } from "@/components/pod/CurrentPagePodProvider";
import { hasAnyPendingCartWork } from "@/lib/cart-sync-scheduler";

const NEUTRAL_POD_CONTEXT: CartPodContext = {
  cartScope: "neutral",
  cartPodId: null,
  cartPodName: null,
  cartPodSlug: null,
  browsingPodId: null,
  browsingPodName: null,
  browsingPodSlug: null,
  assignedPodId: null,
  assignedPodSlug: null,
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
  getCartSnapshot: () => Cart | null;
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
  const currentPagePod = useCurrentPagePod();
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

  const prevHasServerSessionRef = useRef(hasServerSession);

  cartRef.current = cart;
  activeCartRecoveryRef.current = activeCartRecovery;

  const itemCount = useMemo(() => {
    if (cart) {
      return cart.items.reduce((n, i) => n + i.quantity, 0);
    }
    return activeCartRecovery?.itemCount ?? 0;
  }, [cart, activeCartRecovery]);

  const hasActiveGroupOrder = quickCartHasActiveGroupOrder(cart);
  const enabled = routeQuickCartEnabled || hasActiveGroupOrder;

  const resolveBrowsePod = useCallback(
    () => resolveQuickCartBrowsePod(currentPagePod),
    [currentPagePod]
  );

  const mergePayloadBrowsingPod = useCallback(
    (payload: QuickCartApiResponse): QuickCartApiResponse => {
      const pageBrowse = resolveBrowsePod();
      if (!pageBrowse.id) return payload;
      return {
        ...payload,
        browsingPodId: payload.browsingPodId ?? pageBrowse.id,
        browsingPodName: payload.browsingPodName ?? pageBrowse.name,
        browsingPodSlug: payload.browsingPodSlug ?? pageBrowse.slug,
        scope:
          payload.scope === "neutral" && !payload.cart && !payload.requiresClearToSwitchPod
            ? "browsing_pod"
            : payload.scope,
      };
    },
    [resolveBrowsePod]
  );

  const applyPayload = useCallback((payload: QuickCartApiResponse) => {
    const mergedPayload = mergePayloadBrowsingPod(payload);
    if (!shouldAcceptApiCartPayload(mergedPayload, lastAcceptedMetaRef.current)) {
      setLoading(false);
      return;
    }
    const normalizedCart =
      mergedPayload.cart != null
        ? normalizeQuickCartApiCart(mergedPayload.cart, mergedPayload.scope)
        : null;
    const displayCart = resolveQuickCartSnapshotAfterUpdate(normalizedCart);
    const recovery = isActiveCartRecoveryDisplayable(mergedPayload.activeCartRecovery)
      ? mergedPayload.activeCartRecovery
      : null;
    const normalizedRecovery = recovery ?? null;
    rememberAcceptedCartSnapshot(displayCart);
    cartRef.current = displayCart;
    setCart(displayCart);
    setPodContext(
      buildCartPodContextForDisplay({
        cart: displayCart,
        browsingPodId: mergedPayload.browsingPodId,
        browsingPodName: mergedPayload.browsingPodName,
        browsingPodSlug: mergedPayload.browsingPodSlug,
        assignedPodId: mergedPayload.assignedPodId,
        assignedPodName: mergedPayload.assignedPodName,
        assignedPodSlug: mergedPayload.assignedPodSlug,
        requiresClearToSwitchPod: mergedPayload.requiresClearToSwitchPod,
      })
    );
    setActiveCartRecovery(normalizedRecovery);
    setShowActiveRecovery(
      shouldShowActiveRecovery(
        normalizedRecovery,
        mergedPayload.scope,
        mergedPayload.requiresClearToSwitchPod
      )
    );
    setLoading(false);
  }, [mergePayloadBrowsingPod]);

  const applyCartSnapshot = useCallback((next: Cart | null, detail?: CartUpdatedDetail) => {
    snapshotGenerationRef.current += 1;
    if (detail?.clientSequence != null) {
      lastAcceptedMetaRef.current = mergeAcceptedCartSnapshotMeta(
        lastAcceptedMetaRef.current,
        detail
      );
    } else if (next) {
      lastAcceptedMetaRef.current = mergeAcceptedCartSnapshotMeta(
        lastAcceptedMetaRef.current,
        enrichCartUpdatedDetail({ cart: next, source: "quick-cart" })
      );
    }

    if (next === null) {
      rememberAcceptedCartSnapshot(null);
      cartRef.current = null;
      setCart(null);
      const pageBrowse = resolveBrowsePod();
      setPodContext(
        pageBrowse.id
          ? buildBrowsingPodOnlyContext(pageBrowse)
          : NEUTRAL_POD_CONTEXT
      );
      setActiveCartRecovery(null);
      setShowActiveRecovery(false);
      setIsOpen(false);
      setLoading(false);
      return;
    }

    const normalized = normalizeAuthoritativeCartSnapshot(next, detail?.source);
    const displayCart = resolveQuickCartSnapshotAfterUpdate(normalized);
    rememberAcceptedCartSnapshot(displayCart);
    cartRef.current = displayCart;
    setCart(displayCart);
    if (!displayCart) {
      const pageBrowse = resolveBrowsePod();
      setPodContext(
        pageBrowse.id
          ? buildBrowsingPodOnlyContext(pageBrowse)
          : NEUTRAL_POD_CONTEXT
      );
      setActiveCartRecovery(null);
      setShowActiveRecovery(false);
    } else {
      const pageBrowse = resolveBrowsePod();
      setPodContext(
        buildCartPodContextForDisplay({
          cart: displayCart,
          browsingPodId: pageBrowse.id ?? getBrowsingPodIdFromClient(currentPagePod),
          browsingPodName: pageBrowse.name ?? displayCart.podName ?? null,
          browsingPodSlug: pageBrowse.slug ?? displayCart.podSlug ?? null,
          assignedPodId:
            displayCart.cartScope === "assigned_pod" || displayCart.cartScope === "group_order"
              ? displayCart.podId
              : null,
          assignedPodName: displayCart.podName ?? null,
          assignedPodSlug: displayCart.podSlug ?? null,
          requiresClearToSwitchPod: false,
        })
      );
    }
    setLoading(false);
  }, [currentPagePod, resolveBrowsePod]);

  const refreshCart = useCallback(async () => {
    if (!enabled && !quickCartHasActiveGroupOrder(cartRef.current)) return;
    const browsePod = resolveBrowsePod();
    const browsePodId = browsePod.id;
    const generationAtStart = snapshotGenerationRef.current;
    const podAtStart = browsePodId;
    const cartIdAtStart = cartRef.current?.id ?? null;
    // Never overwrite optimistic lines with a lagging GET while sync is in flight.
    if (hasAnyPendingCartWork(cartIdAtStart)) {
      setLoading(false);
      return;
    }
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
          currentPodId: resolveBrowsePod().id,
        })
      ) {
        return;
      }
      if (hasAnyPendingCartWork(cartIdAtStart ?? cartRef.current?.id)) {
        return;
      }
      if (!res.ok) {
        // Do not clear a locally-filled cart on a failed background refresh.
        if (cartRef.current && cartSnapshotItemCount(cartRef.current) > 0) {
          return;
        }
        setCart(null);
        setPodContext(
          browsePod.id ? buildBrowsingPodOnlyContext(browsePod) : NEUTRAL_POD_CONTEXT
        );
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
          currentPodId: resolveBrowsePod().id,
        })
      ) {
        return;
      }
      if (hasAnyPendingCartWork(cartIdAtStart ?? cartRef.current?.id)) {
        return;
      }
      applyPayload(data);
    } catch {
      if (
        shouldApplyCartFetchResult({
          generationAtStart,
          currentGeneration: snapshotGenerationRef.current,
          podAtStart,
          currentPodId: resolveBrowsePod().id,
        }) &&
        !(cartRef.current && cartSnapshotItemCount(cartRef.current) > 0)
      ) {
        setCart(null);
        setPodContext(
          browsePod.id ? buildBrowsingPodOnlyContext(browsePod) : NEUTRAL_POD_CONTEXT
        );
        setActiveCartRecovery(null);
        setShowActiveRecovery(false);
      }
    } finally {
      if (
        shouldApplyCartFetchResult({
          generationAtStart,
          currentGeneration: snapshotGenerationRef.current,
          podAtStart,
          currentPodId: resolveBrowsePod().id,
        })
      ) {
        setLoading(false);
      }
    }
  }, [enabled, applyPayload, resolveBrowsePod]);

  const openCart = useCallback(() => {
    if (!enabled) return;
    setIsOpen(true);
    void refreshCart();
  }, [enabled, refreshCart]);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (prevHasServerSessionRef.current === hasServerSession) return;
    prevHasServerSessionRef.current = hasServerSession;
    snapshotGenerationRef.current += 1;
    lastAcceptedMetaRef.current = null;
    setCart(null);
    const pageBrowse = resolveBrowsePod();
    setPodContext(
      pageBrowse.id ? buildBrowsingPodOnlyContext(pageBrowse) : NEUTRAL_POD_CONTEXT
    );
    setActiveCartRecovery(null);
    setShowActiveRecovery(false);
    void refreshCart();
  }, [hasServerSession, refreshCart, resolveBrowsePod]);

  useEffect(() => {
    if (!routeQuickCartEnabled && !quickCartHasActiveGroupOrder(cartRef.current)) return;
    const browsePod = resolveBrowsePod();
    const browsePodId = browsePod.id;
    const prevPod = activeBrowsePodRef.current;
    if (prevPod && browsePodId && prevPod !== browsePodId) {
      snapshotGenerationRef.current += 1;
      setCart(null);
      setPodContext(buildBrowsingPodOnlyContext(browsePod));
      setActiveCartRecovery(null);
      setShowActiveRecovery(false);
    } else if (browsePodId && !prevPod) {
      setPodContext((prev) =>
        prev.browsingPodId
          ? prev
          : buildBrowsingPodOnlyContext(browsePod)
      );
    }
    activeBrowsePodRef.current = browsePodId;
    void refreshCart();
  }, [routeQuickCartEnabled, pathname, refreshCart, currentPagePod, resolveBrowsePod]);

  useEffect(() => {
    const onCartUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CartUpdatedDetail>).detail;
      if (detail?.cart !== undefined) {
        if (
          !shouldQuickCartApplyCartSnapshot(
            detail,
            cartRef.current,
            getBrowsingPodIdFromClient(currentPagePod)
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
      const ctx = {
        cartId: local?.id ?? detail?.cartId ?? "",
        podId: detail?.podId ?? local?.podId ?? getBrowsingPodIdFromClient(currentPagePod) ?? "",
      };
      if (!detail?.podId || !cartClearAppliesToContext(detail, ctx)) return;
      applyCartSnapshot(null);
    };
    window.addEventListener(CART_UPDATED_EVENT, onCartUpdated);
    window.addEventListener(CART_CLEARED_EVENT, onCartCleared);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, onCartUpdated);
      window.removeEventListener(CART_CLEARED_EVENT, onCartCleared);
    };
  }, [applyCartSnapshot, refreshCart, currentPagePod]);

  const getCartSnapshot = useCallback(() => cartRef.current, []);

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
    setIsOpen(false);
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
    setIsOpen(false);
    await refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closeCart]);

  useBodyScrollLock(isOpen);

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
      getCartSnapshot,
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
      getCartSnapshot,
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
  const resolved = resolveQuickCartSnapshotAfterUpdate(cart);
  dispatchCartUpdated({ cart: resolved, source: "quick-cart" });
  return resolved;
}
