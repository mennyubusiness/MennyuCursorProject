/**
 * Cart business logic: create/update cart by session + pod; add/update/remove items; group by vendor.
 * Cart is session-scoped (one per pod per session). Future multi-user/group ordering could
 * introduce a shared cart or order-group id while keeping single-payer and this session model.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Cart, CartGroup, CartItem, CartPodScope, QuickCartApiResponse } from "@/domain/types";
import { computeEffectiveUnitPriceCents } from "@/domain/money";
import { validateCartItemModifiers } from "@/services/modifier-validation";
import { getVendorAvailability } from "@/lib/vendor-availability";
import { vendorAvailabilityWithCustomerOrderingHours } from "@/lib/vendor-customer-ordering-hours";
import {
  getVendorOrderabilityInPod,
  cartLineOrderabilityCode,
  cartLineOrderabilityMessage,
} from "@/lib/vendor-orderability-in-pod";
import { loadVendorReadinessBundles } from "@/lib/vendor-readiness-validation.server";
import { selectCartForSessionAndPod } from "@/lib/cart-selection";
import { isMenuItemEffectivelyAvailable } from "@/services/menu-item-availability.service";
import { getOperationalMenuItemIdsForVendor } from "@/services/menu-active-scope.service";
import { normalizedConfigurationKey } from "@/lib/cart-line-identity";
import {
  augmentSelectionsWithImplicitVariantFromLeaf,
  loadMenuItemForVariantResolution,
  menuItemForModifierValidation,
  resolveDeliverectVariantLeafForCartLine,
  shellBasePriceCentsForMenuItem,
} from "@/services/cart-deliverect-variant-resolution";
import { CartValidationError } from "@/services/cart-validation-error";
import { assertCartSessionAccess } from "@/lib/cart-session-access";
import type { GroupOrderParticipantMarkers } from "@/lib/group-order-participant-cookie";
import {
  enforceGroupOrderCartMutation,
  findSessionByCartId,
  resolveActiveGroupCartIdForPod,
  resolveActorForGroupCart,
  resolveGroupCartActorForRead,
  resolveGroupCartIdFromParticipantMarkers,
  resolveHostActiveGroupCartId,
  assertGroupCartUnlockedForMutation,
  type ResolvedGroupCartActor,
} from "@/services/group-order.service";
import {
  buildActiveCartRecovery,
  isActiveGroupSessionStatus,
} from "@/lib/quick-cart-active-recovery";
import {
  applyGroupOrderVisibilityToCart,
  buildGroupOrderViewerContext,
} from "@/lib/group-order-viewer-context";
import { attachQuickCartDisplay, shouldShowFullCartInQuickCartDrawer } from "@/lib/quick-cart-display";
import { isCartRowAssigned } from "@/lib/cart-pod-context";
import { assertSessionAllowsAddToCart } from "@/lib/cart-pod-guard";
import {
  ensureCartOwnedByUser,
  findActiveAccountSoloCartId,
} from "@/lib/account-cart-ownership";

export { assertSessionAllowsAddToCart } from "@/lib/cart-pod-guard";

export { CartValidationError } from "@/services/cart-validation-error";

export type { ResolvedGroupCartActor } from "@/services/group-order.service";

export type CartServiceAuthOpts = { authUserId?: string | null };

import { isAddToCartTraceEnabled } from "@/lib/debug-add-to-cart-trace";

/** TEMP: set false to silence stale-checkout unlink trace logs */
const DEBUG_DISCARD_STALE_CHECKOUT = process.env.NODE_ENV === "development";

/**
 * Completed / in-flight orders (anything except unpaid `pending_payment` or retryable `failed`) may
 * still reference this cart via `Order.sourceCartId` if cleanup did not run. That poisons reuse:
 * `discardStaleCheckoutCartsForSession` would see a "blocking" order and wipe line items on every
 * /cart load. Unlink those orders from the cart id without deleting CartItem rows — payment success
 * should already have cleared lines via `clearCheckoutSourceCartForOrder`; if not, we prefer leaving
 * stale lines over deleting the customer's new basket.
 */
export async function unlinkCompletedCheckoutOrdersFromCart(cartId: string): Promise<number> {
  const result = await prisma.order.updateMany({
    where: {
      sourceCartId: cartId,
      status: { notIn: ["pending_payment", "failed"] },
    },
    data: { sourceCartId: null },
  });
  return result.count;
}

/** Full cart graph for /api/cart GET and checkout-adjacent session cart loads. */
export const CART_SESSION_FULL_INCLUDE = {
  items: {
    include: {
      menuItem: true,
      vendor: true,
      selections: { include: { modifierOption: true } },
    },
  },
  pod: true,
  groupOrderSession: { select: { status: true } },
} satisfies Prisma.CartInclude;

function isPodSessionCartUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (!Array.isArray(target)) return true;
  return target.includes("podId") && target.includes("sessionId");
}

/**
 * Race-safe get-or-create for the unique (`podId`, `sessionId`) cart row.
 * Concurrent creates that lose the race re-fetch the winner instead of surfacing P2002.
 */
export async function findOrCreateCartForPodSession<I extends Prisma.CartInclude>(
  podId: string,
  sessionId: string,
  include: I
): Promise<Prisma.CartGetPayload<{ include: I }>> {
  const where = { podId_sessionId: { podId, sessionId } };

  const existing = await prisma.cart.findUnique({ where, include });
  if (existing) return existing;

  try {
    return await prisma.cart.create({
      data: { podId, sessionId },
      include,
    });
  } catch (error) {
    if (!isPodSessionCartUniqueViolation(error)) throw error;
    const raced = await prisma.cart.findUnique({ where, include });
    if (!raced) throw error;
    return raced;
  }
}

export async function getOrCreateCart(
  podId: string,
  sessionId: string,
  opts: CartServiceAuthOpts = {}
): Promise<Cart> {
  const authUserId = opts.authUserId?.trim() || null;

  if (authUserId) {
    const accountCartId = await findActiveAccountSoloCartId(authUserId, podId);
    if (accountCartId) {
      const accountRow = await prisma.cart.findUnique({
        where: { id: accountCartId },
        include: CART_SESSION_FULL_INCLUDE,
      });
      if (accountRow) {
        await unlinkCompletedCheckoutOrdersFromCart(accountRow.id);
        return scopeCartForGroupViewer(accountRow, accountRow.id, null);
      }
    }
  }

  const cart = await findOrCreateCartForPodSession(podId, sessionId, CART_SESSION_FULL_INCLUDE);

  await unlinkCompletedCheckoutOrdersFromCart(cart.id);

  if (authUserId) {
    await ensureCartOwnedByUser(cart.id, authUserId);
    const refreshed = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: CART_SESSION_FULL_INCLUDE,
    });
    if (refreshed) {
      return scopeCartForGroupViewer(refreshed, refreshed.id, null);
    }
  }

  return scopeCartForGroupViewer(cart, cart.id, null);
}

