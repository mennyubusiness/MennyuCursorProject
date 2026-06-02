"use client";

import Link from "next/link";
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
  cartSnapshotAppliesToContext,
  type CartUpdatedDetail,
} from "@/lib/cart-client-sync";
import {
  buildErrorByCartItemId,
  cartMutationFingerprint,
  deriveCartPageCheckoutState,
  pruneValidationForCart,
  type CartPageValidationSnapshot,
} from "@/lib/cart-page-validation";

type CartPageMutationContextValue = {
  cart: Cart;
  cartId: string;
  podId: string;
  itemById: (cartItemId: string) => Cart["items"][number] | undefined;
  vendorSubtotalCents: (vendorId: string) => number;
  vendorLineCount: (vendorId: string) => number;
  lineErrorMessage: (cartItemId: string) => string | undefined;
  lineHasError: (cartItemId: string) => boolean;
  canCheckout: boolean;
  showValidationWarning: boolean;
  isRevalidating: boolean;
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
  initialCart,
  initialValidation,
  children,
}: {
  cartId: string;
  podId: string;
  initialCart: Cart;
  initialValidation: CartPageValidationSnapshot;
  children: ReactNode;
}) {
  const [cart, setCart] = useState(initialCart);
  const [serverValidation, setServerValidation] = useState(initialValidation);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const revalidateSeqRef = useRef(0);
  const skipRevalidateForFingerprintRef = useRef(
    cartMutationFingerprint(initialCart.items)
  );

  useEffect(() => {
    setCart(initialCart);
    setServerValidation(initialValidation);
    skipRevalidateForFingerprintRef.current = cartMutationFingerprint(initialCart.items);
  }, [initialCart, initialValidation]);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<CartUpdatedDetail>).detail;
      if (detail?.source !== "cart-page") return;
      if (!detail.cart || !cartSnapshotAppliesToContext(detail.cart, { cartId, podId })) return;
      setCart(detail.cart);
    };
    window.addEventListener(CART_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(CART_UPDATED_EVENT, onUpdate);
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
    () =>
      pruneValidationForCart(serverValidation, cart.items),
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
      cartId,
      podId,
      itemById,
      vendorSubtotalCents: (vendorId: string) =>
        cart.items
          .filter((i) => i.vendorId === vendorId)
          .reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
      vendorLineCount: (vendorId: string) =>
        cart.items.filter((i) => i.vendorId === vendorId).length,
      lineErrorMessage: (cartItemId: string) => errorByCartItemId.get(cartItemId),
      lineHasError: (cartItemId: string) => errorByCartItemId.has(cartItemId),
      canCheckout: checkoutState.canCheckout,
      showValidationWarning: checkoutState.showWarning,
      isRevalidating,
    };
  }, [cart, cartId, podId, errorByCartItemId, checkoutState, isRevalidating]);

  return (
    <CartPageMutationContext.Provider value={value}>{children}</CartPageMutationContext.Provider>
  );
}

export function CartPageLiveValidationBanner() {
  const { showValidationWarning } = useCartPageMutation();
  if (!showValidationWarning) return null;
  return (
    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
      <span className="font-medium">Some items can&apos;t be ordered as shown.</span> Update or remove
      highlighted lines, then continue.
    </p>
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

export function CartPageLiveEmptyNotice() {
  const { cart } = useCartPageMutation();
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

export function CartPageLiveCheckoutGate({ children }: { children: ReactNode }) {
  const { cart } = useCartPageMutation();
  if (cart.items.length === 0) return null;
  return children;
}

export function CartPageLiveCheckoutActions({
  showParticipantTotalsOnly,
  myParticipantSubtotalCents,
  totalCentsFallback,
}: {
  showParticipantTotalsOnly: boolean;
  myParticipantSubtotalCents?: number;
  totalCentsFallback: number;
}) {
  const { cartId, canCheckout, isRevalidating } = useCartPageMutation();
  const checkoutEnabled = canCheckout && !isRevalidating;
  const blockedLabel =
    !canCheckout && isRevalidating ? "Checking cart…" : "Fix items above to continue";

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
      {checkoutEnabled && !showParticipantTotalsOnly && (
        <p className="text-center text-xs leading-snug text-stone-500 sm:text-right">
          Secure checkout with Stripe · Each vendor is notified after you pay
        </p>
      )}
      {showParticipantTotalsOnly ? (
        <div className="w-full text-center sm:text-right">
          {!checkoutEnabled ? (
            <p className="text-xs text-amber-900">
              Some items need attention before checkout — only the host can complete fixes for the whole
              group.
            </p>
          ) : (
            <>
              <p className="text-xs text-stone-500">
                The host completes payment for the full order — you won&apos;t be charged here.
              </p>
              <span
                className="mt-2 inline-flex min-h-[48px] w-full cursor-not-allowed items-center justify-center rounded-xl bg-stone-200 px-8 py-3.5 text-center text-base font-semibold text-stone-600 sm:min-w-[14rem] sm:w-auto"
                aria-disabled
              >
                Host checks out
              </span>
            </>
          )}
        </div>
      ) : checkoutEnabled ? (
        <Link
          href={`/checkout?cartId=${cartId}`}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-stone-900 px-8 py-3.5 text-center text-base font-bold text-white shadow-md transition duration-200 hover:bg-stone-800 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 active:scale-[0.98] sm:min-w-[14rem] sm:w-auto"
        >
          Continue to checkout
        </Link>
      ) : (
        <span
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-stone-200 px-8 py-3.5 text-center text-base font-semibold text-stone-500 sm:w-auto"
          aria-disabled
        >
          {blockedLabel}
        </span>
      )}
    </div>
  );
}
