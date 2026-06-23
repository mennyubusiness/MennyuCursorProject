import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeOrderPricing, DEFAULT_LEGACY_PRICING_RATES } from "@/domain/fees";

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const mockAssertCartSessionAccess = vi.fn();
const mockGroupSessionFindUnique = vi.fn();
const mockGroupCheckoutFingerprintsMatch = vi.fn();
const mockOrderFindUnique = vi.fn();
const mockOrderFindFirst = vi.fn();
const mockCartFindUnique = vi.fn();
const mockOrderUpdateMany = vi.fn();
const mockOrderStatusHistoryCreate = vi.fn();
const mockOrderCreate = vi.fn();
const mockTransaction = vi.fn();
const mockPodFindUnique = vi.fn();
const mockPodVendorFindUnique = vi.fn();
const mockOperationalMenuIds = vi.fn();
const mockOperationalModOpts = vi.fn();
const mockShellBase = vi.fn();
const mockVariantCharge = vi.fn();
const mockMenuItemFindUnique = vi.fn();
const mockMenuItemFindMany = vi.fn();

vi.mock("@/lib/cart-session-access", () => ({
  assertCartSessionAccess: (...args: unknown[]) => mockAssertCartSessionAccess(...args),
}));

vi.mock("@/services/group-order-checkout-fingerprint.service", () => ({
  groupCheckoutFingerprintsMatch: (...args: unknown[]) => mockGroupCheckoutFingerprintsMatch(...args),
}));

vi.mock("@/services/menu-active-scope.service", () => ({
  getOperationalMenuItemIdsForVendor: (...args: unknown[]) => mockOperationalMenuIds(...args),
  getOperationalModifierOptionIdsForVendor: (...args: unknown[]) => mockOperationalModOpts(...args),
}));

vi.mock("@/services/cart-deliverect-variant-resolution", () => ({
  shellBasePriceCentsForMenuItem: (...args: unknown[]) => mockShellBase(...args),
  variantSelectionsPriceCentsForLeafCartLine: (...args: unknown[]) => mockVariantCharge(...args),
}));