export type CartItemSelectionInput = { modifierOptionId: string; quantity: number };

function throwIfMenuItemNotOperational(
  operational: Set<string>,
  menuItemId: string,
  name: string,
  extra?: { cartItemId?: string }
): void {
  if (operational.has(menuItemId)) return;
  throw new CartValidationError(`${name} is not on the current menu.`, "ITEM_NOT_IN_CURRENT_MENU", {
    menuItemId,
    menuItemName: name,
    ...extra,
  });
}

async function requireOperationalMenuItem(
  operationalByVendor: Map<string, Set<string>>,
  vendorId: string,
  menuItemId: string,
  name: string,
  extra?: { cartItemId?: string }
): Promise<Set<string>> {
  let operational = operationalByVendor.get(vendorId);
  if (!operational) {
    operational = await getOperationalMenuItemIdsForVendor(vendorId);
    operationalByVendor.set(vendorId, operational);
  }
  throwIfMenuItemNotOperational(operational, menuItemId, name, extra);
  return operational;
}

/** Lean cart graph for mutation responses (Quick Cart / vendor menu client state). */
export const CART_MUTATION_CART_INCLUDE = {
  items: {
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
          deliverectPlu: true,
          deliverectVariantParentPlu: true,
        },
      },
      vendor: { select: { name: true } },
      selections: {
        include: {
          modifierOption: { select: { name: true, priceCents: true } },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export async function getOrCreateCartForVendorMenuPage(
  podId: string,
  sessionId: string,
  opts: CartServiceAuthOpts = {}
): Promise<Cart> {
  const authUserId = opts.authUserId?.trim() || null;

  if (authUserId) {
    const accountCartId = await findActiveAccountSoloCartId(authUserId, podId);
    if (accountCartId) {
      const accountRow = await prisma.cart.findUnique({
        where: { id: accountCartId },
        include: CART_MUTATION_CART_INCLUDE,
      });
      if (accountRow) {
        await unlinkCompletedCheckoutOrdersFromCart(accountRow.id);
        return toCartWithGroups(accountRow);
      }
    }
  }

  const cart = await findOrCreateCartForPodSession(
    podId,
    sessionId,
    CART_MUTATION_CART_INCLUDE
  );

  await unlinkCompletedCheckoutOrdersFromCart(cart.id);

  if (authUserId) {
    await ensureCartOwnedByUser(cart.id, authUserId);
    const refreshed = await prisma.cart.findUnique({
      where: { id: cart.id },
      include: CART_MUTATION_CART_INCLUDE,
    });
    if (refreshed) {
      return toCartWithGroups(refreshed);
    }
  }

  return toCartWithGroups(cart);
}

type CartRowForGrouping = Parameters<typeof toCartWithGroups>[0];

function cartLineParticipantMap(
  items: Array<{ id: string; groupOrderParticipantId?: string | null }>
): Map<string, string | null> {
  return new Map(items.map((i) => [i.id, i.groupOrderParticipantId ?? null]));
}

type CartRowWithPod = CartRowForGrouping & { pod?: { name: string; slug: string } | null };

const ACTIVE_GROUP_SESSION_STATUSES = ["active", "locked_checkout"] as const;

type SessionCartPick = {
  id: string;
  podId: string;
  sessionId: string;
  updatedAt: Date;
  pod: { name: string };
  items: Array<{ id: string }>;
  groupOrderSession?: { status: string } | null;
};

function inferCartScopeFromViewer(cart: Cart, ctx: Awaited<ReturnType<typeof buildGroupOrderViewerContext>>): CartPodScope {
  if (ctx.isGroupOrder && ctx.viewerRole !== "solo") return "group_order";
  if (cart.items.length > 0) return "assigned_pod";
  return "neutral";
}

function selectAssignedSessionCart<T extends SessionCartPick>(rows: T[]): T | null {
  const assigned = rows.filter((r) =>
    isCartRowAssigned({
      itemCount: r.items.length,
      hasActiveGroupSession: Boolean(
        r.groupOrderSession &&
          ACTIVE_GROUP_SESSION_STATUSES.includes(
            r.groupOrderSession.status as (typeof ACTIVE_GROUP_SESSION_STATUSES)[number]
          )
      ),
    })
  );
  if (assigned.length === 0) return null;
  return assigned.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
}

async function scopeCartForGroupViewer(
  raw: CartRowWithPod,
  cartId: string,
  groupOrderActor?: ResolvedGroupCartActor | null,
  displayScope?: CartPodScope
): Promise<Cart> {
  const ctx = await buildGroupOrderViewerContext(cartId, groupOrderActor ?? null);
  const full = toCartWithGroups(raw);
  const map = cartLineParticipantMap(
    raw.items as Array<{ id: string; groupOrderParticipantId?: string | null }>
  );
  const scoped = applyGroupOrderVisibilityToCart(full, ctx, map);
  const scope = displayScope ?? inferCartScopeFromViewer(scoped, ctx);
  return attachQuickCartDisplay(scoped, ctx, raw.pod?.name ?? null, scope, raw.pod?.slug ?? null);
}

export async function getCartByIdForMutation(
  cartId: string,
  groupOrderActor?: ResolvedGroupCartActor | null
): Promise<Cart | null> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: CART_MUTATION_CART_INCLUDE,
  });
  if (!cart) return null;
  return scopeCartForGroupViewer(cart, cartId, groupOrderActor);
}

async function getCartByIdForMutationOrThrow(
  cartId: string,
  groupOrderActor?: ResolvedGroupCartActor | null
): Promise<Cart> {
  const cart = await getCartByIdForMutation(cartId, groupOrderActor);
  if (!cart) throw new Error("Cart not found");
  return cart;
}

function findMatchingCartLine<
  T extends {
    id: string;
    specialInstructions: string | null;
    selections: Array<{ modifierOptionId: string; quantity: number }>;
  },
>(candidates: T[], incomingKey: string): T | null {
  return (
    candidates.find((c) => {
      const key = normalizedConfigurationKey(
        c.specialInstructions,
        c.selections.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity }))
      );
      return key === incomingKey;
    }) ?? null
  );
}

