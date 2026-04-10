/**
 * Order creation and splitting: one parent order + N vendor orders + allocations.
 * Idempotent by idempotencyKey. Persist status history.
 */
import { type OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeOrderPricing } from "@/domain/fees";
import { getActivePricingRatesSnapshot } from "@/services/pricing-config.service";
import type { Order, VendorOrder as VendorOrderType, CheckoutInput } from "@/domain/types";
import { buildIdempotencyKey } from "@/lib/idempotency";
import {
  validateCartItemModifiers,
  validateCartItemModifiersWithLoadedMenuItem,
  validateCartBasketLimits,
  MODIFIER_VALIDATION_MENU_ITEM_INCLUDE,
} from "@/services/modifier-validation";
import { getVendorAvailability } from "@/lib/vendor-availability";
import {
  getOperationalMenuItemIdsForVendor,
  getOperationalModifierOptionIdsForVendor,
} from "@/services/menu-active-scope.service";
import { formatPickupDetailLine } from "@/lib/pickup-display";
import { computeEffectiveUnitPriceCents } from "@/domain/money";
import {
  deliverectSubItemsChainLimitMessage,
  isDeliverectSubItemsChainDepthAllowed,
  isTopLevelDeliverectVariantGroupModifierGroup,
  maxSubItemsChainVariantStepsForProductShape,
} from "@/lib/deliverect-subitem-nesting";
import {
  shellBasePriceCentsForMenuItem,
  variantSelectionsPriceCentsForLeafCartLine,
} from "@/services/cart-deliverect-variant-resolution";
import {
  getDefaultScheduledSuggestion,
  resolvePickupTimezone,
  validateScheduledPickup,
  wallTimeInZoneToUtc,
} from "@/lib/pickup-scheduling";
export interface CreateOrderResult {
  order: Order;
  vendorOrders: VendorOrderType[];
}

async function expectedCartItemUnitPriceCents(item: {
  vendorId: string;
  menuItem: {
    priceCents: number;
    deliverectPlu?: string | null;
    deliverectVariantParentPlu?: string | null;
  };
  selections?: Array<{ modifierOptionId: string; quantity: number; modifierOption?: { priceCents: number } }>;
}): Promise<number> {
  const shellBase = await shellBasePriceCentsForMenuItem({
    vendorId: item.vendorId,
    priceCents: item.menuItem.priceCents,
    deliverectVariantParentPlu: item.menuItem.deliverectVariantParentPlu ?? null,
  });
  const variantCharge = await variantSelectionsPriceCentsForLeafCartLine({
    vendorId: item.vendorId,
    deliverectPlu: item.menuItem.deliverectPlu ?? null,
    deliverectVariantParentPlu: item.menuItem.deliverectVariantParentPlu ?? null,
  });
  const base = shellBase + variantCharge;
  const withPrices =
    item.selections
      ?.filter((s) => s.quantity >= 1)
      .map((s) => ({
        priceCents: s.modifierOption?.priceCents ?? 0,
        quantity: s.quantity,
      })) ?? [];
  return computeEffectiveUnitPriceCents(base, withPrices);
}

export class OrderValidationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: { cartItemId?: string; menuItemId?: string; menuItemName?: string }
  ) {
    super(message);
    this.name = "OrderValidationError";
  }
}

export type CartValidationResult =
  | { valid: true }
  | { valid: false; code: string; message: string; cartItemId?: string; menuItemId?: string; menuItemName?: string };

/**
 * Revalidate cart server-side before creating order.
 * Ensures menu items exist, are available, vendors are active and in pod, price snapshot allowed,
 * modifier rules (required/min/max, snooze, nested), and basket limits.
 */
