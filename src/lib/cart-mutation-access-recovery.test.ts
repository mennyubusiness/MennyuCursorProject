import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockCartFindUnique = vi.fn();
const mockGroupOrderSessionFindUnique = vi.fn();
const mockMenuItemFindUnique = vi.fn();
const mockPodVendorFindUnique = vi.fn();
const mockPodVendorFindFirst = vi.fn();
const mockCartItemFindFirst = vi.fn();
const mockCartItemFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cart: { findUnique: (...args: unknown[]) => mockCartFindUnique(...args) },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockGroupOrderSessionFindUnique(...args),
    },
    menuItem: { findUnique: (...args: unknown[]) => mockMenuItemFindUnique(...args) },
    podVendor: {
      findUnique: (...args: unknown[]) => mockPodVendorFindUnique(...args),
      findFirst: (...args: unknown[]) => mockPodVendorFindFirst(...args),
    },
    cartItem: {
      findFirst: (...args: unknown[]) => mockCartItemFindFirst(...args),
      findMany: (...args: unknown[]) => mockCartItemFindMany(...args),
    },
  },
}));

const mockAssertCartSessionAccess = vi.fn();
vi.mock("@/lib/cart-session-access", () => ({
  assertCartSessionAccess: (...args: unknown[]) => mockAssertCartSessionAccess(...args),
}));

const mockResolveGroupOrderActor = vi.fn();
vi.mock("@/actions/group-order-context", () => ({
  resolveGroupOrderActorForCartMutation: (...args: unknown[]) => mockResolveGroupOrderActor(...args),
}));

const mockGetMennyuSessionIdForRequest = vi.fn();
const mockGetOrCreateMennyuSessionIdForCart = vi.fn();
vi.mock("@/lib/session-request", () => ({
  getMennyuSessionIdForRequest: (...args: unknown[]) => mockGetMennyuSessionIdForRequest(...args),
  getOrCreateMennyuSessionIdForCart: (...args: unknown[]) =>
    mockGetOrCreateMennyuSessionIdForCart(...args),
}));

const mockResolveActiveGroupCartIdForPod = vi.fn();
vi.mock("@/services/group-order.service", () => ({
  resolveActiveGroupCartIdForPod: (...args: unknown[]) => mockResolveActiveGroupCartIdForPod(...args),
}));

const mockGetOrCreateCartForVendorMenuPage = vi.fn();
const mockGetCartByIdForMutation = vi.fn();
vi.mock("@/services/cart.service", () => ({
  getOrCreateCartForVendorMenuPage: (...args: unknown[]) => mockGetOrCreateCartForVendorMenuPage(...args),
  getCartByIdForMutation: (...args: unknown[]) => mockGetCartByIdForMutation(...args),
}));

import {
  diagnoseCartMutationAccess,
  findEquivalentCartLineId,
  logCartMutationAccessDenied,
  resolveCartItemMutationAccess,
  tryRecoverCartForMutation,
} from "@/lib/cart-mutation-access-recovery";

const STALE_CART = "cart_stale";
const CURRENT_CART = "cart_current";
const GROUP_CART = "cart_group";
const POD_A = "pod_a";
const MENU_ITEM = "item_1";
const SESSION = "sess_current";