export async function addCartItem(
  cartId: string,
  menuItemId: string,
  quantity: number,
  specialInstructions?: string | null,
  selections?: CartItemSelectionInput[] | null,
  /** When the cart is in a group-order session, pass the resolved host/participant actor. */
  groupOrderActor?: ResolvedGroupCartActor | null
): Promise<Cart> {
  if (isAddToCartTraceEnabled()) {
    console.log("[addCartItem] enter", { cartId, menuItemId, quantity });
  }
  const menuItemInitial = await loadMenuItemForVariantResolution(menuItemId);
  if (!menuItemInitial) {
    if (isAddToCartTraceEnabled()) {
      console.error("[addCartItem] MenuItem not found", { menuItemId });
    }
    throw new Error("MenuItem not found");
  }
  if (isAddToCartTraceEnabled()) {
    console.log("[addCartItem] menuItem loaded", {
      menuItemId: menuItemInitial.id,
      vendorId: menuItemInitial.vendorId,
      name: menuItemInitial.name,
    });
  }

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: true, pod: { select: { pickupTimezone: true, isActive: true } } },
  });
  if (!cart) throw new Error("Cart not found");
  await assertSessionAllowsAddToCart(cart.sessionId, cartId, cart.podId);

  const vendorForOrderability = vendorAvailabilityWithCustomerOrderingHours(
    menuItemInitial.vendor,
    cart.pod?.pickupTimezone
  );
  const operationalByVendor = new Map<string, Set<string>>();
  await requireOperationalMenuItem(
    operationalByVendor,
    menuItemInitial.vendorId,
    menuItemInitial.id,
    menuItemInitial.name
  );
  if (!menuItemInitial.isAvailable) {
    throw new CartValidationError(`${menuItemInitial.name} is no longer available.`, "ITEM_UNAVAILABLE", {
      menuItemId: menuItemInitial.id,
      menuItemName: menuItemInitial.name,
    });
  }

  if (groupOrderActor && cart.podId !== groupOrderActor.podId) {
    throw new CartValidationError(
      "This item isn’t available for the pod your group order is using.",
      "GROUP_ORDER_POD_MISMATCH"
    );
  }
  const [vendorInPod, pod, readinessBundles] = await Promise.all([
    prisma.podVendor.findUnique({
      where: {
        podId_vendorId: { podId: cart.podId, vendorId: menuItemInitial.vendorId },
      },
      select: { isActive: true },
    }),
    prisma.pod.findUnique({
      where: { id: cart.podId },
      select: { isActive: true, mennyuOrdersPaused: true },
    }),
    loadVendorReadinessBundles([menuItemInitial.vendorId]),
  ]);
  const readinessBundle = readinessBundles.get(menuItemInitial.vendorId);
  const podOrderability = getVendorOrderabilityInPod({
    podActive: pod?.isActive ?? false,
    podOrdersPaused: pod?.mennyuOrdersPaused ?? false,
    podVendorExists: Boolean(vendorInPod),
    podVendorActive: vendorInPod?.isActive ?? false,
    vendor: vendorForOrderability,
    readiness: readinessBundle
      ? {
          vendor: readinessBundle.vendor,
          menuSummary: readinessBundle.menuSummary,
          stripeSummary: readinessBundle.stripeSummary,
          posSummary: readinessBundle.posSummary,
        }
      : undefined,
  });
  if (!podOrderability.orderable) {
    throw new CartValidationError(
      podOrderability.message ?? cartLineOrderabilityMessage(podOrderability),
      podOrderability.code ?? cartLineOrderabilityCode(podOrderability)
    );
  }

  /** Validate modifiers only after variant resolution: parent shell graphs do not include leaf-only option ids. */
  const { menuItem: menuItemResolved, selections: selectionsResolved, variantSelectionsPriceCents } =
    await resolveDeliverectVariantLeafForCartLine({
      menuItem: menuItemInitial,
      selections,
    });

  /** Parent shell list price + variant (size) charges — matches vendor modal (not leaf list + size). */
  const shellBase = await shellBasePriceCentsForMenuItem(menuItemInitial);
  const baseUnitCents = shellBase + variantSelectionsPriceCents;

  if (
    menuItemResolved.id !== menuItemInitial.id ||
    menuItemResolved.vendorId !== menuItemInitial.vendorId
  ) {
    await requireOperationalMenuItem(
      operationalByVendor,
      menuItemResolved.vendorId,
      menuItemResolved.id,
      menuItemResolved.name
    );
  }
  if (!menuItemResolved.isAvailable) {
    throw new CartValidationError(`${menuItemResolved.name} is no longer available.`, "ITEM_UNAVAILABLE", {
      menuItemId: menuItemResolved.id,
      menuItemName: menuItemResolved.name,
    });
  }

  const hasModifierGroupsResolved = menuItemResolved.modifierGroups.length > 0;
  const selectionsForLeaf = selectionsResolved ?? [];
  if (hasModifierGroupsResolved || selectionsForLeaf.length > 0) {
    const modLeaf = await validateCartItemModifiers({
      id: "",
      menuItemId: menuItemResolved.id,
      quantity,
      menuItem: {
        name: menuItemResolved.name,
        isAvailable: menuItemResolved.isAvailable,
        basketMaxQuantity: menuItemResolved.basketMaxQuantity ?? undefined,
      },
      selections: selectionsForLeaf,
    });
    if (!modLeaf.valid) {
      throw new CartValidationError(modLeaf.message, modLeaf.code, {
        menuItemId: modLeaf.menuItemId,
        menuItemName: modLeaf.menuItemName,
      });
    }
  }

  /** Narrow gate: Deliverect-routed vendors cannot take lines that would fail {@link validateForSubmission}. */
  const deliverectRouted = Boolean(menuItemResolved.vendor.deliverectChannelLinkId?.trim());
  if (deliverectRouted) {
    if (!menuItemResolved.deliverectPlu?.trim()) {
      throw new CartValidationError(
        "This item is not available for online ordering until the kitchen menu mapping is fixed. Please choose something else.",
        "DELIVERECT_PLU_MISSING",
        { menuItemId: menuItemResolved.id, menuItemName: menuItemResolved.name }
      );
    }
    if (selectionsForLeaf.length > 0) {
      const optIds = [...new Set(selectionsForLeaf.map((s) => s.modifierOptionId))];
      const optsWithPlu = await prisma.modifierOption.findMany({
        where: { id: { in: optIds } },
        select: { id: true, deliverectModifierPlu: true },
      });
      const badPlu = optsWithPlu.some((o) => !o.deliverectModifierPlu?.trim());
      if (badPlu) {
        throw new CartValidationError(
          "A customization for this item is not available for online ordering. Try different options or contact the restaurant.",
          "DELIVERECT_MODIFIER_PLU_MISSING",
          { menuItemId: menuItemResolved.id, menuItemName: menuItemResolved.name }
        );
      }
    }
  }

  const effectiveUnitPriceCents =
    selectionsForLeaf.length > 0
      ? (() => {
          const optionIds = [...new Set(selectionsForLeaf.map((s) => s.modifierOptionId))];
          return prisma.modifierOption
            .findMany({ where: { id: { in: optionIds } }, select: { id: true, priceCents: true } })
            .then((opts) => {
              const byId = new Map(opts.map((o) => [o.id, o.priceCents]));
              const withPrices = selectionsForLeaf
                .filter((s) => s.quantity >= 1)
                .map((s) => ({ priceCents: byId.get(s.modifierOptionId) ?? 0, quantity: s.quantity }));
              return computeEffectiveUnitPriceCents(baseUnitCents, withPrices);
            });
        })()
      : Promise.resolve(baseUnitCents);

  const priceCentsToStore = await effectiveUnitPriceCents;

  const resolvedMenuItemId = menuItemResolved.id;
  const incomingKey = normalizedConfigurationKey(
    specialInstructions,
    selectionsForLeaf.length > 0
      ? selectionsForLeaf.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity }))
      : null
  );

  const previewCandidates = await prisma.cartItem.findMany({
    where: { cartId, menuItemId: resolvedMenuItemId },
    include: { selections: true },
  });
  const previewMatch = findMatchingCartLine(previewCandidates, incomingKey);

  if (previewMatch) {
    await enforceGroupOrderCartMutation(cartId, groupOrderActor ?? null, {
      kind: "mutate",
      cartItemId: previewMatch.id,
    });
  } else {
    await enforceGroupOrderCartMutation(cartId, groupOrderActor ?? null, { kind: "add" });
  }

  if (isAddToCartTraceEnabled()) {
    console.log("[addCartItem] pre-write", {
      cartId,
      incomingKey,
      candidateLineIds: previewCandidates.map((c) => c.id),
      matchingLineId: previewMatch?.id ?? null,
      willCreate: !previewMatch,
    });
  }

  await prisma.$transaction(async (tx) => {
    await assertGroupCartUnlockedForMutation(tx, cartId, groupOrderActor ?? null);

    const candidates = await tx.cartItem.findMany({
      where: { cartId, menuItemId: resolvedMenuItemId },
      include: { selections: true },
    });
    const row = findMatchingCartLine(candidates, incomingKey);

    if (row) {
      if (isAddToCartTraceEnabled()) {
        console.log("[addCartItem] tx path=update", { cartItemId: row.id });
      }
      await tx.cartItem.update({
        where: { id: row.id },
        data: {
          quantity: row.quantity + quantity,
          specialInstructions: specialInstructions ?? row.specialInstructions,
          ...(selections != null ? { priceCents: priceCentsToStore } : {}),
        },
      });
      if (selections != null) {
        await tx.cartItemSelection.deleteMany({ where: { cartItemId: row.id } });
        for (const s of selectionsForLeaf) {
          if (s.quantity < 1) continue;
          await tx.cartItemSelection.create({
            data: { cartItemId: row.id, modifierOptionId: s.modifierOptionId, quantity: s.quantity },
          });
        }
      }
    } else {
      const created = await tx.cartItem.create({
        data: {
          cartId,
          menuItemId: resolvedMenuItemId,
          vendorId: menuItemResolved.vendorId,
          quantity,
          priceCents: priceCentsToStore,
          specialInstructions: specialInstructions ?? null,
          groupOrderParticipantId: groupOrderActor?.participantId ?? null,
        },
      });
      if (isAddToCartTraceEnabled()) {
        console.log("[addCartItem] tx path=create", { cartItemId: created.id });
      }
      if (selectionsForLeaf.length > 0) {
        for (const s of selectionsForLeaf) {
          if (s.quantity < 1) continue;
          await tx.cartItemSelection.create({
            data: { cartItemId: created.id, modifierOptionId: s.modifierOptionId, quantity: s.quantity },
          });
        }
      }
    }
  });

  if (isAddToCartTraceEnabled()) {
    console.log("[addCartItem] write complete, loading cart via getCartByIdForMutation");
  }

  return getCartByIdForMutationOrThrow(cartId, groupOrderActor);
}