export async function validateCartForOrder(cart: {
  podId: string;
  items: Array<{
    id: string;
    menuItemId: string;
    vendorId: string;
    quantity: number;
    priceCents: number;
    menuItem: {
      priceCents: number;
      isAvailable: boolean;
      name: string;
      basketMaxQuantity?: number | null;
      /** Used with vendorId for effective availability (duplicate Deliverect product rows). */
      deliverectProductId?: string | null;
      deliverectPlu?: string | null;
      deliverectVariantParentPlu?: string | null;
    };
    vendor: {
      isActive?: boolean;
      mennyuOrdersPaused?: boolean;
      posOpen?: boolean;
      /** When set, enforce Deliverect `subItems` depth limits (same as outbound validation). */
      deliverectChannelLinkId?: string | null;
    };
    selections?: Array<{ modifierOptionId: string; quantity: number; modifierOption?: { priceCents: number } }>;
  }>;
}): Promise<CartValidationResult> {
  const vendorIds = [...new Set(cart.items.map((i) => i.vendorId))];
  const operationalByVendor = new Map<string, Set<string>>();
  for (const vid of vendorIds) {
    operationalByVendor.set(vid, await getOperationalMenuItemIdsForVendor(vid));
  }

  for (const item of cart.items) {
    const operational = operationalByVendor.get(item.vendorId)?.has(item.menuItemId) ?? false;
    if (!operational) {
      return {
        valid: false,
        code: "ITEM_NOT_IN_CURRENT_MENU",
        message: `${item.menuItem.name} is not on the current menu.`,
        cartItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
      };
    }
    if (!item.menuItem.isAvailable) {
      return { valid: false, code: "ITEM_UNAVAILABLE", message: `${item.menuItem.name} is no longer available.`, cartItemId: item.id, menuItemId: item.menuItemId, menuItemName: item.menuItem.name };
    }
    const vendorAvailability = getVendorAvailability(item.vendor);
    if (!vendorAvailability.orderable) {
      const { code, message } =
        vendorAvailability.status === "inactive"
          ? { code: "VENDOR_INACTIVE" as const, message: "A vendor in your cart is no longer active." }
          : vendorAvailability.status === "closed"
            ? { code: "VENDOR_CLOSED" as const, message: "A vendor in your cart is currently closed." }
            : { code: "VENDOR_PAUSED_MENNYU" as const, message: "A vendor in your cart is not accepting Mennyu orders right now. Please remove their items or try again later." };
      return { valid: false, code, message };
    }
    const vendorInPod = await prisma.podVendor.findUnique({
      where: { podId_vendorId: { podId: cart.podId, vendorId: item.vendorId } },
    });
    if (!vendorInPod?.isActive) {
      return { valid: false, code: "VENDOR_NOT_IN_POD", message: "A vendor in your cart is not in this pod." };
    }
    const expectedUnitCents = await expectedCartItemUnitPriceCents(item);
    if (item.priceCents !== expectedUnitCents) {
      return {
        valid: false,
        code: "PRICE_CHANGED",
        message: `A price has changed for ${item.menuItem.name}; please review your cart.`,
        cartItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
      };
    }
  }

  const basketResult = await validateCartBasketLimits(cart.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })));
  if (!basketResult.valid) {
    return { valid: false, code: basketResult.code, message: basketResult.message, menuItemId: basketResult.menuItemId };
  }

  for (const item of cart.items) {
    const modResult = await validateCartItemModifiers({
      id: item.id,
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      menuItem: { name: item.menuItem.name, isAvailable: item.menuItem.isAvailable, basketMaxQuantity: item.menuItem.basketMaxQuantity ?? undefined },
      selections: item.selections?.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity })),
    });
    if (!modResult.valid) {
      return { valid: false, code: modResult.code, message: modResult.message, cartItemId: modResult.cartItemId, menuItemId: modResult.menuItemId, menuItemName: modResult.menuItemName };
    }
  }

  const optionIdsForNesting = [
    ...new Set(cart.items.flatMap((i) => i.selections?.map((s) => s.modifierOptionId) ?? [])),
  ];
  if (optionIdsForNesting.length > 0) {
    const optsWithGroup = await prisma.modifierOption.findMany({
      where: { id: { in: optionIdsForNesting } },
      select: {
        id: true,
        modifierGroup: {
          select: { deliverectIsVariantGroup: true, parentModifierOptionId: true },
        },
      },
    });
    const optGroupById = new Map(optsWithGroup.map((o) => [o.id, o]));
    for (const item of cart.items) {
      if (!item.vendor?.deliverectChannelLinkId?.trim()) continue;
      const sels = item.selections ?? [];
      if (sels.length === 0) continue;
      let subItemsChainVariantSteps = 0;
      for (const s of sels) {
        const row = optGroupById.get(s.modifierOptionId);
        if (row && isTopLevelDeliverectVariantGroupModifierGroup(row.modifierGroup)) {
          subItemsChainVariantSteps += 1;
        }
      }
      const hasParentPlu = Boolean(item.menuItem.deliverectVariantParentPlu?.trim());
      if (
        !isDeliverectSubItemsChainDepthAllowed({
          hasDeliverectVariantParentPlu: hasParentPlu,
          chainVariantStepCount: subItemsChainVariantSteps,
        })
      ) {
        const max = maxSubItemsChainVariantStepsForProductShape(hasParentPlu);
        return {
          valid: false,
          code: "DELIVERECT_SUBITEMS_NESTING_LIMIT",
          message: deliverectSubItemsChainLimitMessage(item.menuItem.name, max),
          cartItemId: item.id,
          menuItemId: item.menuItemId,
          menuItemName: item.menuItem.name,
        };
      }
    }
  }

  return { valid: true };
}

