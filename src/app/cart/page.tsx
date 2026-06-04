import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { getCurrentPodIdFromHeaders, getCustomerPhoneFromHeaders } from "@/lib/session";
import { getOrCreateMennyuSessionIdForCart } from "@/lib/session-request";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
import { mobileStickyCartBarSurfaceClass } from "@/lib/mobile-sticky-cart-bar-classes";
import {
  discardStaleCheckoutCartsForSession,
  getOrCreateCart,
  loadActiveDisplayCartForSession,
} from "@/services/cart.service";
import { getActiveOrderByCustomerPhone, validateCartItemsForDisplay, getCartValidationMessage } from "@/services/order.service";
import type { Cart } from "@/domain/types";
import { buildCartForValidationFromDisplayCart } from "@/lib/cart-for-validation";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { loadCartEditModifierPayloadsForCartPage } from "@/services/cart-edit-modal-payload.service";
import { cartPagePerfMark, cartPagePerfNow, CART_PAGE_PERF_LOG } from "@/lib/cart-page-perf";
import {
  getParentShellInfoByVendorParentPlu,
  getVariantOptionDisplayNamesForLeafLines,
  shellBasePriceKey,
  variantLeafDisplayKey,
} from "@/services/cart-deliverect-variant-resolution";
import { CartItemActions } from "./CartItemActions";
import {
  CartPageLiveCheckoutActions,
  CartPageLiveCheckoutGate,
  CartPageLiveEmptyNotice,
  CartPageLiveFoodSubtotal,
  CartPageLiveLineError,
  CartPageLiveLineGate,
  CartPageLiveLineShell,
  CartPageLiveLineTotal,
  CartPageLiveQuantity,
  CartPageLiveSyncBanner,
  CartPageLiveValidationBanner,
  CartPageLiveVendorLineCountLabel,
  CartPageLiveVendorSection,
  CartPageLiveVendorSubtotal,
  CartPageMutationProvider,
} from "./CartPageMutationSync";
import { CheckoutProgress } from "../checkout/CheckoutProgress";
import { GROUP_ORDER_JOIN_TOKEN_COOKIE } from "@/lib/group-order-cookies";
import {
  getGroupOrderStateForCartPage,
  startGroupOrderForCartPage,
  unlockGroupCheckoutForCartPage,
} from "@/lib/group-order-cart-page";
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
    startGroupOrder?: string;
    podId?: string | string[];
  }>;
}) {
  const headersList = await headers();
  const customerPhone = getCustomerPhoneFromHeaders(headersList);
  const activeOrder = customerPhone ? await getActiveOrderByCustomerPhone(customerPhone) : null;
  if (activeOrder) {
    redirect(`/order/${activeOrder.id}?from=cart`);
  }

  /** Same session mint path as cart mutations — never load carts under a synthetic id. */
  const sessionId = await getOrCreateMennyuSessionIdForCart();
  await discardStaleCheckoutCartsForSession(sessionId);
  const currentPodId = getCurrentPodIdFromHeaders(headersList);
  const params = await searchParams;
  const reorderSkipped = params.reorder_skipped ? parseInt(params.reorder_skipped, 10) : 0;
  const reorderAdded = params.reorder_added ? parseInt(params.reorder_added, 10) : 0;
  const checkoutErrorCode = params.error ? decodeURIComponent(params.error) : null;
  const groupStartError = params.groupError ? decodeURIComponent(params.groupError) : null;
  const joinTok = (await cookies()).get(GROUP_ORDER_JOIN_TOKEN_COOKIE)?.value ?? null;
  const authSession = await auth();

  const startGroupOrder = params.startGroupOrder === "1";
  const podIdRaw = params.podId;
  const podIdFromQuery =
    typeof podIdRaw === "string" ? podIdRaw : Array.isArray(podIdRaw) ? podIdRaw[0] : undefined;
  const targetPodForGroup = (podIdFromQuery?.trim() || currentPodId)?.trim() || null;

  if (startGroupOrder) {
    if (!targetPodForGroup) {
      redirect(
        `/cart?groupError=${encodeURIComponent("Open a pod, then use Start group order from that pod.")}`
      );
    }
    if (!authSession?.user?.id) {
      const dest = `/cart?startGroupOrder=1&podId=${encodeURIComponent(targetPodForGroup)}`;
      redirect(buildLoginHrefWithReturn(dest));
    }
    await getOrCreateCart(targetPodForGroup, sessionId);
  }

  const preferredPodId = startGroupOrder && targetPodForGroup ? targetPodForGroup : currentPodId;
  const perfT0 = cartPagePerfNow();
  let cart = await loadActiveDisplayCartForSession(sessionId, preferredPodId, joinTok);
  if (params.groupUnlock === "1" && cart?.id && authSession?.user?.id) {
    await unlockGroupCheckoutForCartPage(cart.id, authSession.user.id);
    redirect("/cart");
  }

  if (
    startGroupOrder &&
    authSession?.user?.id &&
    cart?.id &&
    targetPodForGroup &&
    cart.podId === targetPodForGroup
  ) {
    const goExisting = await getGroupOrderStateForCartPage(cart.id);
    if (goExisting.active) {
      redirect("/cart");
    }
    const hostName = authSession.user.name?.trim() || "Host";
    const startRes = await startGroupOrderForCartPage(
      cart.id,
      targetPodForGroup,
      authSession.user.id,
      hostName
    );
    if (startRes.success) {
      redirect("/cart");
    }
    redirect(`/cart?groupError=${encodeURIComponent(startRes.error)}`);
  }

  cartPagePerfMark("load_active_display_cart", perfT0, {
    itemCount: cart?.items.length ?? 0,
  });
  if (!cart) {
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
            className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-stone-900 px-6 py-3 font-semibold text-white shadow-sm transition duration-200 hover:bg-stone-800 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 active:scale-[0.98]"
          >
            Browse pods
          </Link>
          <p className="mt-6 text-sm text-stone-500">
            Already ordered?{" "}
            <Link href="/orders" className="font-medium text-stone-900 hover:underline">
              View orders and order again
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    const goEmpty = await getGroupOrderStateForCartPage(cart.id);
    if (!goEmpty.active) {
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
            className="mt-8 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-stone-900 px-6 py-3 font-semibold text-white shadow-sm transition duration-200 hover:bg-stone-800 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 active:scale-[0.98]"
          >
            Browse pods
          </Link>
          <p className="mt-6 text-sm text-stone-500">
            Already ordered?{" "}
            <Link href="/orders" className="font-medium text-stone-900 hover:underline">
              View orders and order again
            </Link>
          </p>
        </div>
      </div>
    );
    }
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

  const initialCartSnapshot: Cart = {
    id: cart.id,
    podId: cart.podId,
    sessionId: cart.sessionId ?? "",
    items: cart.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      vendorId: i.vendorId,
      quantity: i.quantity,
      priceCents: i.priceCents,
      specialInstructions: i.specialInstructions,
    })),
    groups: Array.from(byVendor.entries()).map(([vendorId, g]) => ({
      vendorId,
      vendorName: g.name,
      items: g.items.map((i) => ({
        id: i.id,
        menuItemId: i.menuItemId,
        vendorId: i.vendorId,
        quantity: i.quantity,
        priceCents: i.priceCents,
        specialInstructions: i.specialInstructions,
      })),
      subtotalCents: g.subtotalCents,
    })),
    subtotalCents: totalCents,
  };

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
  const variantDisplayNames = await getVariantOptionDisplayNamesForLeafLines(
    cart.items.map((item) => ({
      vendorId: item.vendorId,
      deliverectVariantParentPlu: item.menuItem.deliverectVariantParentPlu,
      deliverectPlu: item.menuItem.deliverectPlu,
    }))
  );
  const variantSizeLabelByCartItemId = new Map<string, string | null>();
  for (const item of cart.items) {
    const pplu = item.menuItem.deliverectVariantParentPlu?.trim();
    if (!pplu) {
      variantSizeLabelByCartItemId.set(item.id, null);
      continue;
    }
    const leafKey = variantLeafDisplayKey(
      item.vendorId,
      item.menuItem.deliverectVariantParentPlu,
      item.menuItem.deliverectPlu
    );
    variantSizeLabelByCartItemId.set(item.id, leafKey ? (variantDisplayNames.get(leafKey) ?? null) : null);
  }
  cartPagePerfMark("variant_size_labels_batch", tVar);

  const tVal = cartPagePerfNow();
  const cartForValidation = buildCartForValidationFromDisplayCart(cart);
  const initialValidation = await validateCartItemsForDisplay(cartForValidation);
  cartPagePerfMark("validate_cart_items_for_display", tVal, {
    itemCount: cart.items.length,
  });
  cartPagePerfMark("cart_page_ssr_total", perfT0, {
    itemCount: cart.items.length,
    perfLogEnabled: CART_PAGE_PERF_LOG,
  });
  const goState = await getGroupOrderStateForCartPage(cart.id);
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
      <CheckoutProgress activeStep={1} className="pt-3 sm:pt-4" />
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
      {reorderSkipped > 0 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {reorderAdded > 0 && `${reorderAdded} item(s) from your previous order were added. `}
          {reorderSkipped} item(s) could not be added (no longer available).
        </p>
      )}

      <CartPageMutationProvider
        cartId={cart.id}
        podId={cart.podId}
        initialCart={initialCartSnapshot}
        initialValidation={initialValidation}
      >
      <CartPageLiveSyncBanner />
      <CartPageLiveValidationBanner />
      <CartPageLiveEmptyNotice />

      <div className="mt-10 space-y-10">
        {Array.from(byVendor.entries()).map(([vendorId, group]) => (
          <CartPageLiveVendorSection key={vendorId} vendorId={vendorId}>
          <section
            className="overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)]"
            aria-labelledby={`vendor-${vendorId}-heading`}
          >
            <div className="border-b border-stone-200/80 bg-gradient-to-r from-stone-50 to-stone-50/40 px-4 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Vendor</p>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`vendor-${vendorId}-heading`} className="text-lg font-semibold text-stone-900">
                  {group.name}
                </h2>
                <Link
                  href={`/pod/${cart.podId}/vendor/${vendorId}`}
                  className="text-sm font-semibold text-stone-900 underline-offset-4 transition hover:underline"
                >
                  Add more from this vendor
                </Link>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                <CartPageLiveVendorLineCountLabel vendorId={vendorId} fallback={group.items.length} />
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
                  <CartPageLiveLineGate key={item.id} cartItemId={item.id}>
                  <CartPageLiveLineShell cartItemId={item.id}>
                    <MenuItemImage imageUrl={lineImageUrl} itemName={lineTitle} />
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-900">
                          {lineTitle}
                          <span className="ml-2 font-normal text-stone-500">
                            × <CartPageLiveQuantity cartItemId={item.id} fallback={item.quantity} />
                          </span>
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
                        <CartPageLiveLineError cartItemId={item.id} />
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span className="text-lg font-semibold tabular-nums text-stone-900">
                        <CartPageLiveLineTotal
                          cartItemId={item.id}
                          fallbackCents={item.priceCents * item.quantity}
                        />
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
                  </CartPageLiveLineShell>
                  </CartPageLiveLineGate>
                );
              })}
            </ul>
            <div className="border-t border-stone-100 bg-stone-50/80 px-4 py-3 text-right text-sm text-stone-600 sm:px-5">
              <span className="text-stone-500">Subtotal for {group.name}</span>{" "}
              <span className="font-semibold text-stone-900 tabular-nums">
                <CartPageLiveVendorSubtotal vendorId={vendorId} fallbackCents={group.subtotalCents} />
              </span>
            </div>
          </section>
          </CartPageLiveVendorSection>
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
                <CartPageLiveFoodSubtotal fallbackCents={totalCents} />
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
      <CartPageLiveCheckoutGate>
      <div
        className={`${mobileStickyCartBarSurfaceClass} fixed inset-x-0 bottom-0 z-30 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0 sm:pb-0 sm:shadow-none`}
      >
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
                    <CartPageLiveFoodSubtotal fallbackCents={totalCents} />
                  </span>
                </>
              )}
            </div>
            <CartPageLiveCheckoutActions
              showParticipantTotalsOnly={showParticipantTotalsOnly}
              myParticipantSubtotalCents={myParticipantRow?.subtotalCents}
              totalCentsFallback={totalCents}
            />
          </div>
        </div>
        <Link
          href={`/pod/${cart.podId}`}
          className="mt-2 block text-center text-sm font-medium text-stone-600 underline-offset-4 transition hover:text-stone-900 hover:underline sm:hidden"
        >
          ← Back to pod
        </Link>
      </div>
      </CartPageLiveCheckoutGate>
      </CartPageMutationProvider>
    </div>
  );
}
