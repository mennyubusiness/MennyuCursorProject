import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { getCurrentPodIdFromHeaders, getCustomerPhoneFromHeaders } from "@/lib/session";
import { getOrCreateMennyuSessionIdForCart } from "@/lib/session-request";
import { buildLoginHrefWithReturn } from "@/lib/auth/login-return-path";
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
  CartPageLiveVendorSection,
  CartPageLiveVendorSubtotal,
  CartPageMutationProvider,
} from "./CartPageMutationSync";
import { readGroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import {
  getGroupOrderStateForCartPage,
  loadActiveGroupCartForCartPage,
  startGroupOrderForCartPage,
  unlockGroupCheckoutForCartPage,
} from "@/lib/group-order-cart-page";
import { resolveSubmittedGroupOrderForParticipantCart } from "@/lib/group-participant-submitted-cart";
import { resolveGroupCartEmptyState } from "@/lib/group-order-cart-empty-state";
import { GroupOrderCartPanel } from "./GroupOrderCartPanel";
import { GroupOrderHostEmptyCartCard } from "./GroupOrderHostEmptyCartCard";
import { GroupOrderStartCartSync } from "@/components/cart/GroupOrderStartCartSync";
import { GroupOrderEndCartSync } from "@/components/cart/GroupOrderEndCartSync";
import { buildHostGroupCartClientSnapshot } from "@/lib/group-order-start-sync";
import { buildPostEndCartClientSnapshot } from "@/lib/group-order-end-sync";
import {
  GroupOrderParticipantEmptyCartState,
} from "./GroupOrderEmptyCartStates";
import { GroupOrderCartPoll } from "./GroupOrderCartPoll";
import { GroupOrderSubmittedRedirect } from "./GroupOrderSubmittedRedirect";
import { ParticipantSubmittedTrackingPage } from "./ParticipantSubmittedTrackingPage";
import { GroupOrderLockedBanner } from "./GroupOrderLockedBanner";
import { ParticipantGroupOrderSummary } from "./ParticipantGroupOrderSummary";
import { resolveActorForGroupCart } from "@/services/group-order.service";
import {
  buildGroupOrderViewerContext,
  canViewerCheckoutOnCartPage,
  filterCartLinesForViewer,
  isGroupParticipantCartView,
} from "@/lib/group-order-viewer-context";
import {
  buildGroupOrderCartReadModel,
  canEditGroupCartLine,
  findParticipantRow,
} from "@/lib/group-order-cart-read-model";
import { shouldPollCollaborativeGroupCart } from "@/lib/collaborative-cart-freshness";
import { CartPageJoinGroupAction } from "./CartPageJoinGroupAction";

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
    groupReview?: string;
    groupError?: string;
    groupEnded?: string;
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
  const groupEnded = params.groupEnded === "1";
  const cookieStore = await cookies();
  const participantMarkers = readGroupOrderParticipantMarkers(cookieStore);
  const authSession = await auth();

  const submittedParticipantResolution =
    await resolveSubmittedGroupOrderForParticipantCart(participantMarkers);
  if (
    submittedParticipantResolution.kind === "submitted" &&
    submittedParticipantResolution.orderId
  ) {
    redirect(`/order/${submittedParticipantResolution.orderId}`);
  }

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
    await getOrCreateCart(targetPodForGroup, sessionId, {
      authUserId: authSession?.user?.id ?? null,
    });
  }

  const preferredPodId = startGroupOrder && targetPodForGroup ? targetPodForGroup : currentPodId;
  const perfT0 = cartPagePerfNow();
  let cart =
    (await loadActiveGroupCartForCartPage({
      hostUserId: authSession?.user?.id ?? null,
      participantMarkers,
      preferredPodId,
    })) ?? undefined;
  if (!cart) {
    cart =
      (await loadActiveDisplayCartForSession(
        sessionId,
        preferredPodId,
        participantMarkers,
        authSession?.user?.id ?? null
      )) ??
      undefined;
  }
  if (params.groupUnlock === "1" && cart?.id && authSession?.user?.id) {
    await unlockGroupCheckoutForCartPage(cart.id, authSession.user.id);
    redirect("/cart?groupReview=1");
  }
  const showGroupReviewHint = params.groupReview === "1";

  if (
    startGroupOrder &&
    authSession?.user?.id &&
    cart?.id &&
    targetPodForGroup &&
    cart.podId === targetPodForGroup
  ) {
    const goExisting = await getGroupOrderStateForCartPage(cart.id);
    const hostCanRestart =
      goExisting.active &&
      goExisting.view === "host" &&
      (goExisting.status === "submitted" ||
        goExisting.status === "ended" ||
        goExisting.status === "expired");
    if (goExisting.active && !hostCanRestart) {
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
      const store = await cookies();
      const { clearStaleGroupParticipantCookiesForNewHostGroup } = await import(
        "@/lib/group-order-host-cookie-cleanup"
      );
      await clearStaleGroupParticipantCookiesForNewHostGroup(store, {
        hostUserId: authSession.user.id,
        activeSessionId: startRes.sessionId,
        activeSessionCartId: cart.id,
      });
      redirect("/cart?groupStarted=1");
    }
    redirect(`/cart?groupError=${encodeURIComponent(startRes.error)}`);
  }

  cartPagePerfMark("load_active_display_cart", perfT0, {
    itemCount: cart?.items.length ?? 0,
  });

  const groupActor = cart
    ? await resolveActorForGroupCart(cart.id, {
        hostUserId: authSession?.user?.id ?? null,
        participantIdFromCookie: participantMarkers.participantId,
        joinTokenFromCookie: participantMarkers.legacyJoinToken,
      })
    : null;
  const viewerCtx = cart ? await buildGroupOrderViewerContext(cart.id, groupActor) : null;
  const displayItems =
    cart && viewerCtx ? filterCartLinesForViewer(cart.items, viewerCtx) : cart?.items ?? [];

  const groupEndSyncCart = groupEnded
    ? buildPostEndCartClientSnapshot(
        cart
          ? {
              id: cart.id,
              podId: cart.podId,
              podName: cart.pod.name,
              sessionId: cart.sessionId,
              items: [],
              groups: [],
              subtotalCents: 0,
            }
          : null
      )
    : null;

  if (!cart) {
    return (
      <div className="mx-auto max-w-lg px-2 py-12">
        {groupEndSyncCart !== null || groupEnded ? (
          <GroupOrderEndCartSync
            cart={groupEndSyncCart}
            endedSessionId={groupEndSyncCart?.id}
          />
        ) : null}
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-xs font-medium text-stone-400"
            aria-hidden
          >
            Cart
          </div>
          <h1 className="mt-5 text-2xl font-bold text-oo-charcoal">Your cart is empty</h1>
          <p className="mt-3 text-sm leading-relaxed text-oo-stone-gray">
            Pick a pod, then add from any open vendor.
          </p>
          <Link
            href="/explore"
            className="mt-8 inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-xl bg-brand px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto"
          >
            Browse pods
          </Link>
          <div className="mt-6">
            <CartPageJoinGroupAction />
          </div>
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

  const goState = await getGroupOrderStateForCartPage(cart.id, { participantMarkers });
  if (
    goState.active &&
    goState.view === "participant" &&
    goState.status === "submitted"
  ) {
    if (goState.submittedOrderId) {
      redirect(`/order/${goState.submittedOrderId}`);
    }
    return (
      <ParticipantSubmittedTrackingPage
        cartId={cart.id}
        podId={cart.podId}
        podName={cart.pod.name}
        goState={goState}
        canStartGroup={Boolean(authSession?.user?.id)}
        submittedOrderId={goState.submittedOrderId ?? null}
      />
    );
  }

  const emptyStateKind = resolveGroupCartEmptyState({
    displayItemCount: displayItems.length,
    goStateActive: goState.active,
    goView: goState.active ? goState.view : null,
  });

  const hostGroupStartSyncCart =
    goState.active &&
    goState.view === "host" &&
    (goState.status === "active" || goState.status === "locked_checkout")
      ? buildHostGroupCartClientSnapshot({
          cartId: cart.id,
          podId: cart.podId,
          podName: cart.pod.name,
          sessionId: cart.sessionId,
          joinCode: goState.joinCode,
          groupOrderSessionId: goState.sessionId,
        })
      : null;

  if (emptyStateKind === "host_group_empty") {
    return (
      <div className="mx-auto max-w-2xl sm:pb-10">
        {groupEndSyncCart !== null || groupEnded ? (
          <GroupOrderEndCartSync cart={groupEndSyncCart} endedSessionId={cart?.id} />
        ) : null}
        {hostGroupStartSyncCart ? <GroupOrderStartCartSync cart={hostGroupStartSyncCart} /> : null}
        <GroupOrderHostEmptyCartCard
          cartId={cart.id}
          podId={cart.podId}
          podName={cart.pod.name}
          goState={goState}
        />
      </div>
    );
  }

  if (emptyStateKind === "participant_group_empty") {
    return (
      <div className="mx-auto max-w-2xl sm:pb-10">
        <GroupOrderSubmittedRedirect
          enabled={
            goState.active &&
            (goState.status === "active" || goState.status === "locked_checkout")
          }
          cartId={cart.id}
          initialSessionStatus={goState.active ? goState.status : "active"}
          initialSubmittedOrderId={null}
        />
        <GroupOrderCartPanel
          cartId={cart.id}
          podId={cart.podId}
          podName={cart.pod.name}
          goState={goState}
          canStartGroup={Boolean(authSession?.user?.id)}
          readModel={null}
          locked={goState.active ? goState.status === "locked_checkout" : false}
        />
        <header className="border-b border-stone-200/90 pb-8">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Group order</h1>
          <p className="mt-3 text-base text-stone-600">
            <span className="font-semibold text-stone-800">{cart.pod.name}</span>
          </p>
        </header>
        <GroupOrderParticipantEmptyCartState podId={cart.podId} />
      </div>
    );
  }

  if (emptyStateKind === "solo_empty") {
    return (
      <div className="mx-auto max-w-lg px-2 py-10 sm:py-12">
        <div className="oo-empty-state px-6 py-12 sm:px-10">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-oo-light-stone bg-oo-cream text-sm font-bold text-oo-stone-gray"
            aria-hidden
          >
            Cart
          </div>
          <h1 className="mt-6 text-2xl font-bold text-oo-charcoal">Your cart is empty</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-oo-stone-gray">
            Review your items before checkout — add from any open vendor at this pod.
          </p>
          <Link
            href={`/pod/${cart.podId}`}
            className="mt-8 inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-xl bg-brand px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-auto"
          >
            Browse vendors
          </Link>
          <div className="mt-6">
            <CartPageJoinGroupAction />
          </div>
          <p className="mt-6 text-sm text-oo-stone-gray">
            Already ordered?{" "}
            <Link href="/orders" className="font-semibold text-oo-charcoal hover:underline">
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
  for (const item of displayItems) {
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

  const initialCartSnapshot: Cart = {
    id: cart.id,
    podId: cart.podId,
    sessionId: cart.sessionId ?? "",
    items: displayItems.map((i) => ({
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
    displayItems.map((item) => ({
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
  const parentShellByVendorParentPlu = await getParentShellInfoByVendorParentPlu(displayItems);
  cartPagePerfMark("parent_shell_batch", tShell);

  const tVar = cartPagePerfNow();
  const variantDisplayNames = await getVariantOptionDisplayNamesForLeafLines(
    displayItems.map((item) => ({
      vendorId: item.vendorId,
      deliverectVariantParentPlu: item.menuItem.deliverectVariantParentPlu,
      deliverectPlu: item.menuItem.deliverectPlu,
    }))
  );
  const variantSizeLabelByCartItemId = new Map<string, string | null>();
  for (const item of displayItems) {
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
  const cartForValidation = buildCartForValidationFromDisplayCart({ ...cart, items: displayItems });
  const initialValidation = await validateCartItemsForDisplay(cartForValidation);
  cartPagePerfMark("validate_cart_items_for_display", tVal, {
    itemCount: cart.items.length,
  });
  cartPagePerfMark("cart_page_ssr_total", perfT0, {
    itemCount: cart.items.length,
    perfLogEnabled: CART_PAGE_PERF_LOG,
  });
  const hostParticipantId = viewerCtx?.hostParticipantId ?? "";
  const participantsForReadModel =
    goState.active && goState.view === "host"
      ? goState.participants.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          isHost: p.isHost,
        }))
      : goState.active &&
          goState.view === "participant" &&
          viewerCtx?.viewerParticipantId &&
          viewerCtx.hostParticipantId
        ? [
            { id: viewerCtx.hostParticipantId, displayName: "Host", isHost: true },
            {
              id: viewerCtx.viewerParticipantId,
              displayName: goState.viewerDisplayName,
              isHost: false,
            },
          ]
        : [];

  const linesForReadModel = viewerCtx?.canViewAllLines ? cart.items : displayItems;

  const groupReadModel =
    goState.active && participantsForReadModel.length > 0
      ? buildGroupOrderCartReadModel(
          linesForReadModel.map((i) => ({
            id: i.id,
            priceCents: i.priceCents,
            quantity: i.quantity,
            groupOrderParticipantId: i.groupOrderParticipantId ?? null,
          })),
          participantsForReadModel
        )
      : null;

  const sessionLocked = goState.active && goState.status === "locked_checkout";
  const sessionSubmitted = goState.active && goState.status === "submitted";
  const cartEditingDisabled = sessionLocked || sessionSubmitted;
  const submittedOrderId =
    goState.active && "submittedOrderId" in goState ? goState.submittedOrderId ?? null : null;
  const viewerIsHost = groupActor?.role === "host";
  const viewerParticipantId = groupActor?.participantId ?? null;

  const viewerCanCheckout = canViewerCheckoutOnCartPage({
    goStateActive: goState.active,
    goStateView: goState.active ? goState.view : undefined,
    viewerCtx,
  });
  const showParticipantTotalsOnly = isGroupParticipantCartView({
    goStateActive: goState.active,
    goStateView: goState.active ? goState.view : undefined,
  });
  const pollGroupCart = shouldPollCollaborativeGroupCart({
    hasGroupSession: goState.active,
    sessionStatus: goState.active ? goState.status : "",
  });
  const myParticipantRow =
    showParticipantTotalsOnly && groupReadModel && viewerParticipantId
      ? findParticipantRow(groupReadModel, viewerParticipantId)
      : undefined;

  const participantSubmissionPoll =
    goState.active &&
    goState.view === "participant" &&
    (goState.status === "active" || goState.status === "locked_checkout");

  return (
    <div className="oo-shell py-4 sm:py-6 lg:pb-10">
      <GroupOrderSubmittedRedirect
        enabled={participantSubmissionPoll}
        cartId={cart.id}
        initialSessionStatus={goState.active ? goState.status : "active"}
        initialSubmittedOrderId={submittedOrderId}
      />
      <GroupOrderCartPoll enabled={pollGroupCart} cartId={pollGroupCart ? cart.id : null} />
      <GroupOrderCartPanel
        cartId={cart.id}
        podId={cart.podId}
        podName={cart.pod.name}
        goState={goState}
        canStartGroup={Boolean(authSession?.user?.id)}
        readModel={groupReadModel}
        locked={sessionLocked}
      />
      <GroupOrderLockedBanner
        locked={sessionLocked}
        viewerIsHost={Boolean(viewerIsHost)}
        showReviewHint={showGroupReviewHint && Boolean(viewerIsHost)}
      />
      <header className="mb-6 border-b border-oo-light-stone pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-oo-charcoal sm:text-3xl">
          {goState.active ? "Group order" : "Your cart"}
        </h1>
        <p className="mt-2 text-base font-semibold text-oo-charcoal">{cart.pod.name}</p>
        <p className="mt-1 text-sm text-oo-stone-gray">
          {goState.active ? (
            showParticipantTotalsOnly ? (
              <>You&apos;re adding your items. The host will check out when everyone is ready.</>
            ) : (
              <>Shared cart for this pod — each participant&apos;s lines are labeled below.</>
            )
          ) : (
            <>Review your items before checkout.</>
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
        allowCheckout={viewerCanCheckout}
      >
      {groupEndSyncCart !== null || groupEnded ? (
        <GroupOrderEndCartSync cart={groupEndSyncCart} endedSessionId={cart.id} />
      ) : null}
      {hostGroupStartSyncCart ? <GroupOrderStartCartSync cart={hostGroupStartSyncCart} /> : null}
      <CartPageLiveSyncBanner />
      <CartPageLiveValidationBanner />
      <CartPageLiveEmptyNotice hideWhenGroupActive={goState.active} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,20rem)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
        {Array.from(byVendor.entries()).map(([vendorId, group]) => (
          <CartPageLiveVendorSection key={vendorId} vendorId={vendorId}>
          <section
            className="overflow-hidden rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-sm"
            aria-labelledby={`vendor-${vendorId}-heading`}
          >
            <div className="border-b border-oo-light-stone bg-oo-cream/40 px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`vendor-${vendorId}-heading`} className="text-base font-bold text-oo-charcoal sm:text-lg">
                  {group.name}
                </h2>
                <Link
                  href={`/pod/${cart.podId}/vendor/${vendorId}`}
                  className="text-sm font-semibold text-oo-stone-gray transition hover:text-brand"
                >
                  Add more
                </Link>
              </div>
            </div>
            <ul className="divide-y divide-oo-light-stone/80">
              {group.items.map((item) => {
                const lineInteraction =
                  !goState.active
                    ? { disabled: false as const, reason: null as string | null }
                    : cartEditingDisabled
                      ? {
                          disabled: true as const,
                          reason: sessionSubmitted
                            ? "This group order has been placed."
                            : "Checkout in progress — cart is locked.",
                        }
                      : !groupActor
                        ? {
                            disabled: true as const,
                            reason:
                              "Join this group order (or sign in as the host) to add or change items.",
                          }
                        : canEditGroupCartLine({
                            sessionLocked: cartEditingDisabled,
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
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-oo-charcoal">
                          {lineTitle}
                        </p>
                        {modLines.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 text-sm text-oo-stone-gray">
                            {modLines.map((m) => (
                              <li key={m.key}>{m.label}</li>
                            ))}
                          </ul>
                        )}
                        {item.specialInstructions && (
                          <p className="mt-2 text-sm text-oo-stone-gray">
                            <span className="font-medium text-oo-charcoal">Note:</span>{" "}
                            {item.specialInstructions}
                          </p>
                        )}
                        <CartPageLiveLineError cartItemId={item.id} />
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                        <span className="text-base font-semibold tabular-nums text-oo-charcoal">
                          <CartPageLiveLineTotal
                            cartItemId={item.id}
                            fallbackCents={item.priceCents * item.quantity}
                          />
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-oo-stone-gray">
                          <span>
                            Qty <CartPageLiveQuantity cartItemId={item.id} fallback={item.quantity} />
                          </span>
                        </div>
                        <CartItemActions
                        cartId={cart.id}
                        podId={cart.podId}
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
            <div className="border-t border-oo-light-stone bg-oo-cream/30 px-4 py-3 text-right text-sm text-oo-stone-gray sm:px-5">
              <span>Subtotal</span>{" "}
              <span className="font-semibold text-oo-charcoal tabular-nums">
                <CartPageLiveVendorSubtotal vendorId={vendorId} fallbackCents={group.subtotalCents} />
              </span>
            </div>
          </section>
          </CartPageLiveVendorSection>
        ))}
        </div>

        <aside className="mt-8 lg:sticky lg:top-24 lg:mt-0">
          {showParticipantTotalsOnly && groupReadModel && viewerParticipantId ? (
            <ParticipantGroupOrderSummary model={groupReadModel} viewerParticipantId={viewerParticipantId} />
          ) : showParticipantTotalsOnly ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
              We couldn&apos;t load your personal totals. Refresh the page or re-open the join link.
            </div>
          ) : (
            <div className="rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-bold text-oo-charcoal">Order summary</h2>
              <dl className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between gap-4 border-b border-oo-light-stone pb-3">
                  <dt className="text-sm text-oo-stone-gray">Food subtotal</dt>
                  <dd className="text-xl font-bold tabular-nums text-oo-charcoal">
                    <CartPageLiveFoodSubtotal fallbackCents={totalCents} />
                  </dd>
                </div>
                <p className="text-xs leading-relaxed text-oo-stone-gray">
                  {goState.active ? (
                    <>
                      Tax, service fee, and tip are calculated at checkout. As host, one payment covers every
                      vendor in this group order.
                    </>
                  ) : (
                    <>Tax, service fee, and optional tip are calculated at checkout.</>
                  )}
                </p>
              </dl>
              <CartPageLiveCheckoutGate
                serverItemCount={displayItems.reduce((n, item) => n + item.quantity, 0)}
              >
                <CartPageLiveCheckoutActions
                  viewerCanCheckout={viewerCanCheckout}
                  showParticipantTotalsOnly={showParticipantTotalsOnly}
                  sessionLockedCheckout={sessionLocked}
                  myParticipantSubtotalCents={myParticipantRow?.subtotalCents}
                  totalCentsFallback={totalCents}
                  groupSubmitted={sessionSubmitted}
                  submittedOrderId={submittedOrderId}
                />
              </CartPageLiveCheckoutGate>
              <Link
                href={`/pod/${cart.podId}`}
                className="mt-4 hidden text-sm font-semibold text-oo-stone-gray transition hover:text-brand lg:inline-flex"
              >
                ← Back to pod
              </Link>
            </div>
          )}
        </aside>
      </div>
      </CartPageMutationProvider>
    </div>
  );
}
