import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { getCurrentPodIdFromHeaders, getCustomerPhoneFromHeaders } from "@/lib/session";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";
import { discardStaleCheckoutCartsForSession, loadActiveDisplayCartForSession } from "@/services/cart.service";
import { getActiveOrderByCustomerPhone, validateCartItemsForDisplay, getCartValidationMessage } from "@/services/order.service";
import type { CartForValidation } from "@/services/order.service";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { loadCartEditModifierPayloadsForCartPage } from "@/services/cart-edit-modal-payload.service";
import { cartPagePerfMark, cartPagePerfNow, CART_PAGE_PERF_LOG } from "@/lib/cart-page-perf";
import {
  getParentShellInfoByVendorParentPlu,
  getVariantOptionDisplayNameForLeaf,
  shellBasePriceKey,
} from "@/services/cart-deliverect-variant-resolution";
import { CartItemActions } from "./CartItemActions";
import { CheckoutProgress } from "../checkout/CheckoutProgress";
import { GROUP_ORDER_JOIN_TOKEN_COOKIE } from "@/lib/group-order-cookies";
import { unlockGroupCheckoutAction } from "@/actions/group-order.actions";
import { getGroupOrderStateAction } from "@/actions/group-order.actions";
import { GroupOrderCartPanel } from "./GroupOrderCartPanel";
import { GroupOrderCartPoll } from "./GroupOrderCartPoll";
import { GroupOrderLockedBanner } from "./GroupOrderLockedBanner";
import { ParticipantGroupOrderSummary } from "./ParticipantGroupOrderSummary";
import { resolveActorForGroupCart } from "@/services/group-order.service";
import {
  buildGroupOrderCartReadModel,
  canEditGroupCartLine,
  effectiveLineParticipantId,
  findParticipantRow,
} from "@/lib/group-order-cart-read-model";
import { shouldPollCollaborativeGroupCart } from "@/lib/collaborative-cart-freshness";
import { JoinGroupOrderByCodeForm } from "./JoinGroupOrderByCodeForm";