export async function updateCartItem(
  cartId: string,
  cartItemId: string,
  quantity: number,
  specialInstructions?: string | null,
  selections?: CartItemSelectionInput[] | null,
  groupOrderActor?: ResolvedGroupCartActor | null
): Promise<Cart> {
  if (quantity <= 0) {
    await enforceGroupOrderCartMutation(cartId, groupOrderActor ?? null, {
      kind: "mutate",
      cartItemId,
    });
    await prisma.cartItem.deleteMany({ where: { id: cartItemId, cartId } });
    return getCartByIdForMutationOrThrow(cartId, groupOrderActor);
  }
  const existingItem = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId },
    include: {
      menuItem: true,
      selections: { include: { modifierOption: true } },
    },
  });
  if (!existingItem) return getCartByIdForMutationOrThrow(cartId, groupOrderActor);

  await enforceGroupOrderCartMutation(cartId, groupOrderActor ?? null, {
    kind: "mutate",
    cartItemId,
  });

  const operationalByVendor = new Map<string, Set<string>>();
  await requireOperationalMenuItem(
    operationalByVendor,
    existingItem.menuItem.vendorId,
    existingItem.menuItemId,
    existingItem.menuItem.name,
    { cartItemId }
  );

  if (selections != null) {
    const menuItemInitial = await loadMenuItemForVariantResolution(existingItem.menuItemId);
    if (!menuItemInitial) {
      throw new CartValidationError("Menu item not found.", "ITEM_NOT_FOUND", { cartItemId });
    }
    if (
      menuItemInitial.id !== existingItem.menuItemId ||
      menuItemInitial.vendorId !== existingItem.menuItem.vendorId
    ) {
      await requireOperationalMenuItem(
        operationalByVendor,
        menuItemInitial.vendorId,
        menuItemInitial.id,
        menuItemInitial.name,
        { cartItemId }
      );
    }
    if (!menuItemInitial.isAvailable) {
      throw new CartValidationError(`${menuItemInitial.name} is no longer available.`, "ITEM_UNAVAILABLE", {
        cartItemId,
        menuItemId: menuItemInitial.id,
        menuItemName: menuItemInitial.name,
      });
    }

    const selectionsWithImplicitVariant = await augmentSelectionsWithImplicitVariantFromLeaf(
      menuItemInitial,
      selections ?? []
    );

    /** Validate only after resolve: merged UI sends parent + leaf option ids; parent graph does not list leaf ids. */
    const { menuItem: menuItemResolved, selections: selectionsResolved, variantSelectionsPriceCents } =
      await resolveDeliverectVariantLeafForCartLine({
        menuItem: menuItemInitial,
        selections: selectionsWithImplicitVariant,
      });

    const shellBase = await shellBasePriceCentsForMenuItem(menuItemInitial);
    const baseUnitCents = shellBase + variantSelectionsPriceCents;

    if (
      menuItemResolved.id !== menuItemInitial.id ||
      menuItemResolved.vendorId !== menuItemInitial.vendorId
    ) {
      await requireOperationalMenuItem(
        operationalByVendor,
        menuItemResolved.vendorId,
        menuItemResolved.id,
        menuItemResolved.name,
        { cartItemId }
      );
    }
    if (!menuItemResolved.isAvailable) {
      throw new CartValidationError(`${menuItemResolved.name} is no longer available.`, "ITEM_UNAVAILABLE", {
        cartItemId,
        menuItemId: menuItemResolved.id,
        menuItemName: menuItemResolved.name,
      });
    }

    const selectionsForLeaf = selectionsResolved ?? [];
    const hasModifierGroupsResolved = menuItemResolved.modifierGroups.length > 0;
    if (hasModifierGroupsResolved || selectionsForLeaf.length > 0) {
      const modLeaf = await validateCartItemModifiers({
        id: cartItemId,
        menuItemId: menuItemResolved.id,
        quantity,
        menuItem: {
          name: menuItemResolved.name,
          isAvailable: menuItemResolved.isAvailable,
          basketMaxQuantity: menuItemResolved.basketMaxQuantity ?? undefined,
        },
        selections: selectionsForLeaf,
      });
      if (!modLeaf.valid) {
        throw new CartValidationError(modLeaf.message, modLeaf.code, {
          cartItemId: modLeaf.cartItemId,
          menuItemId: modLeaf.menuItemId,
          menuItemName: modLeaf.menuItemName,
        });
      }
    }

    const effectiveUnitPriceCents =
      selectionsForLeaf.length > 0
        ? (() => {
            const optionIds = [...new Set(selectionsForLeaf.map((s) => s.modifierOptionId))];
            return prisma.modifierOption
              .findMany({ where: { id: { in: optionIds } }, select: { id: true, priceCents: true } })
              .then((opts) => {
                const byId = new Map(opts.map((o) => [o.id, o.priceCents]));
                const withPrices = selectionsForLeaf
                  .filter((s) => s.quantity >= 1)
                  .map((s) => ({ priceCents: byId.get(s.modifierOptionId) ?? 0, quantity: s.quantity }));
                return computeEffectiveUnitPriceCents(baseUnitCents, withPrices);
              });
          })()
        : Promise.resolve(baseUnitCents);

    const priceCentsToStore = await effectiveUnitPriceCents;

    await prisma.cartItemSelection.deleteMany({ where: { cartItemId } });
    for (const s of selectionsForLeaf) {
      if (s.quantity < 1) continue;
      await prisma.cartItemSelection.create({
        data: { cartItemId, modifierOptionId: s.modifierOptionId, quantity: s.quantity },
      });
    }
    await prisma.cartItem.updateMany({
      where: { id: cartItemId, cartId },
      data: {
        quantity,
        priceCents: priceCentsToStore,
        menuItemId: menuItemResolved.id,
        vendorId: menuItemResolved.vendorId,
        ...(specialInstructions !== undefined ? { specialInstructions: specialInstructions === "" ? null : specialInstructions } : {}),
      },
    });
    return getCartByIdForMutationOrThrow(cartId, groupOrderActor);
  }

  // Quantity / notes-only updates must still enforce current menu + modifier availability (re-publish / snooze).
  const stillOrderable = await isMenuItemEffectivelyAvailable({
    id: existingItem.menuItem.id,
    vendorId: existingItem.menuItem.vendorId,
    deliverectProductId: existingItem.menuItem.deliverectProductId,
    isAvailable: existingItem.menuItem.isAvailable,
  });
  if (!stillOrderable) {
    throw new CartValidationError(`${existingItem.menuItem.name} is no longer available.`, "ITEM_UNAVAILABLE", {
      cartItemId,
      menuItemId: existingItem.menuItemId,
      menuItemName: existingItem.menuItem.name,
    });
  }
  const persistedSelections = existingItem.selections.map((s) => ({
    modifierOptionId: s.modifierOptionId,
    quantity: s.quantity,
  }));
  const menuItemForPersistedCheck = await loadMenuItemForVariantResolution(existingItem.menuItemId);
  if (!menuItemForPersistedCheck) {
    throw new CartValidationError("Menu item not found.", "ITEM_NOT_FOUND", { cartItemId });
  }
  const menuItemForPersistedValidation = await menuItemForModifierValidation(menuItemForPersistedCheck);
  const modResult = await validateCartItemModifiers({
    id: cartItemId,
    menuItemId: menuItemForPersistedValidation.id,
    quantity,
    menuItem: {
      name: menuItemForPersistedValidation.name,
      isAvailable: menuItemForPersistedValidation.isAvailable,
      basketMaxQuantity: menuItemForPersistedValidation.basketMaxQuantity ?? undefined,
    },
    selections: persistedSelections,
  });
  if (!modResult.valid) {
    throw new CartValidationError(modResult.message, modResult.code, {
      cartItemId: modResult.cartItemId ?? cartItemId,
      menuItemId: modResult.menuItemId,
      menuItemName: modResult.menuItemName,
    });
  }

  const data: { quantity: number; specialInstructions?: string | null } = { quantity };
  if (specialInstructions !== undefined) {
    data.specialInstructions = specialInstructions === "" ? null : specialInstructions;
  }
  await prisma.cartItem.updateMany({
    where: { id: cartItemId, cartId },
    data,
  });
  return getCartByIdForMutationOrThrow(cartId, groupOrderActor);
}