export type CartItemValidationError = {
  cartItemId?: string;
  menuItemId?: string;
  menuItemName?: string;
  code: string;
  message: string;
};

/** Cart shape compatible with validateCartForOrder (for display/validation). */
export type CartForValidation = {
  podId: string;
  items: Array<{
    id: string;
    menuItemId: string;
    vendorId: string;
    quantity: number;
    priceCents: number;
    menuItem: {
      priceCents: number;
      isAvailable: boolean;
      name: string;
      basketMaxQuantity?: number | null;
      /** Used with vendorId for effective availability (duplicate Deliverect product rows). */
      deliverectProductId?: string | null;
      deliverectPlu?: string | null;
      deliverectVariantParentPlu?: string | null;
    };
    vendor: { isActive?: boolean; mennyuOrdersPaused?: boolean; posOpen?: boolean };
    selections?: Array<{ modifierOptionId: string; quantity: number; modifierOption?: { priceCents: number } }>;
  }>;
};

/**
 * Validates entire cart and returns all validation errors (for cart page display).
 * Use so the user can see which items need attention and remove or fix them.
 */
export async function validateCartItemsForDisplay(cart: CartForValidation): Promise<{
  valid: boolean;
  errors: CartItemValidationError[];
}> {
  const errors: CartItemValidationError[] = [];

  const vendorIdsDisplay = [...new Set(cart.items.map((i) => i.vendorId))];
  const menuItemIds = [...new Set(cart.items.map((i) => i.menuItemId))];

  const [podVendors, menuItemsLoaded, opMenuResults, opModResults] = await Promise.all([
    prisma.podVendor.findMany({
      where: { podId: cart.podId, vendorId: { in: vendorIdsDisplay } },
      select: { vendorId: true, isActive: true },
    }),
    prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      include: MODIFIER_VALIDATION_MENU_ITEM_INCLUDE,
    }),
    Promise.all(vendorIdsDisplay.map((vid) => getOperationalMenuItemIdsForVendor(vid))),
    Promise.all(vendorIdsDisplay.map((vid) => getOperationalModifierOptionIdsForVendor(vid))),
  ]);

  const podVendorActive = new Map(podVendors.map((pv) => [pv.vendorId, pv.isActive]));
  const menuItemById = new Map(menuItemsLoaded.map((m) => [m.id, m]));

  const operationalByVendorDisplay = new Map<string, Set<string>>();
  const operationalModOptsByVendor = new Map<string, Set<string>>();
  for (let i = 0; i < vendorIdsDisplay.length; i++) {
    const vid = vendorIdsDisplay[i];
    operationalByVendorDisplay.set(vid, opMenuResults[i]);
    operationalModOptsByVendor.set(vid, opModResults[i]);
  }

  const priceChecks = await Promise.all(
    cart.items.map((item) => expectedCartItemUnitPriceCents(item).then((cents) => ({ item, cents })))
  );
  const expectedPriceByCartItemId = new Map(priceChecks.map((p) => [p.item.id, p.cents]));

  for (const item of cart.items) {
    const operational = operationalByVendorDisplay.get(item.vendorId)?.has(item.menuItemId) ?? false;
    if (!operational) {
      errors.push({
        code: "ITEM_NOT_IN_CURRENT_MENU",
        message: `${item.menuItem.name} is not on the current menu.`,
        cartItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
      });
      continue;
    }
    if (!item.menuItem.isAvailable) {
      errors.push({
        code: "ITEM_UNAVAILABLE",
        message: `${item.menuItem.name} is no longer available.`,
        cartItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
      });
      continue;
    }
    const vendorAvailability = getVendorAvailability(item.vendor);
    if (!vendorAvailability.orderable) {
      const message =
        vendorAvailability.status === "inactive"
          ? "This vendor is no longer active."
          : vendorAvailability.status === "closed"
            ? "This vendor is currently closed."
            : "This vendor is not accepting orders right now.";
      errors.push({
        code:
          vendorAvailability.status === "inactive"
            ? "VENDOR_INACTIVE"
            : vendorAvailability.status === "closed"
              ? "VENDOR_CLOSED"
              : "VENDOR_PAUSED_MENNYU",
        message,
        cartItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
      });
      continue;
    }
    if (podVendorActive.get(item.vendorId) !== true) {
      errors.push({
        code: "VENDOR_NOT_IN_POD",
        message: "This vendor is no longer in this pod.",
        cartItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
      });
      continue;
    }
    const expectedUnitCents = expectedPriceByCartItemId.get(item.id);
    if (expectedUnitCents !== undefined && item.priceCents !== expectedUnitCents) {
      errors.push({
        code: "PRICE_CHANGED",
        message: `Price has changed for ${item.menuItem.name}; please review.`,
        cartItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
      });
    }
  }

  const basketResult = await validateCartBasketLimits(
    cart.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
  );
  if (!basketResult.valid) {
    errors.push({
      code: basketResult.code,
      message: basketResult.message,
      menuItemId: basketResult.menuItemId,
    });
  }

  for (const item of cart.items) {
    const loaded = menuItemById.get(item.menuItemId);
    if (!loaded) {
      errors.push({
        code: "ITEM_NOT_FOUND",
        message: `Menu item not found.`,
        cartItemId: item.id,
        menuItemId: item.menuItemId,
        menuItemName: item.menuItem.name,
      });
      continue;
    }
    const modOpts = operationalModOptsByVendor.get(item.vendorId) ?? new Set<string>();
    const modResult = validateCartItemModifiersWithLoadedMenuItem(
      {
        id: item.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        menuItem: {
          name: item.menuItem.name,
          isAvailable: item.menuItem.isAvailable,
          basketMaxQuantity: item.menuItem.basketMaxQuantity ?? undefined,
        },
        selections: item.selections?.map((s) => ({ modifierOptionId: s.modifierOptionId, quantity: s.quantity })),
      },
      loaded,
      modOpts
    );
    if (!modResult.valid) {
      errors.push({
        code: modResult.code,
        message: modResult.message,
        cartItemId: modResult.cartItemId,
        menuItemId: modResult.menuItemId,
        menuItemName: modResult.menuItemName,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Map validation code to short customer-facing message for cart/checkout. */
export function getCartValidationMessage(code: string): string {
  const map: Record<string, string> = {
    ITEM_NOT_IN_CURRENT_MENU: "One or more items are not on the vendor's current menu.",
    ITEM_UNAVAILABLE: "One or more items in your cart are no longer available.",
    VENDOR_INACTIVE: "A vendor in your cart is no longer active.",
    VENDOR_CLOSED: "A vendor in your cart is currently closed.",
    VENDOR_PAUSED_MENNYU: "A vendor in your cart is not accepting orders right now.",
    VENDOR_NOT_IN_POD: "A vendor in your cart is no longer in this pod.",
    PRICE_CHANGED: "A price or selection changed; please review your cart.",
    MODIFIER_OPTION_UNAVAILABLE: "A modifier selection changed and needs review.",
    MODIFIER_GROUP_UNAVAILABLE: "A modifier selection changed and needs review.",
    INVALID_MODIFIER_OPTION: "A modifier selection changed and needs review.",
    MODIFIER_MIN_SELECTIONS: "A modifier selection needs to be updated.",
    MODIFIER_MAX_SELECTIONS: "A modifier selection needs to be updated.",
    MODIFIER_OPTION_MAX_QUANTITY: "A modifier selection needs to be updated.",
    INVALID_MODIFIER_QUANTITY: "A modifier selection needs to be updated.",
    INVALID_NESTED_MODIFIER: "A nested modifier selection needs to be updated.",
    BASKET_LIMIT_EXCEEDED: "Quantity exceeds the maximum allowed for an item.",
    MODIFIER_OPTION_NOT_IN_CURRENT_MENU: "A modifier selection is not on the vendor's current menu.",
    DELIVERECT_SUBITEMS_NESTING_LIMIT:
      "An item exceeds Deliverect’s limit for nested menu levels on online orders (top-level variant groups only — not add-ons). Update the cart or contact the restaurant.",
    GROUP_ORDER_LOCKED: "This cart is locked while the host checks out.",
    GROUP_ORDER_AUTH_REQUIRED: "Join this group order to add or change items.",
    GROUP_ORDER_ITEM_NOT_OWNED: "You can only edit your own items in this group order.",
    GROUP_ORDER_CLOSED: "This group order is closed.",
    GROUP_ORDER_POD_MISMATCH: "That item isn’t part of this pod’s group order.",
    group_checkout_host_only: "Only the host can check out a group order.",
  };
  return map[code] ?? "Your cart needs attention. Please review or remove items.";
}

export async function createOrderFromCart(input: CheckoutInput): Promise<CreateOrderResult | null> {
  const idemKey = buildIdempotencyKey("order", input.idempotencyKey);
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: idemKey },
    include: { vendorOrders: true },
  });
  if (existing) {
    return {
      order: toOrder(existing),
      vendorOrders: existing.vendorOrders.map(toVendorOrder),
    };
  }

  const cart = await prisma.cart.findUnique({
    where: { id: input.cartId },
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
  if (!cart || cart.items.length === 0) {
    throw new OrderValidationError("CART_EMPTY", "Cart not found or empty");
  }

  const groupSession = await prisma.groupOrderSession.findUnique({
    where: { cartId: cart.id },
    select: { id: true, hostUserId: true, status: true },
  });
  if (groupSession) {
    if (!input.groupOrderHostUserId || input.groupOrderHostUserId !== groupSession.hostUserId) {
      throw new OrderValidationError(
        "GROUP_ORDER_HOST_CHECKOUT",
        "Only the host can check out a group order."
      );
    }
    if (groupSession.status !== "active" && groupSession.status !== "locked_checkout") {
      throw new OrderValidationError("GROUP_ORDER_CLOSED", "This group order is no longer active.");
    }
  }

  const validation = await validateCartForOrder(cart);
  if (!validation.valid) {
    throw new OrderValidationError(validation.code, validation.message, {
      cartItemId: validation.cartItemId,
      menuItemId: validation.menuItemId,
      menuItemName: validation.menuItemName,
    });
  }

  const vendorGroups = groupCartByVendorSubtotals(cart.items);
  if (vendorGroups.length === 0) {
    throw new OrderValidationError(
      "NO_VENDOR_GROUPS",
      "Order could not be split by vendor; cart items may be missing vendor. Refusing to create order without vendor orders."
    );
  }
  const vendorSubtotalsCents = vendorGroups.map((v) => v.subtotalCents);
  const { pricingConfigId, rates } = await getActivePricingRatesSnapshot();
  const totals = computeOrderPricing(
    {
      vendorSubtotalsCents,
      tipCents: input.tipCents,
      pickupSalesTaxBps: cart.pod.pickupSalesTaxBps,
    },
    rates
  );

  const pickupMode = input.pickupMode ?? "asap";
  let requestedPickupAt: Date | null = null;
  if (pickupMode === "scheduled") {
    if (!input.scheduledPickupDate?.trim() || !input.scheduledPickupTime?.trim()) {
      throw new OrderValidationError(
        "PICKUP_SCHEDULE_INCOMPLETE",
        "Choose a date and time for scheduled pickup."
      );
    }
    const dateMatch = input.scheduledPickupDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = input.scheduledPickupTime.match(/^(\d{2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) {
      throw new OrderValidationError("PICKUP_TIME_INVALID", "Enter a valid pickup date and time.");
    }
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
      throw new OrderValidationError("PICKUP_TIME_INVALID", "Enter a valid pickup date and time.");
    }
    const tz = resolvePickupTimezone(cart.pod);
    let atUtc: Date;
    try {
      atUtc = wallTimeInZoneToUtc(year, month, day, hour, minute, tz);
    } catch {
      throw new OrderValidationError(
        "PICKUP_TIMEZONE_INVALID",
        "Pickup timezone is not configured correctly."
      );
    }
    const v = validateScheduledPickup(atUtc);
    if (!v.ok) {
      throw new OrderValidationError(v.code, v.message);
    }
    requestedPickupAt = atUtc;
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        podId: cart.podId,
        groupOrderSessionId: groupSession?.id,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        orderNotes: input.orderNotes ?? null,
        subtotalCents: totals.subtotalCents,
        serviceFeeCents: totals.serviceFeeCents,
        tipCents: totals.tipCents,
        taxCents: totals.taxCents,
        totalCents: totals.totalCents,
        pricingConfigId: pricingConfigId ?? undefined,
        customerServiceFeeBpsApplied: rates.customerServiceFeeBps,
        customerServiceFeeFlatCentsApplied: rates.customerServiceFeeFlatCents,
        vendorProcessingFeeBpsApplied: rates.vendorProcessingFeeBps,
        vendorProcessingFeeFlatCentsApplied: rates.vendorProcessingFeeFlatCents,
        idempotencyKey: idemKey,
        status: "pending_payment",
        sourceCartId: cart.id,
        requestedPickupAt,
      },
    });

    if (groupSession) {
      await tx.groupOrderSession.update({
        where: { id: groupSession.id },
        data: { status: "submitted", lockedAt: new Date() },
      });
    }

    for (let i = 0; i < vendorGroups.length; i++) {
      const group = vendorGroups[i]!;
      const alloc = totals.vendorAllocations[i];
      if (!alloc) {
        throw new Error(`Missing vendor allocation for group index ${i}; cannot create vendor order`);
      }
      const { vendorId, lines } = group;
      const vo = await tx.vendorOrder.create({
        data: {
          orderId: order.id,
          vendorId,
          subtotalCents: alloc.subtotalCents,
          tipCents: alloc.tipCents,
          taxCents: alloc.taxCents,
          serviceFeeCents: alloc.serviceFeeCents,
          totalCents: alloc.totalCents,
          vendorProcessingFeeRecoveryCents: alloc.vendorProcessingFeeRecoveryCents,
          vendorProcessingFeeBpsApplied: rates.vendorProcessingFeeBps,
          vendorProcessingFeeFlatCentsApplied: rates.vendorProcessingFeeFlatCents,
          vendorGrossPayableCents: alloc.vendorGrossPayableCents,
          vendorNetPayoutCents: alloc.vendorNetPayoutCents,
          routingStatus: "pending",
          fulfillmentStatus: "pending",
        },
      });
      for (const line of lines) {
        const lineRec = await tx.orderLineItem.create({
          data: {
            vendorOrderId: vo.id,
            menuItemId: line.menuItemId,
            name: line.name,
            quantity: line.quantity,
            priceCents: line.unitPriceCents,
            specialInstructions: line.specialInstructions ?? null,
            groupOrderParticipantId: line.groupOrderParticipantId ?? undefined,
          },
        });
        for (const sel of line.selections) {
          await tx.orderLineItemSelection.create({
            data: {
              orderLineItemId: lineRec.id,
              modifierOptionId: sel.modifierOptionId,
              nameSnapshot: sel.modifierOptionName,
              priceCentsSnapshot: sel.modifierOptionPriceCents,
              quantity: sel.quantity,
            },
          });
        }
      }
    }

    await tx.orderStatusHistory.create({
      data: { orderId: order.id, status: "pending_payment", source: "system" },
    });

    const orderWithVendors = await tx.order.findUnique({
      where: { id: order.id },
      include: { vendorOrders: { include: { lineItems: true, vendor: true } } },
    });
    if (!orderWithVendors) throw new Error("Order not found after create");
    return orderWithVendors;
  });

  return {
    order: toOrder(result),
    vendorOrders: result.vendorOrders.map(toVendorOrder),
  };
}

