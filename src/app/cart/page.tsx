import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentPodIdFromHeaders, getCustomerPhoneFromHeaders } from "@/lib/session";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";
import { discardStaleCheckoutCartsForSession, loadActiveDisplayCartForSession } from "@/services/cart.service";
import { getActiveOrderByCustomerPhone, validateCartItemsForDisplay, getCartValidationMessage } from "@/services/order.service";
import type { CartForValidation } from "@/services/order.service";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { serializeModifierConfig } from "@/lib/modifier-config";
import {
  getShellBasePriceCentsByVendorParentPlu,
  shellBasePriceKey,
} from "@/services/cart-deliverect-variant-resolution";
import { CartItemActions } from "./CartItemActions";
import { CheckoutProgress } from "../checkout/CheckoutProgress";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ reorder_skipped?: string; reorder_added?: string; error?: string }>;
}) {
  const headersList = await headers();
  const customerPhone = getCustomerPhoneFromHeaders(headersList);
  const activeOrder = customerPhone ? await getActiveOrderByCustomerPhone(customerPhone) : null;
  if (activeOrder) {
    redirect(`/order/${activeOrder.id}?from=cart`);
  }

  /** Align with getOrCreateCartAction: prefer cookies() then header fallback (same as cart writes). */
  const sessionId = (await getMennyuSessionIdForRequest()) ?? "__no_session__";
  if (sessionId !== "__no_session__") {
    await discardStaleCheckoutCartsForSession(sessionId);
  }
  const currentPodId = getCurrentPodIdFromHeaders(headersList);
  const params = await searchParams;
  const reorderSkipped = params.reorder_skipped ? parseInt(params.reorder_skipped, 10) : 0;
  const reorderAdded = params.reorder_added ? parseInt(params.reorder_added, 10) : 0;
  const checkoutErrorCode = params.error ? decodeURIComponent(params.error) : null;
  const cart = await loadActiveDisplayCartForSession(sessionId, currentPodId);
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-2 py-12">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-xs font-medium text-stone-400"
            aria-hidden
          >
            Cart
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-stone-900">Your cart is empty</h1>
          <p className="mt-3 text-stone-600">
            Choose a pod, then add items from one or more vendors. Everything stays in one cart with a
            single checkout.
          </p>
          <Link
            href="/explore"
            className="mt-8 inline-flex rounded-xl bg-mennyu-primary px-6 py-3 font-semibold text-black hover:bg-mennyu-secondary"
          >
            Browse pods
          </Link>
          <p className="mt-6 text-sm text-stone-500">
            Already ordered?{" "}
            <Link href="/orders" className="font-medium text-mennyu-primary hover:underline">
              View your orders
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const byVendor = new Map<
    string,
    { name: string; items: typeof cart.items; subtotalCents: number }
  >();
  for (const item of cart.items) {
    const sub = item.priceCents * item.quantity;
    const existing = byVendor.get(item.vendorId);
    if (existing) {
      existing.items.push(item);
      existing.subtotalCents += sub;
    } else {
      byVendor.set(item.vendorId, {
        name: item.vendor.name,
        items: [item],
        subtotalCents: sub,
      });
    }
  }
  const totalCents = Array.from(byVendor.values()).reduce((a, v) => a + v.subtotalCents, 0);
  const vendorCount = byVendor.size;

  const shellBaseByVendorParentPlu = await getShellBasePriceCentsByVendorParentPlu(cart.items);

  const cartForValidation: CartForValidation = {
    podId: cart.podId,
    items: cart.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      vendorId: i.vendorId,
      quantity: i.quantity,
      priceCents: i.priceCents,
      menuItem: {
        priceCents: i.menuItem.priceCents,
        isAvailable: i.menuItem.isAvailable,
        name: i.menuItem.name,
        basketMaxQuantity: i.menuItem.basketMaxQuantity ?? null,
        deliverectProductId: i.menuItem.deliverectProductId ?? null,
        deliverectPlu: i.menuItem.deliverectPlu ?? null,
        deliverectVariantParentPlu: i.menuItem.deliverectVariantParentPlu ?? null,
      },
      vendor: {
        isActive: i.vendor.isActive,
        mennyuOrdersPaused: i.vendor.mennyuOrdersPaused ?? undefined,
        posOpen: undefined,
      },
      selections: i.selections?.map((s) => ({
        modifierOptionId: s.modifierOptionId,
        quantity: s.quantity,
        modifierOption: s.modifierOption ? { priceCents: s.modifierOption.priceCents } : undefined,
      })),
    })),
  };
  const { valid: cartValid, errors: validationErrors } = await validateCartItemsForDisplay(cartForValidation);
  const errorByCartItemId = new Map<string, string>();
  for (const e of validationErrors) {
    if (e.cartItemId) {
      errorByCartItemId.set(e.cartItemId, e.message);
    } else if (e.menuItemId) {
      for (const item of cart.items) {
        if (item.menuItemId === e.menuItemId) errorByCartItemId.set(item.id, e.message);
      }
    }
  }
  const canCheckout = cartValid;

  return (
    <div className="mx-auto max-w-2xl">
      <CheckoutProgress activeStep={1} />
      <header className="border-b border-stone-200 pb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Your cart</h1>
        <p className="mt-2 text-stone-600">
          <span className="font-medium text-stone-800">{cart.pod.name}</span>
          {vendorCount > 1 && (
            <span className="text-stone-500"> · {vendorCount} vendors</span>
          )}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Vendors are notified only after your payment succeeds.
        </p>
      </header>

      {checkoutErrorCode && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          {getCartValidationMessage(checkoutErrorCode)} Update or remove items below, then try again.
        </p>
      )}
      {!cartValid && validationErrors.length > 0 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <span className="font-medium">Some items can&apos;t be ordered as shown.</span> Update or
          remove highlighted lines, then continue.
        </p>
      )}
      {reorderSkipped > 0 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {reorderAdded > 0 && `${reorderAdded} item(s) from your previous order were added. `}
          {reorderSkipped} item(s) could not be added (no longer available).
        </p>
      )}

      <div className="mt-8 space-y-8">
        {Array.from(byVendor.entries()).map(([vendorId, group]) => (
          <section
            key={vendorId}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
            aria-labelledby={`vendor-${vendorId}-heading`}
          >
            <div className="border-b border-stone-100 bg-stone-50/90 px-4 py-4 sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Vendor</p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`vendor-${vendorId}-heading`} className="text-lg font-semibold text-stone-900">
                  {group.name}
                </h2>
                <Link
                  href={`/pod/${cart.podId}/vendor/${vendorId}`}
                  className="text-sm font-medium text-mennyu-primary hover:underline"
                >
                  Add more from this vendor
                </Link>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {group.items.length} line{group.items.length !== 1 ? "s" : ""} in this group
              </p>
            </div>
            <ul className="divide-y divide-stone-100">
              {group.items.map((item) => {
                const itemError = errorByCartItemId.get(item.id);
                const modLines =
                  item.selections
                    ?.map((s) => ({
                      key: s.modifierOptionId,
                      label:
                        s.quantity > 1
                          ? `${s.modifierOption.name} ×${s.quantity}`
                          : s.modifierOption.name,
                    }))
                    .filter((m) => Boolean(m.label)) ?? [];
                return (
                  <li
                    key={item.id}
                    className={`flex gap-3 px-4 py-4 sm:px-5 ${itemError ? "bg-amber-50/50" : ""}`}
                  >
                    <MenuItemImage
                      imageUrl={item.menuItem.imageUrl}
                      itemName={item.menuItem.name}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-900">
                          {item.menuItem.name}
                          <span className="ml-2 font-normal text-stone-500">× {item.quantity}</span>
                        </p>
                        {modLines.length > 0 && (
                          <ul className="mt-2 space-y-0.5 text-sm text-stone-600">
                            {modLines.map((m) => (
                              <li key={m.key} className="flex gap-2">
                                <span className="text-stone-400" aria-hidden>
                                  ·
                                </span>
                                <span>{m.label}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {item.specialInstructions && (
                          <p className="mt-2 text-sm text-stone-600">
                            <span className="font-medium text-stone-700">Note:</span>{" "}
                            {item.specialInstructions}
                          </p>
                        )}
                        {itemError && (
                          <p className="mt-2 text-sm font-medium text-amber-900">{itemError}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className="text-lg font-semibold tabular-nums text-mennyu-primary">
                        ${((item.priceCents * item.quantity) / 100).toFixed(2)}
                      </span>
                      <CartItemActions
                        cartId={cart.id}
                        cartItemId={item.id}
                        quantity={item.quantity}
                        specialInstructions={item.specialInstructions}
                        modifierConfig={
                          item.menuItem.modifierGroups?.length
                            ? (() => {
                                const pplu = item.menuItem.deliverectVariantParentPlu?.trim();
                                const shellBase =
                                  pplu != null
                                    ? shellBaseByVendorParentPlu.get(
                                        shellBasePriceKey(item.vendorId, pplu)
                                      )
                                    : undefined;
                                const serialized = serializeModifierConfig(item.menuItem);
                                return shellBase !== undefined
                                  ? { ...serialized, priceCents: shellBase }
                                  : serialized;
                              })()
                            : undefined
                        }
                        initialSelections={item.selections?.map((s) => ({
                          modifierOptionId: s.modifierOptionId,
                          quantity: s.quantity,
                        }))}
                      />
                    </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-stone-100 bg-stone-50/80 px-4 py-3 text-right text-sm text-stone-600 sm:px-5">
              <span className="text-stone-500">Subtotal for {group.name}</span>{" "}
              <span className="font-semibold text-stone-900 tabular-nums">
                ${(group.subtotalCents / 100).toFixed(2)}
              </span>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border-2 border-stone-200 bg-stone-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Order summary</h2>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <span className="text-base text-stone-700">Food subtotal</span>
          <span className="text-2xl font-bold tabular-nums text-stone-900">
            ${(totalCents / 100).toFixed(2)}
          </span>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Service fee and tip are added at checkout. One payment covers all vendors in this cart.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          href={`/pod/${cart.podId}`}
          className="order-2 rounded-xl border-2 border-stone-300 px-5 py-3 text-center font-medium text-stone-700 hover:bg-stone-100 sm:order-1"
        >
          Back to pod
        </Link>
        <div className="order-1 sm:order-2 sm:text-right">
          {canCheckout ? (
            <Link
              href={`/checkout?cartId=${cart.id}`}
              className="inline-flex w-full justify-center rounded-xl bg-mennyu-primary px-8 py-3 text-center font-semibold text-black hover:bg-mennyu-secondary sm:w-auto"
            >
              Continue to checkout
            </Link>
          ) : (
            <span className="inline-flex w-full justify-center rounded-xl bg-stone-200 px-8 py-3 font-medium text-stone-500 sm:w-auto">
              Fix items above to continue
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