export async function removeCartItem(
  cartId: string,
  cartItemId: string,
  groupOrderActor?: ResolvedGroupCartActor | null
): Promise<Cart> {
  await enforceGroupOrderCartMutation(cartId, groupOrderActor ?? null, {
    kind: "mutate",
    cartItemId,
  });
  await prisma.cartItem.deleteMany({ where: { id: cartItemId, cartId } });
  return getCartByIdForMutationOrThrow(cartId, groupOrderActor);
}

/**
 * Clear all items from the cart. Caller must own the cart via session or account user id.
 */
export async function clearCartForSession(
  cartId: string,
  sessionId: string | null,
  opts?: { authUserId?: string | null }
): Promise<Cart | null> {
  const access = await assertCartSessionAccess(cartId, sessionId, {
    authUserId: opts?.authUserId ?? null,
    mode: "mutate",
  });
  if (!access.ok) return null;
  await prisma.cartItem.deleteMany({ where: { cartId } });
  return getCartById(cartId);
}

/**
 * Clear the checkout cart snapshot for a placed order (by Order.sourceCartId).
 * Idempotent. Server-only; safe to call after payment success or customer cancel.
 */
export async function clearCheckoutSourceCartForOrder(orderId: string): Promise<void> {
  const row = await prisma.order.findUnique({
    where: { id: orderId },
    select: { sourceCartId: true },
  });
  if (!row?.sourceCartId) return;
  const cartId = row.sourceCartId;
  await prisma.cartItem.deleteMany({ where: { cartId } });
  await prisma.order.update({
    where: { id: orderId },
    data: { sourceCartId: null },
  });
}