vi.mock("@/services/pricing-config.service", () => ({
  getActivePricingRatesSnapshot: vi.fn(async () => ({
    pricingConfigId: null,
    rates: DEFAULT_LEGACY_PRICING_RATES,
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: {
      findUnique: (...args: unknown[]) => mockPodFindUnique(...args),
    },
    podVendor: {
      findUnique: (...args: unknown[]) => mockPodVendorFindUnique(...args),
    },
    menuItem: {
      findUnique: (...args: unknown[]) => mockMenuItemFindUnique(...args),
      findMany: (...args: unknown[]) => mockMenuItemFindMany(...args),
    },
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      findFirst: (...args: unknown[]) => mockOrderFindFirst(...args),
      create: (...args: unknown[]) => mockOrderCreate(...args),
      updateMany: (...args: unknown[]) => mockOrderUpdateMany(...args),
    },
    cart: {
      findUnique: (...args: unknown[]) => mockCartFindUnique(...args),
    },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockGroupSessionFindUnique(...args),
      update: vi.fn(),
    },
    orderStatusHistory: {
      create: (...args: unknown[]) => mockOrderStatusHistoryCreate(...args),
    },
    vendorOrder: { create: vi.fn() },
    orderLineItem: { create: vi.fn() },
    orderLineItemSelection: { create: vi.fn() },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const CART_ID = "cart_checkout";
const SESSION_ID = "sess_guest";
const PENDING_ORDER_ID = "ord_pending";
const ACCOUNT_USER = "user_account";
const HOST_USER = "user_host";
const LINE_PRICE = 500;

function cartItem(overrides?: Record<string, unknown>) {
  return {
    id: "line_1",
    groupOrderParticipantId: null,
    menuItemId: "mi_1",
    vendorId: "v_1",
    quantity: 1,
    priceCents: LINE_PRICE,
    specialInstructions: null,
    menuItem: {
      priceCents: LINE_PRICE,
      isAvailable: true,
      name: "Burger",
      deliverectProductId: null,
      deliverectPlu: null,
      deliverectVariantParentPlu: null,
    },
    vendor: { isActive: true, mennyuOrdersPaused: false, posOpen: true, deliverectChannelLinkId: null },
    selections: [] as Array<{
      modifierOptionId: string;
      quantity: number;
      modifierOption: { name: string; priceCents: number };
    }>,
    ...overrides,
  };
}

function baseCart(items = [cartItem()]) {
  return {
    id: CART_ID,
    podId: "pod_1",
    items,
    pod: { pickupSalesTaxBps: 0, pickupTimezone: "America/New_York" },
  };
}

function checkoutTotals(tipCents = 0) {
  return computeOrderPricing(
    { vendorSubtotalsCents: [LINE_PRICE], tipCents, pickupSalesTaxBps: 0 },
    DEFAULT_LEGACY_PRICING_RATES
  );
}

function pendingOrder(overrides?: { tipCents?: number; lineQuantity?: number }) {
  const tipCents = overrides?.tipCents ?? 0;
  const totals = checkoutTotals(tipCents);
  return {
    id: PENDING_ORDER_ID,
    podId: "pod_1",
    customerPhone: "+15551234567",
    customerEmail: null,
    orderNotes: null,
    subtotalCents: totals.subtotalCents,
    serviceFeeCents: totals.serviceFeeCents,
    tipCents: totals.tipCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
    status: "pending_payment",
    stripePaymentIntentId: "pi_existing",
    requestedPickupAt: null,
    deliverectEstimatedReadyAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    vendorOrders: [
      {
        id: "vo_1",
        orderId: PENDING_ORDER_ID,
        vendorId: "v_1",
        subtotalCents: totals.subtotalCents,
        tipCents: totals.tipCents,
        taxCents: totals.taxCents,
        serviceFeeCents: totals.serviceFeeCents,
        totalCents: totals.totalCents,
        vendorProcessingFeeRecoveryCents: 14,
        deliverectOrderId: null,
        deliverectChannelLinkId: null,
        routingStatus: "pending",
        fulfillmentStatus: "pending",
        deliverectAttempts: 0,
        lineItems: [
          {
            menuItemId: "mi_1",
            quantity: overrides?.lineQuantity ?? 1,
            priceCents: LINE_PRICE,
            specialInstructions: null,
            groupOrderParticipantId: null,
            selections: [] as Array<{ modifierOptionId: string; quantity: number }>,
          },
        ],
      },
    ],
  };
}

const baseInput = {
  cartId: CART_ID,
  customerPhone: "+15551234567",
  tipCents: 0,
  idempotencyKey: "idem_pending_reuse",
  mennyuSessionId: SESSION_ID,
};

function mockValidationPassing() {
  mockPodFindUnique.mockResolvedValue({ isActive: true });
  mockPodVendorFindUnique.mockResolvedValue({ isActive: true });
  mockOperationalMenuIds.mockResolvedValue(new Set(["mi_1"]));
  mockOperationalModOpts.mockResolvedValue(new Set());
  mockShellBase.mockResolvedValue(LINE_PRICE);
  mockVariantCharge.mockResolvedValue(0);
  mockMenuItemFindUnique.mockResolvedValue({
    id: "mi_1",
    vendorId: "v_1",
    name: "Burger",
    isAvailable: true,
    basketMaxQuantity: null,
    modifierGroups: [],
  });
  mockMenuItemFindMany.mockResolvedValue([
    { id: "mi_1", name: "Burger", basketMaxQuantity: null },
  ]);
}

function mockFreshOrderCreate(newOrderId: string, tipCents = 0) {
  const created = {
    ...pendingOrder({ tipCents }),
    id: newOrderId,
    vendorOrders: [{ ...pendingOrder({ tipCents }).vendorOrders[0], id: `vo_${newOrderId}`, orderId: newOrderId }],
  };
  mockOrderCreate.mockResolvedValue(created);
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      order: {
        updateMany: mockOrderUpdateMany,
        create: mockOrderCreate,
        findUnique: vi.fn().mockResolvedValue(created),
      },
      orderStatusHistory: { create: mockOrderStatusHistoryCreate },
      groupOrderSession: { update: vi.fn() },
      vendorOrder: { create: vi.fn().mockResolvedValue({ id: `vo_${newOrderId}`, vendorId: "v_1" }) },
      orderLineItem: { create: vi.fn().mockResolvedValue({ id: "oli_1" }) },
      orderLineItemSelection: { create: vi.fn() },
    };
    return fn(tx);
  });
  return created;
}

function mockAccessOk(isGroupOrder = false) {
  mockAssertCartSessionAccess.mockResolvedValue({
    ok: true,
    cartId: CART_ID,
    sessionId: SESSION_ID,
    podId: "pod_1",
    isGroupOrder,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrderFindUnique.mockResolvedValue(null);
  mockGroupSessionFindUnique.mockResolvedValue(null);
  mockGroupCheckoutFingerprintsMatch.mockResolvedValue(true);
  mockOrderUpdateMany.mockResolvedValue({ count: 1 });
  mockOrderStatusHistoryCreate.mockResolvedValue({});
  mockValidationPassing();
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      order: {
        updateMany: mockOrderUpdateMany,
        create: mockOrderCreate,
        findUnique: vi.fn(),
      },
      orderStatusHistory: { create: mockOrderStatusHistoryCreate },
      groupOrderSession: { update: vi.fn() },
      vendorOrder: { create: vi.fn() },
      orderLineItem: { create: vi.fn() },
      orderLineItemSelection: { create: vi.fn() },
    };
    return fn(tx);
  });
});