interface VendorGroup {
  vendorId: string;
  subtotalCents: number;
  lines: Array<{
    cartItemId: string;
    groupOrderParticipantId: string | null;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPriceCents: number;
    specialInstructions: string | null;
    selections: Array<{
      modifierOptionId: string;
      modifierOptionName: string;
      modifierOptionPriceCents: number;
      quantity: number;
    }>;
  }>;
}

function groupCartByVendorSubtotals(
  items: Array<{
    id: string;
    groupOrderParticipantId: string | null;
    menuItemId: string;
    vendorId: string;
    quantity: number;
    priceCents: number;
    specialInstructions: string | null;
    menuItem: { name: string };
    selections?: Array<{ modifierOptionId: string; modifierOption: { name: string; priceCents: number }; quantity: number }>;
  }>
): VendorGroup[] {
  const byVendor = new Map<
    string,
    { subtotalCents: number; lines: VendorGroup["lines"] }
  >();
  const order: string[] = [];
  for (const item of items) {
    // Cart item priceCents is stored as effective unit price (base + modifiers) at add/update.
    const unitPriceCents = item.priceCents;
    const lineTotal = unitPriceCents * item.quantity;
    if (!byVendor.has(item.vendorId)) {
      order.push(item.vendorId);
      byVendor.set(item.vendorId, { subtotalCents: 0, lines: [] });
    }
    const g = byVendor.get(item.vendorId)!;
    g.subtotalCents += lineTotal;
    g.lines.push({
      cartItemId: item.id,
      groupOrderParticipantId: item.groupOrderParticipantId,
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      quantity: item.quantity,
      unitPriceCents,
      specialInstructions: item.specialInstructions,
      selections: (item.selections ?? []).map((s) => ({
        modifierOptionId: s.modifierOptionId,
        modifierOptionName: s.modifierOption.name,
        modifierOptionPriceCents: s.modifierOption.priceCents,
        quantity: s.quantity,
      })),
    });
  }
  return order.map((vendorId) => {
    const g = byVendor.get(vendorId)!;
    return { vendorId, subtotalCents: g.subtotalCents, lines: g.lines };
  });
}

