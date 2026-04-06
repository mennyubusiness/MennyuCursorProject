/**
 * Cart business logic: create/update cart by session + pod; add/update/remove items; group by vendor.
 * Cart is session-scoped (one per pod per session). Future multi-user/group ordering could
 * introduce a shared cart or order-group id while keeping single-payer and this session model.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Cart, CartGroup, CartItem } from "@/domain/types";
import { computeEffectiveUnitPriceCents } from "@/domain/money";
import { validateCartItemModifiers } from "@/services/modifier-validation";
import { getVendorAvailability } from "@/lib/vendor-availability";
import { selectCartForSessionAndPod } from "@/lib/cart-selection";
import { isMenuItemEffectivelyAvailable } from "@/services/menu-item-availability.service";
import { isMenuItemIdOperational } from "@/services/menu-active-scope.service";
import { normalizedConfigurationKey } from "@/lib/cart-line-identity";
import {
  augmentSelectionsWithImplicitVariantFromLeaf,
  loadMenuItemForVariantResolution,
  menuItemForModifierValidation,
  resolveDeliverectVariantLeafForCartLine,
  shellBasePriceCentsForMenuItem,
} from "@/services/cart-deliverect-variant-resolution";
import { CartValidationError } from "@/services/cart-validation-error";

export { CartValidationError } from "@/services/cart-validation-error";

/** TEMP: set false to silence add-to-cart trace logs */
const DEBUG_ADD_TO_CART_TRACE = true;

/** TEMP: set false to silence stale-checkout unlink trace logs */
const DEBUG_DISCARD_STALE_CHECKOUT = true;

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

export async function getOrCreateCart(podId: string, sessionId: string): Promise<Cart> {
  let cart = await prisma.cart.findUnique({
    where: { podId_sessionId: { podId, sessionId } },
    include: {
      items: {
        include: {
          menuItem: true,
          vendor: true,
          selections: { include: { modifierOption: true } },
        },
      },
      pod: true,
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { podId, sessionId },
      include: {
        items: {
          include: {
            menuItem: true,
            vendor: true,
            selections: { include: { modifierOption: true } },
          },
        },
        pod: true,
      },
    });
  }

  await unlinkCompletedCheckoutOrdersFromCart(cart.id);

  return toCartWithGroups(cart);
}

export type CartItemSelectionInput = { modifierOptionId: string; quantity: number };