function modifierGroupCountFromDisplayMenuItem(menuItem: { _count?: { modifierGroups: number } }): number {
  return menuItem._count?.modifierGroups ?? 0;
}

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{
    reorder_skipped?: string;
    reorder_added?: string;
    error?: string;
    groupUnlock?: string;
    groupError?: string;
  }>;
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
  const groupStartError = params.groupError ? decodeURIComponent(params.groupError) : null;
  const joinTok = (await cookies()).get(GROUP_ORDER_JOIN_TOKEN_COOKIE)?.value ?? null;
  const perfT0 = cartPagePerfNow();
  let cart = await loadActiveDisplayCartForSession(sessionId, currentPodId, joinTok);
  if (params.groupUnlock === "1" && cart?.id) {
    await unlockGroupCheckoutAction(cart.id);
    redirect("/cart");
  }
  cartPagePerfMark("load_active_display_cart", perfT0, {
    itemCount: cart?.items.length ?? 0,
  });
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
            Pick a pod, then add from any open vendor. One cart, one checkout — each kitchen prepares
            its part of your order.
          </p>
          <div className="mt-8 text-left">
            <JoinGroupOrderByCodeForm />
          </div>
          <Link
            href="/explore"
            className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-mennyu-primary px-6 py-3 font-semibold text-black shadow-sm transition duration-200 hover:bg-mennyu-secondary hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.98]"
          >
            Browse pods
          </Link>
          <p className="mt-6 text-sm text-stone-500">
            Already ordered?{" "}
            <Link href="/orders" className="font-medium text-mennyu-primary hover:underline">
              View orders and order again
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

  const tEdit = cartPagePerfNow();
  const cartEditModifierByItemId = await loadCartEditModifierPayloadsForCartPage(
    cart.items.map((item) => ({
      cartItemId: item.id,
      menuItemId: item.menuItemId,
      persistedSelections:
        item.selections?.map((s) => ({
          modifierOptionId: s.modifierOptionId,
          quantity: s.quantity,
        })) ?? [],
      modifierGroupCount: modifierGroupCountFromDisplayMenuItem(item.menuItem),
    }))
  );
  cartPagePerfMark("cart_edit_modifier_payloads_batch", tEdit, {
    lineCount: cart.items.length,
  });

  const tShell = cartPagePerfNow();
  const parentShellByVendorParentPlu = await getParentShellInfoByVendorParentPlu(cart.items);
  cartPagePerfMark("parent_shell_batch", tShell);

  const tVar = cartPagePerfNow();
  const variantSizeLabelByCartItemId = new Map<string, string | null>();
  await Promise.all(
    cart.items.map(async (item) => {
      const pplu = item.menuItem.deliverectVariantParentPlu?.trim();
      if (!pplu) {
        variantSizeLabelByCartItemId.set(item.id, null);
        return;
      }
      const label = await getVariantOptionDisplayNameForLeaf(
        item.vendorId,
        item.menuItem.deliverectVariantParentPlu,
        item.menuItem.deliverectPlu
      );
      variantSizeLabelByCartItemId.set(item.id, label);
    })
  );
  cartPagePerfMark("variant_size_labels_parallel", tVar);

  const tVal = cartPagePerfNow();
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
  cartPagePerfMark("validate_cart_items_for_display", tVal, {
    itemCount: cart.items.length,
  });
  cartPagePerfMark("cart_page_ssr_total", perfT0, {
    itemCount: cart.items.length,
    perfLogEnabled: CART_PAGE_PERF_LOG,
  });
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

  const authSession = await auth();
  const goState = await getGroupOrderStateAction(cart.id);
  const groupActor = goState.active
    ? await resolveActorForGroupCart(cart.id, {
        hostUserId: authSession?.user?.id ?? null,
        joinTokenFromCookie: joinTok,
      })
    : null;

  const groupReadModel = goState.active
    ? buildGroupOrderCartReadModel(
        cart.items.map((i) => ({
          id: i.id,
          priceCents: i.priceCents,
          quantity: i.quantity,
          groupOrderParticipantId: i.groupOrderParticipantId ?? null,
        })),
        goState.participants.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          isHost: p.isHost,
        }))
      )
    : null;

  const sessionLocked = goState.active && goState.status === "locked_checkout";
  const viewerIsHost = groupActor?.role === "host";
  const viewerParticipantId = groupActor?.participantId ?? null;
  const hostParticipantId = groupReadModel?.hostParticipantId ?? "";

  const nameByParticipantId = new Map(
    goState.active ? goState.participants.map((p) => [p.id, p.displayName] as const) : []
  );

  function lineOwnerLabel(lineParticipantId: string | null): string {
    const eff = effectiveLineParticipantId(lineParticipantId, hostParticipantId);
    return nameByParticipantId.get(eff) ?? "Host";
  }

  const showParticipantTotalsOnly = Boolean(goState.active && groupActor?.role === "participant");
  const pollGroupCart = shouldPollCollaborativeGroupCart({
    hasGroupSession: goState.active,
    sessionStatus: goState.active ? goState.status : "",
  });
  const myParticipantRow =
    showParticipantTotalsOnly && groupReadModel && viewerParticipantId
      ? findParticipantRow(groupReadModel, viewerParticipantId)
      : undefined;

  return (
    <div className="mx-auto max-w-2xl pb-28 sm:pb-10">
      <GroupOrderCartPoll enabled={pollGroupCart} cartId={pollGroupCart ? cart.id : null} />
      <CheckoutProgress activeStep={1} />
      <JoinGroupOrderByCodeForm visible={!goState.active} className="mb-4" />
      <GroupOrderCartPanel
        cartId={cart.id}
        podId={cart.podId}
        goState={goState}
        canStartGroup={Boolean(authSession?.user?.id)}
        readModel={groupReadModel}
        locked={sessionLocked}
      />
      <GroupOrderLockedBanner locked={sessionLocked} viewerIsHost={Boolean(viewerIsHost)} />
      <header className="border-b border-stone-200/90 pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          {goState.active ? "Group order" : "Your cart"}
        </h1>
        <p className="mt-3 text-base text-stone-600">
          <span className="font-semibold text-stone-800">{cart.pod.name}</span>
          {vendorCount > 1 && (
            <span className="text-stone-500"> · {vendorCount} vendors</span>
          )}
        </p>
        <p className="mt-2 text-sm text-stone-500">
          {goState.active ? (
            showParticipantTotalsOnly ? (
              <>
                Group order for this pod only. Add items from vendors here — the host pays once at checkout.
              </>
            ) : (
              <>
                Shared cart for this pod. Participants add their own lines; you&apos;ll see everyone&apos;s items
                labeled below.
              </>
            )
          ) : (
            <>Vendors get your order after payment — you&apos;ll see live status updates here.</>
          )}
        </p>
      </header>

      {groupStartError && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          {groupStartError}
        </p>
      )}
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

      <div className="mt-10 space-y-10">
        {Array.from(byVendor.entries()).map(([vendorId, group]) => (
          <section
            key={vendorId}
            className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)]"
            aria-labelledby={`vendor-${vendorId}-heading`}
          >
            <div className="border-b border-stone-200/80 bg-gradient-to-r from-stone-50 to-mennyu-muted/40 px-4 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Vendor</p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`vendor-${vendorId}-heading`} className="text-lg font-semibold text-stone-900">
                  {group.name}
                </h2>
                <Link
                  href={`/pod/${cart.podId}/vendor/${vendorId}`}
                  className="text-sm font-semibold text-mennyu-primary underline-offset-4 transition hover:underline"
                >
                  Add more from this vendor
                </Link>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {group.items.length} line{group.items.length !== 1 ? "s" : ""} in this group
              </p>
            </div>
            <ul className="divide-y divide-stone-100/90">
              {group.items.map((item) => {
                const lineInteraction =
                  !goState.active
                    ? { disabled: false as const, reason: null as string | null }
                    : sessionLocked
                      ? { disabled: true as const, reason: "Checkout in progress — cart is locked." }
                      : !groupActor
                        ? {
                            disabled: true as const,
                            reason:
                              "Join this group order (or sign in as the host) to add or change items.",
                          }
                        : canEditGroupCartLine({
                            sessionLocked,
                            viewerIsHost: Boolean(viewerIsHost),
                            viewerParticipantId,
                            hostParticipantId,
                            lineGroupOrderParticipantId: item.groupOrderParticipantId ?? null,
                          })
                          ? { disabled: false as const, reason: null as string | null }
                          : {
                              disabled: true as const,
                              reason:
                                "This is another participant's line — only they or the host can change it.",
                            };
                const itemError = errorByCartItemId.get(item.id);
                const pplu = item.menuItem.deliverectVariantParentPlu?.trim();
                const parentShell = pplu
                  ? parentShellByVendorParentPlu.get(shellBasePriceKey(item.vendorId, pplu))
                  : undefined;
                const lineTitle = parentShell?.name ?? item.menuItem.name;
                const lineImageUrl = parentShell?.imageUrl ?? item.menuItem.imageUrl;
                const sizeLabel = variantSizeLabelByCartItemId.get(item.id);
                const modLines = [
                  ...(sizeLabel
                    ? [{ key: "__variant_size", label: sizeLabel }]
                    : []),
                  ...(item.selections
                    ?.map((s) => ({
                      key: s.modifierOptionId,
                      label:
                        s.quantity > 1
                          ? `${s.modifierOption.name} ×${s.quantity}`
                          : s.modifierOption.name,
                    }))
                    .filter((m) => Boolean(m.label)) ?? []),
                ];
                return (
                  <li
                    key={item.id}
                    className={`flex gap-3 px-4 py-4 sm:px-5 ${itemError ? "bg-amber-50/50" : ""}`}
                  >
                    <MenuItemImage imageUrl={lineImageUrl} itemName={lineTitle} />
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-900">
                          {lineTitle}
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
                        vendorUsesDeliverect={Boolean(item.vendor.deliverectChannelLinkId?.trim())}
                        menuItemDeliverectVariantParentPlu={item.menuItem.deliverectVariantParentPlu}
                        interactionDisabled={lineInteraction.disabled}
                        interactionDisabledReason={lineInteraction.reason}
                        modifierConfig={
                          modifierGroupCountFromDisplayMenuItem(item.menuItem) > 0
                            ? cartEditModifierByItemId.get(item.id)?.config
                            : undefined
                        }
                        initialSelections={
                          cartEditModifierByItemId.get(item.id)?.initialSelections ??
                          item.selections?.map((s) => ({
                            modifierOptionId: s.modifierOptionId,
                            quantity: s.quantity,
                          }))
                        }
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

      {showParticipantTotalsOnly && groupReadModel && viewerParticipantId ? (
        <ParticipantGroupOrderSummary model={groupReadModel} viewerParticipantId={viewerParticipantId} />
      ) : showParticipantTotalsOnly ? (
        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          We couldn&apos;t load your personal totals. Refresh the page or re-open the join link.
        </div>
      ) : (
        <div className="mt-12 rounded-2xl border-2 border-stone-200/90 bg-gradient-to-b from-white to-stone-50/90 p-6 shadow-sm sm:p-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Order summary</h2>
          <dl className="mt-5 space-y-3">
            <div className="flex items-baseline justify-between gap-4 border-b border-stone-100 pb-3">
              <dt className="text-base text-stone-700">Food subtotal</dt>
              <dd className="text-xl font-bold tabular-nums text-stone-900">
                ${(totalCents / 100).toFixed(2)}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2 text-xs leading-relaxed text-stone-500">
              <span>
                <span className="font-medium text-stone-600">Tax</span> (if applicable) and{" "}
                <span className="font-medium text-stone-600">service fee</span> are calculated at checkout.
              </span>
            </div>
            <div className="pt-1 text-xs text-stone-500">
              {goState.active ? (
                <>
                  One payment covers every vendor in this group order. You&apos;ll set the tip at checkout as host —
                  each person&apos;s share of the tip follows their share of food (see breakdown above).
                </>
              ) : (
                <>
                  One payment covers every vendor in this cart. Tips are optional and added at checkout.
                </>
              )}
            </div>
          </dl>
        </div>
      )}

      {/* Sticky checkout strip on small screens; flows inline from md+ */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200/90 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.1)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 sm:static sm:z-auto sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:shadow-none sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Link
            href={`/pod/${cart.podId}`}
            className="order-2 hidden rounded-xl border-2 border-stone-300 bg-white px-5 py-3 text-center text-sm font-medium text-stone-700 transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400 active:scale-[0.99] sm:order-1 sm:inline-flex sm:justify-center"
          >
            Back to pod
          </Link>
          <div className="order-1 flex w-full flex-col gap-3 sm:order-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-baseline justify-between gap-4 sm:hidden">
              {showParticipantTotalsOnly && myParticipantRow ? (
                <>
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Your food
                  </span>
                  <span className="text-lg font-bold tabular-nums text-stone-900">
                    ${(myParticipantRow.subtotalCents / 100).toFixed(2)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Food subtotal
                  </span>
                  <span className="text-lg font-bold tabular-nums text-stone-900">
                    ${(totalCents / 100).toFixed(2)}
                  </span>
                </>
              )}
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
              {canCheckout && !showParticipantTotalsOnly && (
                <p className="text-center text-xs leading-snug text-stone-500 sm:text-right">
                  Secure checkout with Stripe · Each vendor is notified after you pay
                </p>
              )}
              {showParticipantTotalsOnly ? (
                <div className="w-full text-center sm:text-right">
                  {!canCheckout ? (
                    <p className="text-xs text-amber-900">
                      Some items need attention before checkout — only the host can complete fixes for the whole group.
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
              ) : canCheckout ? (
                <Link
                  href={`/checkout?cartId=${cart.id}`}
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-mennyu-primary px-8 py-3.5 text-center text-base font-bold text-black shadow-md transition duration-200 hover:bg-mennyu-secondary hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.98] sm:min-w-[14rem] sm:w-auto"
                >
                  Continue to checkout
                </Link>
              ) : (
                <span className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-stone-200 px-8 py-3.5 text-center text-base font-semibold text-stone-500 sm:w-auto">
                  Fix items above to continue
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href={`/pod/${cart.podId}`}
          className="mt-2 block text-center text-sm font-medium text-stone-600 underline-offset-4 transition hover:text-stone-900 hover:underline sm:hidden"
        >
          ← Back to pod
        </Link>
      </div>
    </div>
  );
}