/**
 * Defensive: unlink `Order.sourceCartId` for carts where checkout has moved past an unpaid snapshot
 * (anything except abandoned `pending_payment` or retryable `failed`). We intentionally do **not**
 * delete CartItem rows here: that used to wipe new baskets when the same cart id was reused after a
 * completed order still pointed at it, and it did not clear `sourceCartId` — so every /cart load
 * cleared items again. Line cleanup after successful payment remains `clearCheckoutSourceCartForOrder`.
 */
/**
 * /cart SSR: lean menu rows + selection labels — full modifier graph is loaded on demand for edit modal
 * ({@link loadCartEditModifierPayloadsForCartPage}) to avoid huge nested includes per line item.
 */
export const CART_DISPLAY_SESSION_CART_INCLUDE = {
  items: {
    include: {
      menuItem: {
        select: {
          id: true,
          vendorId: true,
          name: true,
          description: true,
          priceCents: true,
          imageUrl: true,
          sortOrder: true,
          isAvailable: true,
          basketMaxQuantity: true,
          deliverectProductId: true,
          deliverectPlu: true,
          deliverectVariantParentPlu: true,
          deliverectVariantParentName: true,
          deliverectCategoryId: true,
          _count: { select: { modifierGroups: true } },
        },
      },
      vendor: true,
      selections: { include: { modifierOption: true } },
    },
  },
  pod: true,
  groupOrderSession: { select: { status: true } },
} satisfies Prisma.CartInclude;

/**
 * /checkout SSR: line names + pricing only — no modifier graph or full menuItem rows.
 * Authoritative cart validation runs on POST /api/checkout via createOrderFromCart.
 */
export const CHECKOUT_SUMMARY_CART_INCLUDE = {
  items: {
    include: {
      menuItem: {
        select: {
          name: true,
          deliverectPlu: true,
          deliverectVariantParentPlu: true,
        },
      },
      vendor: { select: { id: true, name: true } },
    },
  },
  pod: {
    select: {
      id: true,
      name: true,
      pickupSalesTaxBps: true,
      pickupTimezone: true,
    },
  },
} satisfies Prisma.CartInclude;

export async function discardStaleCheckoutCartsForSession(sessionId: string): Promise<void> {
  const carts = await prisma.cart.findMany({
    where: { sessionId, items: { some: {} } },
    select: { id: true },
  });

  if (DEBUG_DISCARD_STALE_CHECKOUT) {
    console.log("[discardStaleCheckoutCartsForSession] enter", {
      sessionId,
      cartIdsConsidered: carts.map((c) => c.id),
    });
  }

  for (const { id: cartId } of carts) {
    const blockingOrders = await prisma.order.findMany({
      where: {
        sourceCartId: cartId,
        status: { notIn: ["pending_payment", "failed"] },
      },
      select: { id: true, status: true, sourceCartId: true },
    });

    if (DEBUG_DISCARD_STALE_CHECKOUT && blockingOrders.length > 0) {
      console.log("[discardStaleCheckoutCartsForSession] blocking orders for cart", {
        cartId,
        orders: blockingOrders.map((o) => ({ id: o.id, status: o.status })),
      });
    }

    if (blockingOrders.length === 0) continue;

    const itemCountBefore = await prisma.cartItem.count({ where: { cartId } });

    const unlinked = await unlinkCompletedCheckoutOrdersFromCart(cartId);

    const itemCountAfter = await prisma.cartItem.count({ where: { cartId } });

    if (DEBUG_DISCARD_STALE_CHECKOUT) {
      console.log("[discardStaleCheckoutCartsForSession] unlinked orders from cart (no CartItem delete)", {
        cartId,
        orderIdsUnlinked: blockingOrders.map((o) => o.id),
        unlinkedCount: unlinked,
        itemCountBefore,
        itemCountAfter,
      });
    }
  }

  if (DEBUG_DISCARD_STALE_CHECKOUT) {
    console.log("[discardStaleCheckoutCartsForSession] done", { sessionId });
  }
}

/**
 * All session carts for /cart SSR, ordered by recency, then the same pod selection rule as checkout
 * validation (prefer `mennyu_current_pod` when that cart exists).
 */
