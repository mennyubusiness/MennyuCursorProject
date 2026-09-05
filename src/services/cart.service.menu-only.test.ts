import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));

const mockCartItemFindFirst = vi.fn();
const mockCartItemDeleteMany = vi.fn();
const mockCartFindUnique = vi.fn();
const mockVendorFindUnique = vi.fn();
const mockOrderUpdateMany = vi.fn();
const mockGroupOrderSessionFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cart: {
      findUnique: (...args: unknown[]) => mockCartFindUnique(...args),
    },
    cartItem: {
      findFirst: (...args: unknown[]) => mockCartItemFindFirst(...args),
      deleteMany: (...args: unknown[]) => mockCartItemDeleteMany(...args),
    },
    vendor: {
      findUnique: (...args: unknown[]) => mockVendorFindUnique(...args),
    },
    order: {
      updateMany: (...args: unknown[]) => mockOrderUpdateMany(...args),
    },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockGroupOrderSessionFindUnique(...args),
    },
  },
}));

vi.mock("@/services/group-order.service", () => ({
  enforceGroupOrderCartMutation: vi.fn().mockResolvedValue(undefined),
}));

const mockRequireOperationalMenuItem = vi.fn();

vi.mock("@/services/menu-active-scope.service", () => ({
  getOperationalMenuItemIdsForVendor: (...args: unknown[]) =>
    mockRequireOperationalMenuItem(...args),
  getOperationalModifierOptionIdsForVendor: vi.fn().mockResolvedValue(new Set()),
}));

import { CartValidationError, removeCartItem, updateCartItem } from "@/services/cart.service";
import {
  POD_ORDERING_DISABLED_CART_MESSAGE,
  POD_ORDERING_DISABLED_CODE,
  VENDOR_ORDERING_DISABLED_CART_MESSAGE,
  VENDOR_ORDERING_DISABLED_CODE,
} from "@/lib/vendor-ordering-mode";

const CART_ID = "cart_1";
const CART_ITEM_ID = "ci_1";
const VENDOR_ID = "v_1";

function cartRow(podOrderingEnabled: boolean) {
  return { id: CART_ID, podId: "pod_1", pod: { orderingEnabled: podOrderingEnabled }, items: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrderUpdateMany.mockResolvedValue({ count: 0 });
  mockGroupOrderSessionFindUnique.mockResolvedValue(null);
  mockCartItemDeleteMany.mockResolvedValue({ count: 1 });
  mockCartItemFindFirst.mockResolvedValue({
    id: CART_ITEM_ID,
    cartId: CART_ID,
    menuItemId: "mi_1",
    quantity: 1,
    menuItem: { id: "mi_1", vendorId: VENDOR_ID, name: "Burger", isAvailable: true },
    selections: [],
  });
  mockCartFindUnique.mockResolvedValue(cartRow(true));
  mockVendorFindUnique.mockResolvedValue({ orderingEnabled: true });
  mockRequireOperationalMenuItem.mockResolvedValue(new Set(["mi_1"]));
});

describe("updateCartItem ordering intent enforcement", () => {
  it("rejects a quantity change for a menu-only vendor", async () => {
    mockVendorFindUnique.mockResolvedValue({ orderingEnabled: false });

    await expect(updateCartItem(CART_ID, CART_ITEM_ID, 2)).rejects.toMatchObject({
      code: VENDOR_ORDERING_DISABLED_CODE,
      message: VENDOR_ORDERING_DISABLED_CART_MESSAGE,
    });
  });

  it("rejects a quantity change when the pod is menu-only", async () => {
    mockCartFindUnique.mockResolvedValue(cartRow(false));

    await expect(updateCartItem(CART_ID, CART_ITEM_ID, 2)).rejects.toMatchObject({
      code: POD_ORDERING_DISABLED_CODE,
      message: POD_ORDERING_DISABLED_CART_MESSAGE,
    });
  });

  it("reports the rejection as a cart validation error tied to the line", async () => {
    mockVendorFindUnique.mockResolvedValue({ orderingEnabled: false });

    await expect(updateCartItem(CART_ID, CART_ITEM_ID, 2)).rejects.toBeInstanceOf(
      CartValidationError
    );
  });

  /**
   * The customer must always be able to clear blocked lines, so removal deliberately skips the
   * intent guard.
   */
  it("still allows removing the line by setting quantity to zero", async () => {
    mockVendorFindUnique.mockResolvedValue({ orderingEnabled: false });
    mockCartFindUnique.mockResolvedValue(cartRow(false));

    await updateCartItem(CART_ID, CART_ITEM_ID, 0).catch(() => undefined);

    expect(mockCartItemDeleteMany).toHaveBeenCalledWith({
      where: { id: CART_ITEM_ID, cartId: CART_ID },
    });
  });

  it("still allows removeCartItem for a menu-only vendor", async () => {
    mockVendorFindUnique.mockResolvedValue({ orderingEnabled: false });

    await removeCartItem(CART_ID, CART_ITEM_ID).catch(() => undefined);

    expect(mockCartItemDeleteMany).toHaveBeenCalledWith({
      where: { id: CART_ITEM_ID, cartId: CART_ID },
    });
  });
});