export async function addCartItem(
  cartId: string,
  menuItemId: string,
  quantity: number,
  specialInstructions?: string | null,
  selections?: CartItemSelectionInput[] | null
): Promise<Cart> {
  if (DEBUG_ADD_TO_CART_TRACE) {
    console.log("[addCartItem] enter", { cartId, menuItemId, quantity });
  }
  const menuItemInitial = await loadMenuItemForVariantResolution(menuItemId);
  if (!menuItemInitial) {
    if (DEBUG_ADD_TO_CART_TRACE) {
      console.error("[addCartItem] MenuItem not found", { menuItemId });
    }
    throw new Error("MenuItem not found");
  }
  if (DEBUG_ADD_TO_CART_TRACE) {
    console.log("[addCartItem] menuItem loaded", {
      menuItemId: menuItemInitial.id,
      vendorId: menuItemInitial.vendorId,
      name: menuItemInitial.name,
    });
  }
  if (!(await isMenuItemIdOperational(menuItemInitial.vendorId, menuItemInitial.id))) {
    throw new CartValidationError(`${menuItemInitial.name} is not on the current menu.`, "ITEM_NOT_IN_CURRENT_MENU", {
      menuItemId: menuItemInitial.id,
      menuItemName: menuItemInitial.name,
    });
  }
  if (!menuItemInitial.isAvailable) {
    throw new CartValidationError(`${menuItemInitial.name} is no longer available.`, "ITEM_UNAVAILABLE", {
      menuItemId: menuItemInitial.id,
      menuItemName: menuItemInitial.name,
    });
  }
  const vendorAvailability = getVendorAvailability(menuItemInitial.vendor);
  if (!vendorAvailability.orderable) {
    const message =
      vendorAvailability.status === "inactive"
        ? "This vendor is no longer active."
        : vendorAvailability.status === "closed"
          ? "This vendor is currently closed."
          : "This vendor is not accepting Mennyu orders right now. Try again later.";
    const code =
      vendorAvailability.status === "inactive"
        ? "VENDOR_INACTIVE"
        : vendorAvailability.status === "closed"
          ? "VENDOR_CLOSED"
          : "VENDOR_PAUSED_MENNYU";
    throw new CartValidationError(message, code);
  }

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: true },
  });
  if (!cart) throw new Error("Cart not found");
  const vendorInPod = await prisma.podVendor.findUnique({
    where: {
      podId_vendorId: { podId: cart.podId, vendorId: menuItemInitial.vendorId },
    },
  });
  if (!vendorInPod) throw new Error("Menu item vendor is not in this pod");

  /** Validate modifiers only after variant resolution: parent shell graphs do not include leaf-only option ids. */
  const { menuItem: menuItemResolved, selections: selectionsResolved, variantSelectionsPriceCents } =
    await resolveDeliverectVariantLeafForCartLine({
      menuItem: menuItemInitial,
      selections,
    });

  /** Parent shell list price + variant (size) charges — matches vendor modal (not leaf list + size). */
  const shellBase = await shellBasePriceCentsForMenuItem(menuItemInitial);
  const baseUnitCents = shellBase + variantSelectionsPriceCents;

  if (!(await isMenuItemIdOperational(menuItemResolved.vendorId, menuItemResolved.id))) {
    throw new CartValidationError(
      `${menuItemResolved.name} is not on the current menu.`,
      "ITEM_NOT_IN_CURRENT_MENU",
      { menuItemId: menuItemResolved.id, menuItemName: menuItemResolved.name }
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

  if (DEBUG_ADD_TO_CART_TRACE) {
    const previewCandidates = await prisma.cartItem.findMany({
      where: { cartId, menuItemId: resolvedMenuItemId },
      include: { selections: true },
    });
    const previewMatch =
      previewCandidates.find((c) => {
        const key = normalizedConfigurationKey(
          c.specialInstructions,
          c.selections.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity }))
        );
        return key === incomingKey;
      }) ?? null;
    console.log("[addCartItem] pre-write", {
      cartId,
      incomingKey,
      candidateLineIds: previewCandidates.map((c) => c.id),
      matchingLineId: previewMatch?.id ?? null,
      willCreate: !previewMatch,
    });
  }

  /** All CartItem / CartItemSelection writes in one transaction (no implicit rollback otherwise — each await used to commit separately). */
  let writePath: "update" | "create";
  let primaryCartItemId: string;

  await prisma.$transaction(async (tx) => {
    const candidates = await tx.cartItem.findMany({
      where: { cartId, menuItemId: resolvedMenuItemId },
      include: { selections: true },
    });

    const row =
      candidates.find((c) => {
        const key = normalizedConfigurationKey(
          c.specialInstructions,
          c.selections.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity }))
        );
        return key === incomingKey;
      }) ?? null;

    if (row) {
      writePath = "update";
      primaryCartItemId = row.id;
      if (DEBUG_ADD_TO_CART_TRACE) {
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
      writePath = "create";
      const created = await tx.cartItem.create({
        data: {
          cartId,
          menuItemId: resolvedMenuItemId,
          vendorId: menuItemResolved.vendorId,
          quantity,
          priceCents: priceCentsToStore,
          specialInstructions: specialInstructions ?? null,
        },
      });
      primaryCartItemId = created.id;
      if (DEBUG_ADD_TO_CART_TRACE) {
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

    const verifyInTx = await tx.cartItem.findMany({
      where: { cartId },
      select: { id: true },
    });
    if (DEBUG_ADD_TO_CART_TRACE) {
      console.log("[addCartItem] verify inside transaction (before commit)", {
        cartId,
        count: verifyInTx.length,
        ids: verifyInTx.map((r) => r.id),
        primaryCartItemId,
        writePath,
      });
    }
  });

  if (DEBUG_ADD_TO_CART_TRACE) {
    const verifyAfterCommit = await prisma.cartItem.findMany({
      where: { cartId },
      select: { id: true },
    });
    console.log("[addCartItem] verify after transaction (committed)", {
      cartId,
      count: verifyAfterCommit.length,
      ids: verifyAfterCommit.map((r) => r.id),
    });
    console.log("[addCartItem] write complete, loading cart via getCartById (itemCount will be from this query)");
  }

  return getCartByIdOrThrow(cartId);
}