export async function loadActiveDisplayCartForSession(
  sessionId: string,
  preferredPodId: string | null,
  /** Active group participant markers — loads shared group cart before solo fallback. */
  participantMarkers?: GroupOrderParticipantMarkers | null,
  authUserId?: string | null
) {
  if (participantMarkers && (participantMarkers.participantId || participantMarkers.legacyJoinToken)) {
    const gid = await resolveGroupCartIdFromParticipantMarkers(participantMarkers);
    if (gid) {
      const row = await prisma.cart.findUnique({
        where: { id: gid },
        include: CART_DISPLAY_SESSION_CART_INCLUDE,
      });
      if (row) {
        await unlinkCompletedCheckoutOrdersFromCart(row.id);
        return row;
      }
    }
  }

  const uid = authUserId?.trim() || null;
  if (uid) {
    const accountCartId = await findActiveAccountSoloCartId(uid, preferredPodId);
    if (accountCartId) {
      const row = await prisma.cart.findUnique({
        where: { id: accountCartId },
        include: CART_DISPLAY_SESSION_CART_INCLUDE,
      });
      if (row) {
        await unlinkCompletedCheckoutOrdersFromCart(row.id);
        return row;
      }
    }
    return undefined;
  }

  const rows = await prisma.cart.findMany({
    where: { sessionId, userId: null },
    include: CART_DISPLAY_SESSION_CART_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  const assigned = selectAssignedSessionCart(rows);
  if (assigned) return assigned;
  return undefined;
}

async function hostParticipantCount(cartId: string): Promise<number | undefined> {
  const session = await findSessionByCartId(cartId);
  return session?.participants.length;
}

async function packageQuickCartForActiveAssignment(params: {
  assignedPodId: string;
  assignedPodName: string;
  assignedPodSlug: string;
  cart: Cart;
  scope: CartPodScope;
  browsePodId: string | null;
  browsePodName: string | null;
  browsePodSlug?: string | null;
}): Promise<QuickCartApiResponse> {
  const requiresClearToSwitchPod = Boolean(
    params.browsePodId && params.browsePodId !== params.assignedPodId
  );
  const showFullCartInDrawer = shouldShowFullCartInQuickCartDrawer({
    scope: params.scope,
    browsePodId: params.browsePodId,
    assignedPodId: params.assignedPodId,
  });
  const participantCount =
    params.cart.groupOrder?.role === "host"
      ? await hostParticipantCount(params.cart.id)
      : undefined;
  const activeCartRecovery = buildActiveCartRecovery({
    cart: params.cart,
    browsePodId: params.browsePodId,
    browsePodName: params.browsePodName,
    podSlug: params.assignedPodSlug,
    participantCount,
  });

  if (showFullCartInDrawer) {
    return {
      scope: params.scope,
      cart: params.cart,
      browsingPodId: params.browsePodId,
      browsingPodName: params.browsePodName,
      browsingPodSlug: params.browsePodSlug ?? null,
      assignedPodId: params.assignedPodId,
      assignedPodName: params.assignedPodName,
      assignedPodSlug: params.assignedPodSlug,
      requiresClearToSwitchPod: false,
      activeCartRecovery,
    };
  }

  return {
    scope: requiresClearToSwitchPod ? "browsing_pod" : "neutral",
    cart: null,
    browsingPodId: params.browsePodId,
    browsingPodName: params.browsePodName,
    browsingPodSlug: params.browsePodSlug ?? null,
    assignedPodId: params.assignedPodId,
    assignedPodName: params.assignedPodName,
    assignedPodSlug: params.assignedPodSlug,
    requiresClearToSwitchPod,
    activeCartRecovery,
  };
}

/**
 * Clear solo cart lines so the user can order from another pod. Refuses active group orders.
 */
export async function clearActiveSoloCartForSessionSwitch(
  cartId: string,
  sessionId: string | null,
  opts?: { authUserId?: string | null }
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const access = await assertCartSessionAccess(cartId, sessionId, {
    authUserId: opts?.authUserId ?? null,
    mode: "mutate",
  });
  if (!access.ok) {
    return { ok: false, code: "NOT_FOUND", message: "Cart not found or access denied." };
  }
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: {
      groupOrderSession: { select: { status: true } },
    },
  });
  if (isActiveGroupSessionStatus(cart?.groupOrderSession?.status)) {
    return {
      ok: false,
      code: "GROUP_ORDER_ACTIVE",
      message:
        "Leave or finish your group order before starting a new pod order.",
    };
  }
  await prisma.cartItem.deleteMany({ where: { cartId } });
  return { ok: true };
}

/**
 * Quick Cart read model: never creates a cart row; separates browsing pod from assigned cart.
 */