describe("evaluatePendingOrderReuse", () => {
  it("returns reuse when cart validation passes and checkout snapshot matches", async () => {
    const { evaluatePendingOrderReuse } = await import("./order.service");
    const result = await evaluatePendingOrderReuse({
      pending: pendingOrder(),
      cart: baseCart(),
      input: { tipCents: 0 },
    });
    expect(result).toEqual({ action: "reuse" });
  });

  it("returns invalid when vendor is no longer available", async () => {
    const { evaluatePendingOrderReuse } = await import("./order.service");
    const result = await evaluatePendingOrderReuse({
      pending: pendingOrder(),
      cart: baseCart([cartItem({ vendor: { isActive: false, mennyuOrdersPaused: false } })]),
      input: { tipCents: 0 },
    });
    expect(result).toMatchObject({
      action: "invalid",
      validation: { code: "VENDOR_INACTIVE" },
    });
  });

  it("returns stale when cart line contents changed meaningfully", async () => {
    const { evaluatePendingOrderReuse } = await import("./order.service");
    const result = await evaluatePendingOrderReuse({
      pending: pendingOrder(),
      cart: baseCart([cartItem({ quantity: 2 })]),
      input: { tipCents: 0 },
    });
    expect(result).toEqual({ action: "stale" });
  });

  it("returns stale when order total no longer matches checkout input", async () => {
    const { evaluatePendingOrderReuse } = await import("./order.service");
    const result = await evaluatePendingOrderReuse({
      pending: pendingOrder({ tipCents: 0 }),
      cart: baseCart(),
      input: { tipCents: 200 },
    });
    expect(result).toEqual({ action: "stale" });
  });
});

