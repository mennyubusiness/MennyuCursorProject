"use client";

import {
  CartPageSummaryCheckoutActions,
  cartPageLiveItemCount,
} from "./cart-page-checkout-actions";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { revalidateCartPageAction } from "@/actions/cart-validation.actions";
import type { Cart } from "@/domain/types";
import {
  CART_UPDATED_EVENT,
  buildCartSnapshotMeta,
  cartSnapshotAppliesToContext,
  mergeAcceptedCartSnapshotMeta,
  shouldAcceptApiCartPayload,
  shouldAcceptCartSnapshot,
  shouldApplyCartSnapshot,
  type CartSnapshotMeta,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";
import {
  flushCartMutations,
  hasPendingCartMutations,
  subscribeCartMutationPending,
} from "@/lib/cart-mutation-queue";
import {
  buildErrorByCartItemId,
  cartMutationFingerprint,
  deriveCartPageCheckoutState,
  pruneValidationForCart,
  type CartPageValidationSnapshot,
} from "@/lib/cart-page-validation";
import { buildCartValidationVendorGroups } from "@/lib/cart-validation-vendor-groups";

type CartPageMutationContextValue = {
  cart: Cart;
  liveValidation: CartPageValidationSnapshot;
  cartId: string;
  podId: string;
  podSlug: string;
  itemById: (cartItemId: string) => Cart["items"][number] | undefined;
  vendorSubtotalCents: (vendorId: string) => number;
  vendorLineCount: (vendorId: string) => number;
  lineErrorMessage: (cartItemId: string) => string | undefined;
  lineHasError: (cartItemId: string) => boolean;
  canCheckout: boolean;
  showValidationWarning: boolean;
  isRevalidating: boolean;
  isSyncingCart: boolean;
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
  podSlug,
  initialCart,
  initialValidation,
  allowCheckout = true,
  children,
}: {
  cartId: string;
  podId: string;
  podSlug: string;
  initialCart: Cart;
  initialValidation: CartPageValidationSnapshot;
  allowCheckout?: boolean;
  children: ReactNode;
}) {
  const [cart, setCart] = useState(initialCart);
  const [serverValidation, setServerValidation] = useState(initialValidation);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isSyncingCart, setIsSyncingCart] = useState(
    () => hasPendingCartMutations(cartId)
  );
  const revalidateSeqRef = useRef(0);
  const lastAcceptedSnapshotMetaRef = useRef<CartSnapshotMeta | null>(
    buildCartSnapshotMeta({
      cart: initialCart,
      clientSequence: 0,
    })
  );
  const skipRevalidateForFingerprintRef = useRef(
    cartMutationFingerprint(initialCart.items)
  );

  useEffect(() => {
    setCart(initialCart);
    setServerValidation(initialValidation);
    skipRevalidateForFingerprintRef.current = cartMutationFingerprint(initialCart.items);
    lastAcceptedSnapshotMetaRef.current = buildCartSnapshotMeta({
      cart: initialCart,
      clientSequence: lastAcceptedSnapshotMetaRef.current?.clientSequence ?? 0,
    });
  }, [initialCart, initialValidation]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<CartUpdatedDetail>).detail;
      if (!shouldApplyCartSnapshot(detail, "cart-page", { cartId, podId })) return;
      if (!shouldAcceptCartSnapshot(detail, lastAcceptedSnapshotMetaRef.current)) return;
      if (!detail?.cart) return;
      lastAcceptedSnapshotMetaRef.current = mergeAcceptedCartSnapshotMeta(
        lastAcceptedSnapshotMetaRef.current,
        detail
      );
      setCart(detail.cart);
      skipRevalidateForFingerprintRef.current = cartMutationFingerprint(detail.cart.items);
    };
    window.addEventListener(CART_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onUpdate);
  }, [cartId, podId]);

  useEffect(() => {
    return subscribeCartMutationPending(() => {
      setIsSyncingCart(hasPendingCartMutations(cartId));
    });
  }, [cartId]);

  useEffect(() => {
    let cancelled = false;
    setIsSyncingCart(hasPendingCartMutations(cartId));
    void flushCartMutations(cartId).then(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/cart?cartId=${encodeURIComponent(cartId)}`, {
          credentials: "same-origin",
        });
        if (!res.ok || cancelled) return;
        const fresh = (await res.json()) as Cart;
        if (!cartSnapshotAppliesToContext(fresh, { cartId, podId })) return;
        if (!shouldAcceptApiCartPayload({ cart: fresh }, lastAcceptedSnapshotMetaRef.current)) {
          return;
        }
        setCart(fresh);
        skipRevalidateForFingerprintRef.current = cartMutationFingerprint(fresh.items);
        lastAcceptedSnapshotMetaRef.current = mergeAcceptedCartSnapshotMeta(
          lastAcceptedSnapshotMetaRef.current,
          {
            cart: fresh,
            clientSequence: (lastAcceptedSnapshotMetaRef.current?.clientSequence ?? 0) + 1,
          }
        );
      } catch {
        /* keep SSR cart */
      } finally {
        if (!cancelled) setIsSyncingCart(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [cartId, podId]);

  const cartFingerprint = useMemo(() => cartMutationFingerprint(cart.items), [cart.items]);

  useEffect(() => {
    if (cartFingerprint === skipRevalidateForFingerprintRef.current) return;

    const seq = ++revalidateSeqRef.current;

    if (cart.items.length === 0) {
      setServerValidation({ valid: true, errors: [] });
      setIsRevalidating(false);
      skipRevalidateForFingerprintRef.current = cartFingerprint;
      return;
    }

    setIsRevalidating(true);
    void revalidateCartPageAction(cartId)
      .then((result) => {
        if (seq !== revalidateSeqRef.current) return;
        setServerValidation(result);
        skipRevalidateForFingerprintRef.current = cartFingerprint;
      })
      .catch(() => {
        if (seq !== revalidateSeqRef.current) return;
        setServerValidation({
          valid: false,
          errors: [
            {
              code: "REVALIDATION_FAILED",
              message: "Could not verify your cart. Refresh the page and try again.",
            },
          ],
        });
      })
      .finally(() => {
        if (seq === revalidateSeqRef.current) {
          skipRevalidateForFingerprintRef.current = cartFingerprint;
          setIsRevalidating(false);
        }
      });
  }, [cartFingerprint, cartId, cart.items.length]);

  const liveValidation = useMemo(
    () => pruneValidationForCart(serverValidation, cart.items),
    [serverValidation, cart.items]
  );

  const checkoutState = useMemo(
    () =>
      deriveCartPageCheckoutState({
        cartItemCount: cart.items.length,
        validation: liveValidation,
      }),
    [cart.items.length, liveValidation]
  );

  const errorByCartItemId = useMemo(
    () => buildErrorByCartItemId(liveValidation.errors, cart.items),
    [liveValidation.errors, cart.items]
  );

  const value = useMemo<CartPageMutationContextValue>(() => {
    const itemById = (cartItemId: string) => cart.items.find((i) => i.id === cartItemId);
    return {
      cart,
      liveValidation,
      cartId,
      podId,
      podSlug,
      itemById,
      vendorSubtotalCents: (vendorId: string) =>
        cart.items
          .filter((i) => i.vendorId === vendorId)
          .reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
      vendorLineCount: (vendorId: string) =>
        cart.items.filter((i) => i.vendorId === vendorId).length,
      lineErrorMessage: (cartItemId: string) => errorByCartItemId.get(cartItemId),
      lineHasError: (cartItemId: string) => errorByCartItemId.has(cartItemId),
      canCheckout: checkoutState.canCheckout && allowCheckout,
      showValidationWarning: checkoutState.showWarning,
      isRevalidating,
      isSyncingCart,
    };
  }, [cart, liveValidation, cartId, podId, podSlug, errorByCartItemId, checkoutState, isRevalidating, isSyncingCart, allowCheckout]);

  return (
    <CartPageMutationContext.Provider value={value}>{children}</CartPageMutationContext.Provider>
  );
}

export function CartPageLiveSyncBanner() {
  const { isSyncingCart } = useCartPageMutation();
  if (!isSyncingCart) return null;
  return (
    <p className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700" role="status">
      Syncing your cart…
    </p>
  );
}

export function CartPageLiveValidationBanner() {
  const { showValidationWarning, cart, liveValidation } = useCartPageMutation();
  const vendorGroups = useMemo(
    () =>
      showValidationWarning
        ? buildCartValidationVendorGroups(cart, liveValidation.errors)
        : [],
    [showValidationWarning, cart, liveValidation.errors]
  );

  if (!showValidationWarning) return null;

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
      <p className="font-semibold">Some items need attention before checkout</p>
      <p className="mt-1 text-amber-900/90">
        Update or remove highlighted lines below, then continue.
      </p>
      {vendorGroups.length > 0 && (
        <ul className="mt-3 space-y-3">
          {vendorGroups.map((group) => (
            <li key={group.vendorId}>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-950/80">
                {group.vendorName}
              </p>
              <ul className="mt-1 space-y-1">
                {group.issues.map((issue) => (
                  <li key={issue.cartItemId} className="text-sm">
                    <span className="font-medium">{issue.itemName}</span>
                    <span className="text-amber-900/90"> — {issue.message}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CartPageLiveLineShell({
  cartItemId,
  children,
}: {
  cartItemId: string;
  children: ReactNode;
}) {
  const { lineHasError } = useCartPageMutation();
  return (
    <li
      className={`flex gap-3 px-4 py-4 sm:px-5 ${lineHasError(cartItemId) ? "bg-amber-50/50" : ""}`}
    >
      {children}
    </li>
  );
}

export function CartPageLiveLineError({ cartItemId }: { cartItemId: string }) {
  const { lineErrorMessage } = useCartPageMutation();
  const message = lineErrorMessage(cartItemId);
  if (!message) return null;
  return <p className="mt-2 text-sm font-medium text-amber-900">{message}</p>;
}

export function CartPageLiveEmptyNotice({ hideWhenGroupActive = false }: { hideWhenGroupActive?: boolean }) {
  const { cart } = useCartPageMutation();
  if (hideWhenGroupActive) return null;
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

export function CartPageLiveCheckoutGate({
  children,
  serverItemCount = 0,
}: {
  children: ReactNode;
  serverItemCount?: number;
}) {
  const { cart } = useCartPageMutation();
  const liveItemCount = cartPageLiveItemCount(cart);
  const hasItems = liveItemCount > 0 || serverItemCount > 0;
  if (!hasItems) return null;
  return <>{children}</>;
}

export function CartPageLiveCheckoutActions({
  viewerCanCheckout,
  showParticipantTotalsOnly,
  sessionLockedCheckout = false,
  myParticipantSubtotalCents,
  totalCentsFallback,
  groupSubmitted = false,
  submittedOrderId = null,
}: {
  viewerCanCheckout: boolean;
  showParticipantTotalsOnly: boolean;
  sessionLockedCheckout?: boolean;
  myParticipantSubtotalCents?: number;
  totalCentsFallback: number;
  groupSubmitted?: boolean;
  submittedOrderId?: string | null;
}) {
  const {
    cartId,
    podId,
    podSlug,
    cart,
    canCheckout,
    isRevalidating,
    isSyncingCart,
  } = useCartPageMutation();

  return (
    <CartPageSummaryCheckoutActions
      cartId={cartId}
      podId={podId}
      podSlug={podSlug}
      cart={cart}
      canCheckout={canCheckout}
      isRevalidating={isRevalidating}
      isSyncingCart={isSyncingCart}
      viewerCanCheckout={viewerCanCheckout}
      showParticipantTotalsOnly={showParticipantTotalsOnly}
      sessionLockedCheckout={sessionLockedCheckout}
      myParticipantSubtotalCents={myParticipantSubtotalCents}
      totalCentsFallback={totalCentsFallback}
      groupSubmitted={groupSubmitted}
      submittedOrderId={submittedOrderId}
    />
  );
}