export async function getQuickCartPayload(
  sessionId: string,
  browsePodId: string | null,
  opts: { markers: GroupOrderParticipantMarkers; hostUserId: string | null }
): Promise<QuickCartApiResponse> {
  const neutral: QuickCartApiResponse = {
    scope: "neutral",
    cart: null,
    browsingPodId: null,
    browsingPodName: null,
    assignedPodId: null,
    assignedPodName: null,
    requiresClearToSwitchPod: false,
  };

  const groupCartIdFromContext = browsePodId
    ? await resolveActiveGroupCartIdForPod(browsePodId, {
        markers: opts.markers,
        hostUserId: opts.hostUserId,
      })
    : ((await resolveGroupCartIdFromParticipantMarkers(opts.markers)) ??
        (opts.hostUserId
          ? await resolveHostActiveGroupCartId(opts.hostUserId)
          : null));

  if (groupCartIdFromContext) {
    const row = await prisma.cart.findUnique({
      where: { id: groupCartIdFromContext },
      include: CART_SESSION_FULL_INCLUDE,
    });
    if (row) {
      const actor = await resolveGroupCartActorForRead(groupCartIdFromContext, {
        hostUserId: opts.hostUserId,
        participantIdFromCookie: opts.markers.participantId,
        joinTokenFromCookie: opts.markers.legacyJoinToken,
      });
      const scoped = await scopeCartForGroupViewer(row, groupCartIdFromContext, actor, "group_order");
      const browsePodName = browsePodId
        ? (await prisma.pod.findUnique({ where: { id: browsePodId }, select: { name: true, slug: true } })) ??
          null
        : null;
      return packageQuickCartForActiveAssignment({
        assignedPodId: scoped.podId,
        assignedPodName: scoped.podName ?? row.pod.name,
        assignedPodSlug: row.pod.slug,
        cart: scoped,
        scope: "group_order",
        browsePodId,
        browsePodName: browsePodName?.name ?? null,
        browsePodSlug: browsePodName?.slug ?? null,
      });
    }
  }

  const signedInUserId = opts.hostUserId?.trim() || null;
  if (signedInUserId) {
    const accountCartId = await findActiveAccountSoloCartId(signedInUserId, browsePodId);
    if (accountCartId) {
      const row = await prisma.cart.findUnique({
        where: { id: accountCartId },
        include: CART_SESSION_FULL_INCLUDE,
      });
      if (row) {
        const scoped = await scopeCartForGroupViewer(row, accountCartId, null, "assigned_pod");
        const browsePod = browsePodId
          ? await prisma.pod.findUnique({
              where: { id: browsePodId },
              select: { name: true, slug: true },
            })
          : null;
        return packageQuickCartForActiveAssignment({
          assignedPodId: scoped.podId,
          assignedPodName: scoped.podName ?? row.pod.name,
          assignedPodSlug: row.pod.slug,
          cart: scoped,
          scope: "assigned_pod",
          browsePodId,
          browsePodName: browsePod?.name ?? null,
          browsePodSlug: browsePod?.slug ?? null,
        });
      }
    }
  }

  const sessionRows = await prisma.cart.findMany({
    where: { sessionId, userId: null },
    include: CART_SESSION_FULL_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  const assignedRow = selectAssignedSessionCart(sessionRows);

  if (assignedRow) {
    const actor = await resolveGroupCartActorForRead(assignedRow.id, {
      hostUserId: opts.hostUserId,
      participantIdFromCookie: opts.markers.participantId,
      joinTokenFromCookie: opts.markers.legacyJoinToken,
    });
    const scope: CartPodScope =
      assignedRow.groupOrderSession &&
      ACTIVE_GROUP_SESSION_STATUSES.includes(
        assignedRow.groupOrderSession.status as (typeof ACTIVE_GROUP_SESSION_STATUSES)[number]
      )
        ? "group_order"
        : "assigned_pod";
    const cart = await scopeCartForGroupViewer(assignedRow, assignedRow.id, actor, scope);
    const browsePod = browsePodId
      ? await prisma.pod.findUnique({
          where: { id: browsePodId },
          select: { name: true, slug: true },
        })
      : null;
    return packageQuickCartForActiveAssignment({
      assignedPodId: assignedRow.podId,
      assignedPodName: assignedRow.pod.name,
      assignedPodSlug: assignedRow.pod.slug,
      cart,
      scope,
      browsePodId,
      browsePodName: browsePod?.name ?? null,
      browsePodSlug: browsePod?.slug ?? null,
    });
  }

  if (!browsePodId) {
    return neutral;
  }

  const browsePod = await prisma.pod.findUnique({
    where: { id: browsePodId, isActive: true },
    select: { id: true, name: true, slug: true },
  });
  if (!browsePod) {
    return neutral;
  }

  const browseRow = sessionRows.find((r) => r.podId === browsePodId);
  if (browseRow) {
    const browseGroupCartId = await resolveActiveGroupCartIdForPod(browsePodId, {
      markers: opts.markers,
      hostUserId: opts.hostUserId,
    });
    if (browseGroupCartId) {
      const groupRow = await prisma.cart.findUnique({
        where: { id: browseGroupCartId },
        include: CART_SESSION_FULL_INCLUDE,
      });
      if (groupRow) {
        const actor = await resolveGroupCartActorForRead(browseGroupCartId, {
          hostUserId: opts.hostUserId,
          participantIdFromCookie: opts.markers.participantId,
          joinTokenFromCookie: opts.markers.legacyJoinToken,
        });
        const scoped = await scopeCartForGroupViewer(groupRow, browseGroupCartId, actor, "group_order");
        return packageQuickCartForActiveAssignment({
          assignedPodId: scoped.podId,
          assignedPodName: scoped.podName ?? groupRow.pod.name,
          assignedPodSlug: groupRow.pod.slug,
          cart: scoped,
          scope: "group_order",
          browsePodId: browsePod.id,
          browsePodName: browsePod.name,
          browsePodSlug: browsePod.slug,
        });
      }
    }
    const cart = await scopeCartForGroupViewer(browseRow, browseRow.id, null, "browsing_pod");
    return {
      scope: "browsing_pod",
      cart,
      browsingPodId: browsePod.id,
      browsingPodName: browsePod.name,
      browsingPodSlug: browsePod.slug,
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    };
  }

  return {
    scope: "browsing_pod",
    cart: null,
    browsingPodId: browsePod.id,
    browsingPodName: browsePod.name,
    browsingPodSlug: browsePod.slug,
    assignedPodId: null,
    assignedPodName: null,
    requiresClearToSwitchPod: false,
  };
}

/** @deprecated Use getQuickCartPayload — read-only, no cart creation. */
export async function getActiveScopedCartForPod(
  podId: string,
  sessionId: string,
  opts: { markers: GroupOrderParticipantMarkers; hostUserId: string | null }
): Promise<Cart> {
  const payload = await getQuickCartPayload(sessionId, podId, opts);
  if (payload.cart) return payload.cart;
  return getOrCreateCart(podId, sessionId);
}

export async function getCartById(
  cartId: string,
  groupOrderActor?: ResolvedGroupCartActor | null
): Promise<Cart | null> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: CART_SESSION_FULL_INCLUDE,
  });
  if (!cart) return null;
  return scopeCartForGroupViewer(cart, cartId, groupOrderActor);
}
function toCartWithGroups(
  cart: {
    id: string;
    podId: string;
    sessionId: string;
    items: Array<{
      id: string;
      menuItemId: string;
      vendorId: string;
      quantity: number;
      priceCents: number;
      specialInstructions: string | null;
      menuItem: { name: string; deliverectPlu?: string | null; deliverectVariantParentPlu?: string | null };
      vendor: { name: string };
      selections?: Array<{
        modifierOptionId: string;
        quantity: number;
        modifierOption: { name: string; priceCents: number };
      }>;
    }>;
  }
): Cart {
  const byVendor = new Map<string, { vendorName: string; items: CartItem[]; subtotalCents: number }>();
  let subtotalCents = 0;

  for (const item of cart.items) {
    // Stored priceCents is already effective unit price (base + modifiers) when item was added/updated with selections.
    const unitPriceCents = item.priceCents;
    const lineTotal = unitPriceCents * item.quantity;
    subtotalCents += lineTotal;
    const existing = byVendor.get(item.vendorId);
    const cartItem: CartItem = {
      id: item.id,
      menuItemId: item.menuItemId,
      vendorId: item.vendorId,
      quantity: item.quantity,
      priceCents: item.priceCents,
      specialInstructions: item.specialInstructions,
      menuItem: {
        name: item.menuItem.name,
        deliverectPlu: item.menuItem.deliverectPlu ?? undefined,
        deliverectVariantParentPlu: item.menuItem.deliverectVariantParentPlu ?? undefined,
      },
      selections:
        item.selections?.map((s) => ({
          modifierOptionId: s.modifierOptionId,
          modifierOptionName: s.modifierOption.name,
          priceCents: s.modifierOption.priceCents,
          quantity: s.quantity,
        })),
    };
    if (existing) {
      existing.items.push(cartItem);
      existing.subtotalCents += lineTotal;
    } else {
      byVendor.set(item.vendorId, {
        vendorName: item.vendor.name,
        items: [cartItem],
        subtotalCents: lineTotal,
      });
    }
  }

  const groups: CartGroup[] = Array.from(byVendor.entries()).map(([vendorId, v]) => ({
    vendorId,
    vendorName: v.vendorName,
    items: v.items,
    subtotalCents: v.subtotalCents,
  }));

  return {
    id: cart.id,
    podId: cart.podId,
    sessionId: cart.sessionId,
    items: cart.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      vendorId: i.vendorId,
      quantity: i.quantity,
      priceCents: i.priceCents,
      specialInstructions: i.specialInstructions,
      menuItem: {
        name: i.menuItem.name,
        deliverectPlu: i.menuItem.deliverectPlu ?? undefined,
        deliverectVariantParentPlu: i.menuItem.deliverectVariantParentPlu ?? undefined,
      },
      selections: i.selections?.map((s) => ({
        modifierOptionId: s.modifierOptionId,
        modifierOptionName: s.modifierOption.name,
        priceCents: s.modifierOption.priceCents,
        quantity: s.quantity,
      })),
    })),
    groups,
    subtotalCents,
  };
}
