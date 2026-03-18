import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionIdFromHeaders, getCurrentPodIdFromHeaders, getCustomerPhoneFromHeaders } from "@/lib/session";
import { getActiveOrderByCustomerPhone, validateCartItemsForDisplay, getCartValidationMessage } from "@/services/order.service";
import type { CartForValidation } from "@/services/order.service";
import { prisma } from "@/lib/db";
import { serializeModifierConfig } from "@/lib/modifier-config";
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

  const sessionId = getSessionIdFromHeaders(headersList) ?? "__no_session__";
  const currentPodId = getCurrentPodIdFromHeaders(headersList);
  const params = await searchParams;
  const reorderSkipped = params.reorder_skipped ? parseInt(params.reorder_skipped, 10) : 0;
  const reorderAdded = params.reorder_added ? parseInt(params.reorder_added, 10) : 0;
  const checkoutErrorCode = params.error ? decodeURIComponent(params.error) : null;
  const carts = await prisma.cart.findMany({
    where: { sessionId },
    include: {
      items: {
        include: {
          menuItem: {
            include: {
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  modifierGroup: {
                    include: {
                      options: {
                        orderBy: { sortOrder: "asc" },
                        include: {
                          nestedModifierGroups: {
                            include: {
                              options: { orderBy: { sortOrder: "asc" } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          vendor: true,
          selections: { include: { modifierOption: true } },
        },
      },
      pod: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const cart =
    currentPodId && carts.some((c) => c.podId === currentPodId)
      ? carts.find((c) => c.podId === currentPodId)!
      : carts[0];
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-2 py-12 text-center">
        <p className="text-4xl" aria-hidden>
          🛒
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-stone-900">Your cart is empty</h1>
        <p className="mt-2 text-stone-600">
          Add items from vendors in a pod. You can order from multiple vendors in one checkout and pay once.
        </p>
        <Link
          href="/explore"
          className="mt-8 inline-block rounded-xl bg-mennyu-primary px-6 py-3 font-semibold text-black hover:bg-mennyu-secondary"
        >
          Browse pods
        </Link>
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
      <header className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-semibold text-stone-900">Review your order</h1>
        <p className="mt-1 text-stone-600">
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
          Some items need attention before you can continue.
        </p>
      )}
      {reorderSkipped > 0 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {reorderAdded > 0 && `${reorderAdded} item(s) from your previous order were added. `}
          {reorderSkipped} item(s) could not be added (no longer available).
        </p>
      )}

      <div className="mt-6 space-y-6">
        {Array.from(byVendor.entries()).map(([vendorId, group]) => (
          <section
            key={vendorId}
            className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
          >
            <div className="border-b border-stone-100 bg-stone-50/80 px-4 py-3">
              <h2 className="font-semibold text-stone-900">{group.name}</h2>
              <p className="text-xs text-stone-500">
                {group.items.length} line{group.items.length !== 1 ? "s" : ""}
              </p>
            </div>
            <ul className="divide-y divide-stone-100 px-4 py-2">
              {group.items.map((item) => {
                const itemError = errorByCartItemId.get(item.id);
                const modText = item.selections
                  ?.map((s) =>
                    s.quantity > 1
                      ? `${s.modifierOption.name} ×${s.quantity}`
                      : s.modifierOption.name
                  )
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li
                    key={item.id}
                    className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between ${itemError ? "rounded-lg bg-amber-50/60 -mx-2 px-2" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-900">
                        {item.menuItem.name}
                        <span className="ml-2 font-normal text-stone-500">× {item.quantity}</span>
                      </p>
                      {modText && (
                        <p className="mt-1 text-sm text-stone-600">{modText}</p>
                      )}
                      {item.specialInstructions && (
                        <p className="mt-1 text-sm text-stone-500">Note: {item.specialInstructions}</p>
                      )}
                      {itemError && (
                        <p className="mt-2 text-sm font-medium text-amber-800">{itemError}</p>
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
                            ? serializeModifierConfig(item.menuItem)
                            : undefined
                        }
                        initialSelections={item.selections?.map((s) => ({
                          modifierOptionId: s.modifierOptionId,
                          quantity: s.quantity,
                        }))}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-2 text-right text-sm text-stone-600">
              Vendor subtotal{" "}
              <span className="font-semibold text-stone-900">
                ${(group.subtotalCents / 100).toFixed(2)}
              </span>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-xl border-2 border-stone-200 bg-stone-50 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium uppercase tracking-wide text-stone-500">
            Food subtotal
          </span>
          <span className="text-xl font-bold tabular-nums text-stone-900">
            ${(totalCents / 100).toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Service fee and tip are added at checkout. One payment covers all vendors.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link
          href={`/pod/${cart.podId}`}
          className="order-2 rounded-xl border-2 border-stone-300 px-5 py-3 text-center font-medium text-stone-700 hover:bg-stone-100 sm:order-1"
        >
          Add more items
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
