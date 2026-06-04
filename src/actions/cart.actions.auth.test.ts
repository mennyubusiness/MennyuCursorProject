import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAssertCartSessionAccess = vi.fn();
const mockResolveGroupOrderActor = vi.fn();
const mockGetMennyuSessionIdForRequest = vi.fn();
const mockGetCartById = vi.fn();
const mockAddCartItem = vi.fn();
const mockUpdateCartItem = vi.fn();
const mockRemoveCartItem = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));

vi.mock("@/lib/cart-session-access", () => ({
  assertCartSessionAccess: (...args: unknown[]) => mockAssertCartSessionAccess(...args),
}));

vi.mock("@/actions/group-order-context", () => ({
  resolveGroupOrderActorForCartMutation: (...args: unknown[]) =>
    mockResolveGroupOrderActor(...args),
}));

vi.mock("@/lib/session-request", () => ({
  getMennyuSessionIdForRequest: (...args: unknown[]) => mockGetMennyuSessionIdForRequest(...args),
  getOrCreateMennyuSessionIdForCart: vi.fn().mockResolvedValue("sess_new"),
}));

vi.mock("@/services/cart.service", () => ({
  getOrCreateCart: vi.fn(),
  getCartById: (...args: unknown[]) => mockGetCartById(...args),
  getOrCreateCartForVendorMenuPage: vi.fn(),
  getCartByIdForMutation: vi.fn(),
  addCartItem: (...args: unknown[]) => mockAddCartItem(...args),
  updateCartItem: (...args: unknown[]) => mockUpdateCartItem(...args),
  removeCartItem: (...args: unknown[]) => mockRemoveCartItem(...args),
  CartValidationError: class CartValidationError extends Error {
    code: string;
    details?: Record<string, string>;
    constructor(code: string, message: string, details?: Record<string, string>) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

import { CartValidationError } from "@/services/cart.service";
import {
  addToCartAction,
  getCartAction,
  removeFromCartAction,
  updateCartItemAction,
} from "@/actions/cart.actions";

const CART_ID = "cart_1";
const SESSION_A = "sess_a";
const OTHER_SESSION = "sess_b";

const participantActor = {
  sessionId: "gos_1",
  sessionStatus: "active" as const,
  cartId: CART_ID,
  podId: "pod_1",
  participantId: "part_joiner",
  role: "participant" as const,
};

const hostActor = {
  ...participantActor,
  participantId: "part_host",
  role: "host" as const,
};

describe("cart server actions session ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMennyuSessionIdForRequest.mockResolvedValue(SESSION_A);
    mockResolveGroupOrderActor.mockResolvedValue(null);
    mockGetCartById.mockResolvedValue({ id: CART_ID, items: [] });
    mockAddCartItem.mockResolvedValue({ id: CART_ID, items: [{ id: "line_1" }] });
    mockUpdateCartItem.mockResolvedValue({ id: CART_ID, items: [] });
    mockRemoveCartItem.mockResolvedValue(undefined);
  });

  describe("solo cart", () => {
    it("rejects add for wrong session before mutating", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });

      const result = await addToCartAction(CART_ID, "item_1", 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("CART_ACCESS_DENIED");
        expect(result.error).toBe("Cart not found or access denied");
      }
      expect(mockAddCartItem).not.toHaveBeenCalled();
      expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, SESSION_A, {
        groupOrderActor: null,
        mode: "mutate",
      });
    });

    it("adds item when session matches", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: true,
        cartId: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        isGroupOrder: false,
      });

      const result = await addToCartAction(CART_ID, "item_1", 1);

      expect(result.success).toBe(true);
      expect(mockAddCartItem).toHaveBeenCalledWith(
        CART_ID,
        "item_1",
        1,
        undefined,
        undefined,
        null
      );
    });

    it("rejects update for wrong session before loading cart lines", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });

      const result = await updateCartItemAction(CART_ID, "line_1", 2);

      expect(result).toEqual({
        success: false,
        error: "Cart not found or access denied",
        code: "CART_ACCESS_DENIED",
      });
      expect(mockUpdateCartItem).not.toHaveBeenCalled();
    });

    it("updates item when session matches", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: true,
        cartId: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        isGroupOrder: false,
      });

      const result = await updateCartItemAction(CART_ID, "line_1", 2);

      expect(result?.success).toBe(true);
      expect(mockUpdateCartItem).toHaveBeenCalled();
    });

    it("rejects remove for wrong session before mutating", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });

      const result = await removeFromCartAction(CART_ID, "line_1");

      expect(result).toBeNull();
      expect(mockRemoveCartItem).not.toHaveBeenCalled();
      expect(mockGetCartById).not.toHaveBeenCalled();
    });

    it("removes item when session matches", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: true,
        cartId: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        isGroupOrder: false,
      });

      await removeFromCartAction(CART_ID, "line_1");

      expect(mockRemoveCartItem).toHaveBeenCalledWith(CART_ID, "line_1", null);
      expect(mockGetCartById).toHaveBeenCalledWith(CART_ID);
    });

    it("getCartAction rejects wrong session before loading cart", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });

      const cart = await getCartAction(CART_ID);

      expect(cart).toBeNull();
      expect(mockGetCartById).not.toHaveBeenCalled();
    });
  });

  describe("group cart", () => {
    beforeEach(() => {
      mockResolveGroupOrderActor.mockResolvedValue(participantActor);
    });

    it("allows participant mutation when group actor resolves", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: true,
        cartId: CART_ID,
        sessionId: OTHER_SESSION,
        podId: "pod_1",
        isGroupOrder: true,
      });

      const result = await addToCartAction(CART_ID, "item_1", 1);

      expect(result.success).toBe(true);
      expect(mockAssertCartSessionAccess).toHaveBeenCalledWith(CART_ID, SESSION_A, {
        groupOrderActor: participantActor,
        mode: "mutate",
      });
      expect(mockAddCartItem).toHaveBeenCalledWith(
        CART_ID,
        "item_1",
        1,
        undefined,
        undefined,
        participantActor
      );
    });

    it("rejects mutation without group actor access", async () => {
      mockResolveGroupOrderActor.mockResolvedValue(null);
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });

      const result = await addToCartAction(CART_ID, "item_1", 1);

      expect(result.success).toBe(false);
      expect(mockAddCartItem).not.toHaveBeenCalled();
    });

    it("returns validation error when participant cannot edit another line", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: true,
        cartId: CART_ID,
        sessionId: OTHER_SESSION,
        podId: "pod_1",
        isGroupOrder: true,
      });
      mockUpdateCartItem.mockRejectedValue(
        new CartValidationError(
          "GROUP_ORDER_ITEM_NOT_OWNED",
          "You can only change your own items in this group order."
        )
      );

      const result = await updateCartItemAction(CART_ID, "line_other", 2);

      expect(result).toEqual({
        success: false,
        error: "You can only change your own items in this group order.",
        code: "GROUP_ORDER_ITEM_NOT_OWNED",
      });
    });

    it("host actor can mutate when access passes", async () => {
      mockResolveGroupOrderActor.mockResolvedValue(hostActor);
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: true,
        cartId: CART_ID,
        sessionId: OTHER_SESSION,
        podId: "pod_1",
        isGroupOrder: true,
      });

      const result = await updateCartItemAction(CART_ID, "line_1", 1);

      expect(result?.success).toBe(true);
      expect(mockUpdateCartItem).toHaveBeenCalledWith(
        CART_ID,
        "line_1",
        1,
        undefined,
        undefined,
        hostActor
      );
    });
  });
});
