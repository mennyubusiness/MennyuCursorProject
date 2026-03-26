/**
 * Cart business logic: create/update cart by session + pod; add/update/remove items; group by vendor.
 * Cart is session-scoped (one per pod per session). Future multi-user/group ordering could
 * introduce a shared cart or order-group id while keeping single-payer and this session model.
 */
import { prisma } from "@/lib/db";
import type { Cart, CartGroup, CartItem } from "@/domain/types";
import { computeEffectiveUnitPriceCents } from "@/domain/money";
import { validateCartItemModifiers } from "@/services/modifier-validation";
import { getVendorAvailability } from "@/lib/vendor-availability";
import { selectCartForSessionAndPod } from "@/lib/cart-selection";

/** Thrown when add/update cart item fails validation (modifiers, availability, etc.). Callers can return structured JSON. */
export class CartValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: { cartItemId?: string; menuItemId?: string; menuItemName?: string }
  ) {
    super(message);
    this.name = "CartValidationError";
  }
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
  const menuItem = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    include: { vendor: true, modifierGroups: true },
  });
  if (!menuItem) {
    throw new Error("MenuItem not found");
  }
  if (!menuItem.isAvailable) {
    throw new CartValidationError(`${menuItem.name} is no longer available.`, "ITEM_UNAVAILABLE", {
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
    });
  }
  const vendorAvailability = getVendorAvailability(menuItem.vendor);
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
      podId_vendorId: { podId: cart.podId, vendorId: menuItem.vendorId },
    },
  });
  if (!vendorInPod) throw new Error("Menu item vendor is not in this pod");

  const hasModifierGroups = menuItem.modifierGroups.length > 0;
  const selectionsToValidate = selections ?? [];
  if (hasModifierGroups || selectionsToValidate.length > 0) {
    const modResult = await validateCartItemModifiers({
      id: "",
      menuItemId,
      quantity,
      menuItem: { name: menuItem.name, isAvailable: menuItem.isAvailable, basketMaxQuantity: menuItem.basketMaxQuantity ?? undefined },
      selections: selectionsToValidate,
    });
    if (!modResult.valid) {
      throw new CartValidationError(modResult.message, modResult.code, {
        menuItemId: modResult.menuItemId,
        menuItemName: modResult.menuItemName,
      });
    }
  }

  const effectiveUnitPriceCents =
    selections != null && selections.length > 0
      ? (() => {
          const optionIds = [...new Set(selections.map((s) => s.modifierOptionId))];
          return prisma.modifierOption
            .findMany({ where: { id: { in: optionIds } }, select: { id: true, priceCents: true } })
            .then((opts) => {
              const byId = new Map(opts.map((o) => [o.id, o.priceCents]));
              const withPrices = selections
                .filter((s) => s.quantity >= 1)
                .map((s) => ({ priceCents: byId.get(s.modifierOptionId) ?? 0, quantity: s.quantity }));
              return computeEffectiveUnitPriceCents(menuItem.priceCents, withPrices);
            });
        })()
      : Promise.resolve(menuItem.priceCents);

  const priceCentsToStore = await effectiveUnitPriceCents;

  const existing = await prisma.cartItem.findFirst({
    where: { cartId, menuItemId },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + quantity,
        specialInstructions: specialInstructions ?? existing.specialInstructions,
        ...(selections != null ? { priceCents: priceCentsToStore } : {}),
      },
    });
    if (selections != null) {
      await prisma.cartItemSelection.deleteMany({ where: { cartItemId: existing.id } });
      for (const s of selections) {
        if (s.quantity < 1) continue;
        await prisma.cartItemSelection.create({
          data: { cartItemId: existing.id, modifierOptionId: s.modifierOptionId, quantity: s.quantity },
        });
      }
    }
  } else {
    const created = await prisma.cartItem.create({
      data: {
        cartId,
        menuItemId,
        vendorId: menuItem.vendorId,
        quantity,
        priceCents: priceCentsToStore,
        specialInstructions: specialInstructions ?? null,
      },
    });
    if (selections != null && selections.length > 0) {
      for (const s of selections) {
        if (s.quantity < 1) continue;
        await prisma.cartItemSelection.create({
          data: { cartItemId: created.id, modifierOptionId: s.modifierOptionId, quantity: s.quantity },
        });
      }
    }
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

  if (selections != null) {
    const modResult = await validateCartItemModifiers({
      id: cartItemId,
      menuItemId: existingItem.menuItemId,
      quantity,
      menuItem: {
        name: existingItem.menuItem.name,
        isAvailable: existingItem.menuItem.isAvailable,
        basketMaxQuantity: existingItem.menuItem.basketMaxQuantity ?? undefined,
      },
      selections,
    });
    if (!modResult.valid) {
      throw new CartValidationError(modResult.message, modResult.code, {
        cartItemId: modResult.cartItemId,
        menuItemId: modResult.menuItemId,
        menuItemName: modResult.menuItemName,
      });
    }
    const optionIds = [...new Set(selections.map((s) => s.modifierOptionId))];
    const opts = await prisma.modifierOption.findMany({
      where: { id: { in: optionIds } },
      select: { id: true, priceCents: true },
    });
    const byId = new Map(opts.map((o) => [o.id, o.priceCents]));
    const withPrices = selections
      .filter((s) => s.quantity >= 1)
      .map((s) => ({ priceCents: byId.get(s.modifierOptionId) ?? 0, quantity: s.quantity }));
    const priceCentsToStore = computeEffectiveUnitPriceCents(existingItem.menuItem.priceCents, withPrices);
    await prisma.cartItemSelection.deleteMany({ where: { cartItemId } });
    for (const s of selections) {
      if (s.quantity < 1) continue;
      await prisma.cartItemSelection.create({
        data: { cartItemId, modifierOptionId: s.modifierOptionId, quantity: s.quantity },
      });
    }
    await prisma.cartItem.updateMany({
      where: { id: cartItemId, cartId },
      data: { quantity, priceCents: priceCentsToStore, ...(specialInstructions !== undefined ? { specialInstructions: specialInstructions === "" ? null : specialInstructions } : {}) },
    });
    return getCartByIdOrThrow(cartId);
  }

  // Quantity / notes-only updates must still enforce current menu + modifier availability (re-publish / snooze).
  if (!existingItem.menuItem.isAvailable) {
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
  const modResult = await validateCartItemModifiers({
    id: cartItemId,
    menuItemId: existingItem.menuItemId,
    quantity,
    menuItem: {
      name: existingItem.menuItem.name,
      isAvailable: existingItem.menuItem.isAvailable,
      basketMaxQuantity: existingItem.menuItem.basketMaxQuantity ?? undefined,
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
 * Defensive: drop persisted line items when the cart id is still linked to a checkout that has
 * moved past an unpaid snapshot (anything except abandoned `pending_payment` or retryable `failed`).
 * Keeps in-progress shopping and failed-payment / routing-failure carts intact.
 */
export async function discardStaleCheckoutCartsForSession(sessionId: string): Promise<void> {
  const carts = await prisma.cart.findMany({
    where: { sessionId, items: { some: {} } },
    select: { id: true },
  });
  for (const { id: cartId } of carts) {
    const blocking = await prisma.order.findFirst({
      where: {
        sourceCartId: cartId,
        status: { notIn: ["pending_payment", "failed"] },
      },
      select: { id: true },
    });
    if (blocking) {
      await prisma.cartItem.deleteMany({ where: { cartId } });
    }
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
      menuItem: { name: string };
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
      menuItem: { name: item.menuItem.name },
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
      menuItem: { name: i.menuItem.name },
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