describe("cart-mutation-access-recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMennyuSessionIdForRequest.mockResolvedValue(SESSION);
    mockGetOrCreateMennyuSessionIdForCart.mockResolvedValue(SESSION);
    mockResolveGroupOrderActor.mockResolvedValue(null);
    mockResolveActiveGroupCartIdForPod.mockResolvedValue(null);
    mockMenuItemFindUnique.mockResolvedValue({ vendorId: "vendor_1" });
    mockPodVendorFindUnique.mockResolvedValue({ podId: POD_A });
    mockPodVendorFindFirst.mockResolvedValue({ podId: POD_A });
    mockCartFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === STALE_CART) {
        return { id: STALE_CART, sessionId: "sess_old", podId: POD_A };
      }
      if (where.id === CURRENT_CART) {
        return { id: CURRENT_CART, sessionId: SESSION, podId: POD_A };
      }
      return null;
    });
    mockGroupOrderSessionFindUnique.mockImplementation(
      async ({ where }: { where: { cartId: string } }) => {
        if (where.cartId === GROUP_CART) {
          return { status: "active", hostUserId: "user_host" };
        }
        return null;
      }
    );
    mockGetOrCreateCartForVendorMenuPage.mockResolvedValue({
      id: CURRENT_CART,
      podId: POD_A,
      sessionId: SESSION,
      items: [],
    });
    mockGetCartByIdForMutation.mockResolvedValue({
      id: CURRENT_CART,
      podId: POD_A,
      sessionId: SESSION,
      items: [],
      groups: [],
      subtotalCents: 0,
    });
    mockCartItemFindFirst.mockResolvedValue(null);
    mockCartItemFindMany.mockResolvedValue([]);
    mockAssertCartSessionAccess.mockImplementation(
      async (
        cartId: string,
        sessionId: string | null,
        options?: { groupOrderActor?: unknown }
      ) => {
        if (cartId === STALE_CART) {
          return { ok: false, status: 403, error: "Cart not found or access denied" };
        }
        if (cartId === CURRENT_CART && sessionId === SESSION) {
          return {
            ok: true,
            cartId: CURRENT_CART,
            sessionId: SESSION,
            podId: POD_A,
            isGroupOrder: false,
          };
        }
        if (cartId === GROUP_CART && options?.groupOrderActor) {
          return {
            ok: true,
            cartId: GROUP_CART,
            sessionId: "gos_sess",
            podId: POD_A,
            isGroupOrder: true,
          };
        }
        return { ok: false, status: 403, error: "Cart not found or access denied" };
      }
    );
  });

  describe("diagnoseCartMutationAccess", () => {
    it("reports session mismatch for solo stale cart", async () => {
      const diagnostic = await diagnoseCartMutationAccess({
        cartId: STALE_CART,
        requestSessionId: SESSION,
        groupOrderActor: null,
      });
      expect(diagnostic.cartExists).toBe(true);
      expect(diagnostic.denyReason).toBe("session_mismatch");
      expect(diagnostic.cartSessionMatchesRequest).toBe(false);
    });

    it("reports cart_not_found when cart row missing", async () => {
      mockCartFindUnique.mockResolvedValue(null);
      const diagnostic = await diagnoseCartMutationAccess({
        cartId: "missing",
        requestSessionId: SESSION,
        groupOrderActor: null,
      });
      expect(diagnostic.denyReason).toBe("cart_not_found");
    });
  });

  describe("tryRecoverCartForMutation", () => {
    it("recovers signed-in solo add from stale cart to current session cart", async () => {
      const result = await tryRecoverCartForMutation({
        requestedCartId: STALE_CART,
        menuItemId: MENU_ITEM,
        podIdHint: POD_A,
        requestSessionId: SESSION,
        authUserId: "user_1",
        markers: { participantId: null, legacyJoinToken: null },
      });

      expect(result).toEqual({
        kind: "use_cart",
        cartId: CURRENT_CART,
        recovered: true,
        actor: null,
      });
      expect(mockGetOrCreateCartForVendorMenuPage).toHaveBeenCalledWith(POD_A, SESSION);
    });

    it("does not recover to solo cart when active group cart resolves", async () => {
      mockResolveActiveGroupCartIdForPod.mockResolvedValue(GROUP_CART);
      const hostActor = {
        sessionId: "gos_1",
        sessionStatus: "active" as const,
        cartId: GROUP_CART,
        podId: POD_A,
        participantId: "part_host",
        role: "host" as const,
      };
      mockResolveGroupOrderActor.mockResolvedValue(hostActor);

      const result = await tryRecoverCartForMutation({
        requestedCartId: STALE_CART,
        menuItemId: MENU_ITEM,
        podIdHint: POD_A,
        requestSessionId: SESSION,
        authUserId: "user_host",
        markers: { participantId: null, legacyJoinToken: null },
      });

      expect(result).toEqual({
        kind: "use_cart",
        cartId: GROUP_CART,
        recovered: true,
        actor: hostActor,
      });
      expect(mockGetOrCreateCartForVendorMenuPage).not.toHaveBeenCalled();
    });

    it("blocks solo fallback for active group participant without access", async () => {
      mockResolveActiveGroupCartIdForPod.mockResolvedValue(GROUP_CART);
      mockResolveGroupOrderActor.mockResolvedValue(null);

      const result = await tryRecoverCartForMutation({
        requestedCartId: STALE_CART,
        menuItemId: MENU_ITEM,
        podIdHint: POD_A,
        requestSessionId: SESSION,
        authUserId: null,
        markers: { participantId: null, legacyJoinToken: null },
      });

      expect(result).toEqual({
        kind: "blocked",
        error: "Join this group order to change the cart.",
        code: "GROUP_ORDER_AUTH_REQUIRED",
      });
    });

    it("blocks mutation for submitted group cart without solo fallback", async () => {
      mockGroupOrderSessionFindUnique.mockImplementation(
        async ({ where }: { where: { cartId: string } }) => {
          if (where.cartId === STALE_CART) return { status: "submitted" };
          return null;
        }
      );

      const result = await tryRecoverCartForMutation({
        requestedCartId: STALE_CART,
        menuItemId: MENU_ITEM,
        podIdHint: POD_A,
        requestSessionId: SESSION,
        authUserId: "user_1",
        markers: { participantId: null, legacyJoinToken: null },
      });

      expect(result).toEqual({
        kind: "blocked",
        error: "This group order is closed.",
        code: "GROUP_ORDER_CLOSED",
      });
      expect(mockGetOrCreateCartForVendorMenuPage).not.toHaveBeenCalled();
    });

    it("rejects pod hint mismatch to avoid cross-pod recovery", async () => {
      mockPodVendorFindUnique.mockResolvedValue(null);
      mockPodVendorFindFirst.mockResolvedValue({ podId: "pod_b" });

      const result = await tryRecoverCartForMutation({
        requestedCartId: STALE_CART,
        menuItemId: MENU_ITEM,
        podIdHint: POD_A,
        requestSessionId: SESSION,
        authUserId: "user_1",
        markers: { participantId: null, legacyJoinToken: null },
      });

      expect(result.kind).toBe("blocked");
      if (result.kind === "blocked") {
        expect(result.code).toBe("CART_ACCESS_DENIED");
      }
    });
  });

  describe("resolveCartItemMutationAccess", () => {
    it("returns ready when line exists on accessible cart", async () => {
      mockCartItemFindFirst.mockResolvedValueOnce({ id: "line_1" });

      const result = await resolveCartItemMutationAccess({
        requestedCartId: CURRENT_CART,
        cartItemId: "line_1",
        podIdHint: POD_A,
        requestSessionId: SESSION,
        authUserId: "user_1",
        markers: { participantId: null, legacyJoinToken: null },
        action: "updateCartItem",
      });

      expect(result).toEqual({
        status: "ready",
        cartId: CURRENT_CART,
        cartItemId: "line_1",
        actor: null,
        recovered: false,
      });
    });

    it("maps equivalent line after stale solo cart recovery", async () => {
      mockAssertCartSessionAccess.mockImplementation(async (cartId: string) => {
        if (cartId === STALE_CART) {
          return { ok: false, status: 403, error: "Cart not found or access denied" };
        }
        if (cartId === CURRENT_CART) {
          return {
            ok: true,
            cartId: CURRENT_CART,
            sessionId: SESSION,
            podId: POD_A,
            isGroupOrder: false,
          };
        }
        return { ok: false, status: 403, error: "Cart not found or access denied" };
      });
      mockCartItemFindFirst.mockImplementation(async ({ where }: { where: { id: string; cartId: string } }) => {
        if (where.cartId === STALE_CART && where.id === "line_stale") {
          return {
            menuItemId: MENU_ITEM,
            specialInstructions: null,
            groupOrderParticipantId: null,
            selections: [],
          };
        }
        return null;
      });
      mockCartItemFindMany.mockResolvedValueOnce([
        {
          id: "line_mapped",
          specialInstructions: null,
          groupOrderParticipantId: null,
          selections: [],
        },
      ]);

      const result = await resolveCartItemMutationAccess({
        requestedCartId: STALE_CART,
        cartItemId: "line_stale",
        podIdHint: POD_A,
        requestSessionId: SESSION,
        authUserId: "user_1",
        markers: { participantId: null, legacyJoinToken: null },
        action: "updateCartItem",
      });

      expect(result).toEqual({
        status: "ready",
        cartId: CURRENT_CART,
        cartItemId: "line_mapped",
        actor: null,
        recovered: true,
      });
    });

    it("returns sync-required when stale line cannot be mapped", async () => {
      mockAssertCartSessionAccess.mockImplementation(async (cartId: string) => {
        if (cartId === STALE_CART) {
          return { ok: false, status: 403, error: "Cart not found or access denied" };
        }
        if (cartId === CURRENT_CART) {
          return {
            ok: true,
            cartId: CURRENT_CART,
            sessionId: SESSION,
            podId: POD_A,
            isGroupOrder: false,
          };
        }
        return { ok: false, status: 403, error: "Cart not found or access denied" };
      });
      mockCartItemFindFirst.mockResolvedValue(null);
      mockCartItemFindMany.mockResolvedValue([]);

      const result = await resolveCartItemMutationAccess({
        requestedCartId: STALE_CART,
        cartItemId: "line_stale",
        podIdHint: POD_A,
        requestSessionId: SESSION,
        authUserId: "user_1",
        markers: { participantId: null, legacyJoinToken: null },
        action: "removeFromCart",
      });

      expect(result.status).toBe("sync_required");
      if (result.status === "sync_required") {
        expect(result.code).toBe("CART_SYNC_REQUIRED");
        expect(result.cart.id).toBe(CURRENT_CART);
      }
    });
  });

  describe("findEquivalentCartLineId", () => {
    it("matches menu item and configuration key", async () => {
      const configurationKey = "\0opt_1:1";
      mockCartItemFindMany.mockResolvedValueOnce([
        {
          id: "line_match",
          specialInstructions: null,
          groupOrderParticipantId: null,
          selections: [{ modifierOptionId: "opt_1", quantity: 1 }],
        },
      ]);

      const lineId = await findEquivalentCartLineId(
        CURRENT_CART,
        {
          menuItemId: MENU_ITEM,
          configurationKey,
          groupOrderParticipantId: null,
        },
        null
      );

      expect(lineId).toBe("line_match");
    });
  });

  describe("logCartMutationAccessDenied", () => {
    it("logs safe diagnostic context without throwing", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logCartMutationAccessDenied({
        action: "addToCart",
        cartId: STALE_CART,
        menuItemId: MENU_ITEM,
        derivedPodId: POD_A,
        requestSessionPresent: true,
        authUserId: "user_1",
        diagnostic: {
          cartExists: true,
          cartPodId: POD_A,
          cartSessionMatchesRequest: false,
          groupSessionStatus: null,
          denyReason: "session_mismatch",
        },
        accessCode: "CART_ACCESS_DENIED",
      });
      expect(warnSpy).toHaveBeenCalled();
      const payload = warnSpy.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(payload).toMatchObject({
        cartId: STALE_CART,
        menuItemId: MENU_ITEM,
        denyReason: "session_mismatch",
      });
      expect(payload).not.toHaveProperty("cookie");
      warnSpy.mockRestore();
    });
  });
});
