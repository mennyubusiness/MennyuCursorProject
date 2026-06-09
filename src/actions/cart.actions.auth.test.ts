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

const mockTryRecoverCartForMutation = vi.fn();
const mockResolveCartItemMutationAccess = vi.fn();
const mockDiagnoseCartMutationAccess = vi.fn();
const mockLogCartMutationAccessDenied = vi.fn();

vi.mock("@/lib/cart-mutation-access-recovery", () => ({
  tryRecoverCartForMutation: (...args: unknown[]) => mockTryRecoverCartForMutation(...args),
  resolveCartItemMutationAccess: (...args: unknown[]) => mockResolveCartItemMutationAccess(...args),
  diagnoseCartMutationAccess: (...args: unknown[]) => mockDiagnoseCartMutationAccess(...args),
  logCartMutationAccessDenied: (...args: unknown[]) => mockLogCartMutationAccessDenied(...args),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
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
    mockRemoveCartItem.mockResolvedValue({ id: CART_ID, items: [] });
    mockResolveCartItemMutationAccess.mockResolvedValue({
      status: "ready",
      cartId: CART_ID,
      cartItemId: "line_1",
      actor: null,
      recovered: false,
    });
    mockDiagnoseCartMutationAccess.mockResolvedValue({
      cartExists: true,
      cartPodId: "pod_1",
      cartSessionMatchesRequest: false,
      groupSessionStatus: null,
      denyReason: "session_mismatch",
    });
    mockTryRecoverCartForMutation.mockResolvedValue({
      kind: "blocked",
      error: "Cart not found or access denied",
      code: "CART_ACCESS_DENIED",
    });
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
      expect(mockTryRecoverCartForMutation).not.toHaveBeenCalled();
      expect(mockAddCartItem).toHaveBeenCalledWith(
        CART_ID,
        "item_1",
        1,
        undefined,
        undefined,
        null
      );
    });

    it("recovers stale solo cart id and adds item", async () => {
      const RECOVERED_CART = "cart_recovered";
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });
      mockTryRecoverCartForMutation.mockResolvedValue({
        kind: "use_cart",
        cartId: RECOVERED_CART,
        recovered: true,
        actor: null,
      });
      mockAddCartItem.mockResolvedValue({ id: RECOVERED_CART, items: [{ id: "line_1" }] });

      const result = await addToCartAction(CART_ID, "item_1", 1, undefined, undefined, "pod_1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cart.id).toBe(RECOVERED_CART);
        expect(result.recoveredCart).toBe(true);
      }
      expect(mockAddCartItem).toHaveBeenCalledWith(
        RECOVERED_CART,
        "item_1",
        1,
        undefined,
        undefined,
        null
      );
      expect(mockLogCartMutationAccessDenied).toHaveBeenCalled();
    });

    it("rejects update for stale cart with sync-required instead of raw access denied", async () => {
      mockResolveCartItemMutationAccess.mockResolvedValue({
        status: "sync_required",
        cart: { id: "cart_current", podId: "pod_1", items: [], groups: [], subtotalCents: 0, sessionId: SESSION_A },
        error: "We refreshed your cart. Please try again.",
        code: "CART_SYNC_REQUIRED",
      });

      const result = await updateCartItemAction(CART_ID, "line_1", 2, null, undefined, "pod_1");

      expect(result).toEqual({
        success: false,
        error: "We refreshed your cart. Please try again.",
        code: "CART_SYNC_REQUIRED",
        cart: expect.objectContaining({ id: "cart_current" }),
      });
      expect(mockUpdateCartItem).not.toHaveBeenCalled();
    });

    it("recovers stale solo cart id and updates mapped line", async () => {
      const RECOVERED_CART = "cart_recovered";
      mockResolveCartItemMutationAccess.mockResolvedValue({
        status: "ready",
        cartId: RECOVERED_CART,
        cartItemId: "line_mapped",
        actor: null,
        recovered: true,
      });
      mockUpdateCartItem.mockResolvedValue({ id: RECOVERED_CART, items: [{ id: "line_mapped", quantity: 2 }] });

      const result = await updateCartItemAction(CART_ID, "line_1", 2, null, undefined, "pod_1");

      expect(result?.success).toBe(true);
      if (result?.success) {
        expect(result.recoveredCart).toBe(true);
      }
      expect(mockUpdateCartItem).toHaveBeenCalledWith(
        RECOVERED_CART,
        "line_mapped",
        2,
        null,
        undefined,
        null
      );
    });

    it("updates item when session matches", async () => {
      const result = await updateCartItemAction(CART_ID, "line_1", 2);

      expect(result?.success).toBe(true);
      expect(mockUpdateCartItem).toHaveBeenCalled();
    });

    it("rejects remove for blocked group access", async () => {
      mockResolveCartItemMutationAccess.mockResolvedValue({
        status: "blocked",
        error: "Join this group order to change the cart.",
        code: "GROUP_ORDER_AUTH_REQUIRED",
      });

      const result = await removeFromCartAction(CART_ID, "line_1");

      expect(result).toEqual({
        success: false,
        error: "Join this group order to change the cart.",
        code: "GROUP_ORDER_AUTH_REQUIRED",
      });
      expect(mockRemoveCartItem).not.toHaveBeenCalled();
    });

    it("removes item when access resolves", async () => {
      const result = await removeFromCartAction(CART_ID, "line_1");

      expect(result.success).toBe(true);
      expect(mockRemoveCartItem).toHaveBeenCalledWith(CART_ID, "line_1", null);
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

    it("recovers stale submitted cart to active host group cart on add", async () => {
      const STALE_SUBMITTED = "cart_submitted";
      const ACTIVE_HOST = "cart_active";
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });
      mockTryRecoverCartForMutation.mockResolvedValue({
        kind: "use_cart",
        cartId: ACTIVE_HOST,
        recovered: true,
        actor: hostActor,
      });
      mockAddCartItem.mockResolvedValue({ id: ACTIVE_HOST, items: [{ id: "line_1" }] });

      const result = await addToCartAction(STALE_SUBMITTED, "item_1", 1, undefined, undefined, "pod_1");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.cart.id).toBe(ACTIVE_HOST);
        expect(result.recoveredCart).toBe(true);
      }
      expect(mockAddCartItem).toHaveBeenCalledWith(
        ACTIVE_HOST,
        "item_1",
        1,
        undefined,
        undefined,
        hostActor
      );
    });

    it("rejects mutation without group actor access", async () => {
      mockResolveGroupOrderActor.mockResolvedValue(null);
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });
      mockTryRecoverCartForMutation.mockResolvedValue({
        kind: "blocked",
        error: "Join this group order to change the cart.",
        code: "GROUP_ORDER_AUTH_REQUIRED",
      });

      const result = await addToCartAction(CART_ID, "item_1", 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("GROUP_ORDER_AUTH_REQUIRED");
      }
      expect(mockAddCartItem).not.toHaveBeenCalled();
    });

    it("returns validation error when participant cannot edit another line", async () => {
      mockResolveCartItemMutationAccess.mockResolvedValue({
        status: "ready",
        cartId: CART_ID,
        cartItemId: "line_other",
        actor: participantActor,
        recovered: false,
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
      mockResolveCartItemMutationAccess.mockResolvedValue({
        status: "ready",
        cartId: CART_ID,
        cartItemId: "line_1",
        actor: hostActor,
        recovered: false,
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
