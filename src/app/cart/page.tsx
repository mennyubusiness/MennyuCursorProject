import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionIdFromHeaders, getCurrentPodIdFromHeaders, getCustomerPhoneFromHeaders } from "@/lib/session";
import { getActiveOrderByCustomerPhone, validateCartItemsForDisplay, getCartValidationMessage } from "@/services/order.service";
import type { CartForValidation } from "@/services/order.service";
import { prisma } from "@/lib/db";
import { serializeModifierConfig } from "@/lib/modifier-config";
import { CartItemActions } from "./CartItemActions";

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
      <div className="mx-auto max-w-md text-center py-12">
        <h1 className="text-2xl font-semibold text-stone-900">Your cart is empty</h1>
        <p className="mt-2 text-stone-600">Add items from a pod to get started. Your cart is saved as you browse.</p>
        <Link href="/explore" className="mt-6 inline-block rounded-lg bg-mennyu-primary px-4 py-2 font-medium text-black hover:bg-mennyu-secondary">
          Browse vendors
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
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Cart</h1>
      <p className="mt-1 text-stone-600">{cart.pod.name}</p>
      {checkoutErrorCode && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {getCartValidationMessage(checkoutErrorCode)} Please update or remove items below, then try checkout again.
        </p>
      )}
      {!cartValid && validationErrors.length > 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          Some items in your cart need attention. Remove or update them to checkout.
        </p>
      )}
      {reorderSkipped > 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {reorderAdded > 0 && `${reorderAdded} item(s) from your previous order were added. `}
          {reorderSkipped} item(s) could not be added (no longer available).
        </p>
      )}
      <div className="mt-6 space-y-8">
        {Array.from(byVendor.entries()).map(([vendorId, group]) => (
          <div key={vendorId} className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="font-medium text-stone-900">{group.name}</h2>
            <ul className="mt-4 space-y-3">
              {group.items.map((item) => {
                const itemError = errorByCartItemId.get(item.id);
                return (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3 last:border-0 ${itemError ? "rounded bg-amber-50/50 p-2 -mx-2" : ""}`}
                >
                  <div>
                    <span className="font-medium">{item.menuItem.name}</span>
                    <span className="ml-2 text-stone-500">× {item.quantity}</span>
                    {itemError && (
                      <p className="mt-1 text-sm text-amber-800">{itemError}</p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-sm text-stone-500">{item.specialInstructions}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-mennyu-primary">
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
                      initialSelections={item.selections?.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity }))}
                    />
                  </div>
                </li>
              ); })}
            </ul>
            <p className="mt-3 text-sm text-stone-600">
              Subtotal: ${(group.subtotalCents / 100).toFixed(2)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 p-4">
        <span className="font-medium">Cart total</span>
        <span className="text-lg font-semibold text-mennyu-primary">
          ${(totalCents / 100).toFixed(2)}
        </span>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Link
          href={`/pod/${cart.podId}`}
          className="rounded-lg border border-stone-300 px-4 py-2 font-medium text-stone-700 hover:bg-stone-100"
        >
          Continue browsing
        </Link>
        {canCheckout ? (
          <Link
            href={`/checkout?cartId=${cart.id}`}
            className="rounded-lg bg-mennyu-primary px-4 py-2 font-medium text-black hover:bg-mennyu-secondary"
          >
            Checkout
          </Link>
        ) : (
          <span className="rounded-lg bg-stone-200 px-4 py-2 font-medium text-stone-500">
            Fix items above to checkout
          </span>
        )}
      </div>
    </div>
  );
}