describe("createOrderFromCart pending_payment reuse", () => {
  it("reuses pending_payment order when cart/order is still valid", async () => {
    mockAccessOk();
    mockCartFindUnique.mockResolvedValue(baseCart());
    mockOrderFindFirst.mockResolvedValue(pendingOrder());

    const { createOrderFromCart } = await import("./order.service");
    const result = await createOrderFromCart(baseInput);

    expect(result?.order.id).toBe(PENDING_ORDER_ID);
    expect(mockOrderUpdateMany).not.toHaveBeenCalled();
    expect(mockOrderCreate).not.toHaveBeenCalled();
  });

  it("does not reuse when vendor became unavailable", async () => {
    mockAccessOk();
    mockCartFindUnique.mockResolvedValue(
      baseCart([cartItem({ vendor: { isActive: false, mennyuOrdersPaused: false } })])
    );
    mockOrderFindFirst.mockResolvedValue(pendingOrder());

    const { createOrderFromCart } = await import("./order.service");

    await expect(createOrderFromCart(baseInput)).rejects.toMatchObject({
      code: "VENDOR_INACTIVE",
    });
    expect(mockOrderUpdateMany).toHaveBeenCalled();
    expect(mockOrderCreate).not.toHaveBeenCalled();
  });

  it("abandons stale pending and creates a fresh order when cart contents changed", async () => {
    mockAccessOk();
    mockCartFindUnique.mockResolvedValue(baseCart([cartItem({ quantity: 2 })]));
    mockOrderFindFirst.mockResolvedValue(pendingOrder());
    mockFreshOrderCreate("ord_fresh_qty");

    const { createOrderFromCart } = await import("./order.service");
    const result = await createOrderFromCart(baseInput);

    expect(mockOrderUpdateMany).toHaveBeenCalled();
    expect(result?.order.id).toBe("ord_fresh_qty");
  });

  it("abandons stale pending and creates a fresh order when tip changes total", async () => {
    mockAccessOk();
    mockCartFindUnique.mockResolvedValue(baseCart());
    mockOrderFindFirst.mockResolvedValue(pendingOrder({ tipCents: 0 }));
    mockFreshOrderCreate("ord_fresh_tip", 200);

    const { createOrderFromCart } = await import("./order.service");
    const result = await createOrderFromCart({ ...baseInput, tipCents: 200 });

    expect(mockOrderUpdateMany).toHaveBeenCalled();
    expect(result?.order.id).toBe("ord_fresh_tip");
  });

  it("denies checkout before pending reuse when cart ownership fails", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Cart not found or access denied",
    });
    mockOrderFindFirst.mockResolvedValue(pendingOrder());

    const { createOrderFromCart } = await import("./order.service");

    await expect(createOrderFromCart({ ...baseInput, authUserId: null })).rejects.toMatchObject({
      code: "CART_ACCESS_DENIED",
    });
    expect(mockCartFindUnique).not.toHaveBeenCalled();
  });

  it("guest retry reuses pending order when session access is valid", async () => {
    mockAccessOk();
    mockCartFindUnique.mockResolvedValue(baseCart());
    mockOrderFindFirst.mockResolvedValue(pendingOrder());

    const { createOrderFromCart } = await import("./order.service");
    const result = await createOrderFromCart({ ...baseInput, authUserId: null });

    expect(result?.order.id).toBe(PENDING_ORDER_ID);
    expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, SESSION_ID, {
      authUserId: null,
      mode: "checkout",
    });
  });

  it("signed-in account cart retry reuses pending order when valid", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: true,
      cartId: CART_ID,
      sessionId: "sess_old",
      podId: "pod_1",
      isGroupOrder: false,
    });
    mockCartFindUnique.mockResolvedValue(baseCart());
    mockOrderFindFirst.mockResolvedValue(pendingOrder());

    const { createOrderFromCart } = await import("./order.service");
    const result = await createOrderFromCart({
      ...baseInput,
      mennyuSessionId: "sess_new",
      authUserId: ACCOUNT_USER,
    });

    expect(result?.order.id).toBe(PENDING_ORDER_ID);
    expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, "sess_new", {
      authUserId: ACCOUNT_USER,
      mode: "checkout",
    });
  });

  it("group host retry reuses pending order when valid", async () => {
    mockAssertCartSessionAccess.mockResolvedValue({
      ok: true,
      cartId: CART_ID,
      sessionId: SESSION_ID,
      podId: "pod_1",
      isGroupOrder: true,
    });
    mockGroupSessionFindUnique.mockResolvedValue({ id: "gos_1", status: "locked_checkout" });
    mockCartFindUnique.mockResolvedValue(baseCart());
    mockOrderFindFirst.mockResolvedValue(pendingOrder());

    const { createOrderFromCart } = await import("./order.service");
    const result = await createOrderFromCart({
      ...baseInput,
      groupOrderHostUserId: HOST_USER,
      groupCheckoutFingerprint: "fp_locked",
    });

    expect(result?.order.id).toBe(PENDING_ORDER_ID);
    expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, SESSION_ID, {
      authUserId: HOST_USER,
      mode: "checkout",
    });
  });
});