export async function updateCartItem(
  cartId: string,
  cartItemId: string,
  quantity: number,
  specialInstructions?: string | null,
  selections?: CartItemSelectionInput[] | null
): Promise<Cart> {
  if (quantity <= 0) {
    await prisma.cartItem.deleteMany({ where: { id: cartItemId, cartId } });
    return getCartByIdOrThrow(cartId);
  }
  const existingItem = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cartId },
    include: {
      menuItem: true,
      selections: { include: { modifierOption: true } },
    },
  });
  if (!existingItem) return getCartByIdOrThrow(cartId);

  if (!(await isMenuItemIdOperational(existingItem.menuItem.vendorId, existingItem.menuItemId))) {
    throw new CartValidationError(
      `${existingItem.menuItem.name} is not on the current menu.`,
      "ITEM_NOT_IN_CURRENT_MENU",
      {
        cartItemId,
        menuItemId: existingItem.menuItemId,
        menuItemName: existingItem.menuItem.name,
      }
    );
  }

  if (selections != null) {
    const menuItemInitial = await loadMenuItemForVariantResolution(existingItem.menuItemId);
    if (!menuItemInitial) {
      throw new CartValidationError("Menu item not found.", "ITEM_NOT_FOUND", { cartItemId });
    }
    if (!(await isMenuItemIdOperational(menuItemInitial.vendorId, menuItemInitial.id))) {
      throw new CartValidationError(
        `${menuItemInitial.name} is not on the current menu.`,
        "ITEM_NOT_IN_CURRENT_MENU",
        {
          cartItemId,
          menuItemId: menuItemInitial.id,
          menuItemName: menuItemInitial.name,
        }
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

    if (!(await isMenuItemIdOperational(menuItemResolved.vendorId, menuItemResolved.id))) {
      throw new CartValidationError(
        `${menuItemResolved.name} is not on the current menu.`,
        "ITEM_NOT_IN_CURRENT_MENU",
        {
          cartItemId,
          menuItemId: menuItemResolved.id,
          menuItemName: menuItemResolved.name,
        }
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
    return getCartByIdOrThrow(cartId);
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
  return getCartByIdOrThrow(cartId);
}

export async function removeCartItem(cartId: string, cartItemId: string): Promise<Cart> {
  await prisma.cartItem.deleteMany({ where: { id: cartItemId, cartId } });
  return getCartByIdOrThrow(cartId);
}

/**
 * Clear all items from the cart. Only succeeds if the cart belongs to the given session
 * (avoids clearing another session's cart). Use after successful order placement.
 */
export async function clearCartForSession(cartId: string, sessionId: string): Promise<Cart | null> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    select: { id: true, sessionId: true },
  });
  if (!cart || cart.sessionId !== sessionId) return null;
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
  preferredPodId: string | null
) {
  const rows = await prisma.cart.findMany({
    where: { sessionId },
    include: CART_DISPLAY_SESSION_CART_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  return selectCartForSessionAndPod(rows, preferredPodId);
}

export async function getCartById(cartId: string): Promise<Cart | null> {
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          menuItem: true,
          vendor: true,
          selections: { include: { modifierOption: true } },
        },
      },
      pod: true,
    },
  });
  return cart ? toCartWithGroups(cart) : null;
}

/** Like getCartById but throws if cart not found. Use when caller contract is Promise<Cart>. */
async function getCartByIdOrThrow(cartId: string): Promise<Cart> {
  const cart = await getCartById(cartId);
  if (!cart) throw new Error("Cart not found");
  return cart;
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