function toOrder(row: {
  id: string;
  podId: string;
  customerPhone: string;
  customerEmail: string | null;
  orderNotes: string | null;
  subtotalCents: number;
  serviceFeeCents: number;
  tipCents: number;
  taxCents: number;
  totalCents: number;
  status: string;
  stripePaymentIntentId: string | null;
  requestedPickupAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Order {
  return {
    id: row.id,
    podId: row.podId,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    orderNotes: row.orderNotes ?? null,
    subtotalCents: row.subtotalCents,
    serviceFeeCents: row.serviceFeeCents,
    tipCents: row.tipCents,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    status: row.status as Order["status"],
    stripePaymentIntentId: row.stripePaymentIntentId,
    requestedPickupAt: row.requestedPickupAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVendorOrder(row: {
  id: string;
  orderId: string;
  vendorId: string;
  subtotalCents: number;
  tipCents: number;
  taxCents: number;
  serviceFeeCents: number;
  totalCents: number;
  vendorProcessingFeeRecoveryCents: number;
  deliverectOrderId: string | null;
  deliverectChannelLinkId: string | null;
  routingStatus: string;
  fulfillmentStatus: string;
  deliverectAttempts: number;
  lineItems?: Array<{ id: string; menuItemId: string; name: string; quantity: number; priceCents: number; specialInstructions: string | null }>;
  vendor?: { name: string };
}): VendorOrderType {
  return {
    id: row.id,
    orderId: row.orderId,
    vendorId: row.vendorId,
    subtotalCents: row.subtotalCents,
    tipCents: row.tipCents,
    taxCents: row.taxCents,
    serviceFeeCents: row.serviceFeeCents,
    totalCents: row.totalCents,
    vendorProcessingFeeRecoveryCents: row.vendorProcessingFeeRecoveryCents,
    deliverectOrderId: row.deliverectOrderId,
    deliverectChannelLinkId: row.deliverectChannelLinkId,
    routingStatus: row.routingStatus as VendorOrderType["routingStatus"],
    fulfillmentStatus: row.fulfillmentStatus as VendorOrderType["fulfillmentStatus"],
    deliverectAttempts: row.deliverectAttempts,
    lineItems: row.lineItems,
    vendor: row.vendor,
  };
}

export async function getOrderWithVendorOrders(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      vendorOrders: { include: { lineItems: true, vendor: true } },
      pod: true,
    },
  });
}

export interface OrderHistoryEntry {
  id: string;
  createdAt: Date;
  totalCents: number;
  status: string;
  podName: string;
  vendorNames: string[];
  pickupDisplayLine: string;
}

/** Terminal Order.status values: no further updates expected; order is not "active". */
const TERMINAL_ORDER_STATUSES = ["completed", "partially_completed", "cancelled", "failed"] as const;

/**
 * Parent orders still in checkout (unpaid). Must not block /cart or show as a "live" placed order.
 */
const CHECKOUT_IN_PROGRESS_STATUSES = ["pending_payment"] as const;

/**
 * Returns the customer's most recent active order (placed + paid or in fulfillment), if any.
 * Excludes terminal outcomes and unpaid `pending_payment` (abandoned Stripe / incomplete checkout).
 * Used for header "Cart" shortcut and cart redirect.
 */
export async function getActiveOrderByCustomerPhone(
  customerPhone: string
): Promise<{ id: string } | null> {
  const normalized = customerPhone.trim();
  if (!normalized) return null;

  const order = await prisma.order.findFirst({
    where: {
      customerPhone: normalized,
      status: { notIn: [...TERMINAL_ORDER_STATUSES, ...CHECKOUT_IN_PROGRESS_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return order;
}

/**
 * List past orders for a customer by phone (for order history page).
 * Returns orders sorted by createdAt desc.
 */
export async function getOrdersByCustomerPhone(customerPhone: string): Promise<OrderHistoryEntry[]> {
  const normalized = customerPhone.trim();
  if (!normalized) return [];

  const orders = await prisma.order.findMany({
    where: { customerPhone: normalized },
    include: {
      pod: { select: { name: true, pickupTimezone: true } },
      vendorOrders: { include: { vendor: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return orders.map((o) => {
    const tz = resolvePickupTimezone(o.pod);
    return {
      id: o.id,
      createdAt: o.createdAt,
      totalCents: o.totalCents,
      status: o.status,
      podName: o.pod.name,
      vendorNames: [...new Set(o.vendorOrders.map((vo) => vo.vendor.name))],
      pickupDisplayLine: formatPickupDetailLine(o.requestedPickupAt, tz),
    };
  });
}

/**
 * Recent orders suitable for "order again" surfaces (completed outcomes only).
 * Omits in-flight and unpaid orders.
 */
export async function getRecentCompletedOrdersForPhone(
  customerPhone: string,
  take: number
): Promise<OrderHistoryEntry[]> {
  const all = await getOrdersByCustomerPhone(customerPhone);
  const terminal = all.filter((o) => o.status === "completed" || o.status === "partially_completed");
  return terminal.slice(0, Math.max(0, take));
}

/** Server-only helper for checkout page default scheduled fields. */
export function getCheckoutDefaultScheduledPickup(pod: { pickupTimezone: string | null }) {
  const tz = resolvePickupTimezone(pod);
  return { timezone: tz, ...getDefaultScheduledSuggestion(tz) };
}

export async function setOrderStripePaymentIntent(
  orderId: string,
  stripePaymentIntentId: string
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { stripePaymentIntentId },
  });
}

export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  source: string,
  note?: string
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
  await prisma.orderStatusHistory.create({
    data: { orderId, status, source, note: note ?? null },
  });
}
