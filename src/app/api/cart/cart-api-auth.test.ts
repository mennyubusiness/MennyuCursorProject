import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockAssertCartSessionAccess = vi.fn();
const mockResolveGroupOrderActorFromRequest = vi.fn();
const mockGetQuickCartPayload = vi.fn();
const mockAuth = vi.fn();
const mockGetCartById = vi.fn();
const mockAddCartItem = vi.fn();
const mockUpdateCartItem = vi.fn();
const mockRemoveCartItem = vi.fn();

vi.mock("@/lib/cart-session-access", () => ({
  assertCartSessionAccess: (...args: unknown[]) => mockAssertCartSessionAccess(...args),
  resolveGroupOrderActorFromRequest: (...args: unknown[]) =>
    mockResolveGroupOrderActorFromRequest(...args),
}));

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    cartItem: {
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));

vi.mock("@/services/cart.service", () => ({
  getQuickCartPayload: (...args: unknown[]) => mockGetQuickCartPayload(...args),
  getCartById: (...args: unknown[]) => mockGetCartById(...args),
  addCartItem: (...args: unknown[]) => mockAddCartItem(...args),
  updateCartItem: (...args: unknown[]) => mockUpdateCartItem(...args),
  removeCartItem: (...args: unknown[]) => mockRemoveCartItem(...args),
  CartValidationError: class CartValidationError extends Error {},
}));

import { GET, POST, PATCH, DELETE } from "./route";

const CART_ID = "cart_1";
const SESSION_A = "sess_a";

function requestWithSession(url: string, sessionId?: string) {
  const headers: Record<string, string> = {};
  if (sessionId) headers.cookie = `mennyu_session=${encodeURIComponent(sessionId)}`;
  return new NextRequest(url, { headers });
}

describe("/api/cart session ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveGroupOrderActorFromRequest.mockResolvedValue(null);
    mockAuth.mockResolvedValue(null);
    mockGetQuickCartPayload.mockResolvedValue({
      scope: "neutral",
      cart: null,
      browsingPodId: null,
      browsingPodName: null,
      assignedPodId: null,
      assignedPodName: null,
      requiresClearToSwitchPod: false,
    });
  });

  describe("GET ?cartId=", () => {
    it("rejects wrong session before returning cart contents", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });

      const res = await GET(
        requestWithSession(`http://localhost/api/cart?cartId=${CART_ID}`, SESSION_A)
      );

      expect(res.status).toBe(403);
      expect(mockGetCartById).not.toHaveBeenCalled();
    });

    it("loads cart for authorized session", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: true,
        cartId: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        isGroupOrder: false,
      });
      mockGetCartById.mockResolvedValue({ id: CART_ID, items: [{ id: "line_1" }] });

      const res = await GET(
        requestWithSession(`http://localhost/api/cart?cartId=${CART_ID}`, SESSION_A)
      );

      expect(res.status).toBe(200);
      expect(mockGetCartById).toHaveBeenCalledWith(CART_ID, null);
    });
  });

  describe("GET ?browsePodId=", () => {
    it("loads quick cart payload without creating a cart", async () => {
      const res = await GET(
        requestWithSession("http://localhost/api/cart?browsePodId=pod_1", SESSION_A)
      );

      expect(res.status).toBe(200);
      expect(mockGetQuickCartPayload).toHaveBeenCalledWith(SESSION_A, "pod_1", {
        markers: { participantId: null, legacyJoinToken: null },
        hostUserId: null,
      });
      expect(mockAssertCartSessionAccess).not.toHaveBeenCalled();
    });

    it("passes participant id cookie into quick cart load", async () => {
      const res = await GET(
        new NextRequest("http://localhost/api/cart?browsePodId=pod_1", {
          headers: {
            cookie: `mennyu_session=${SESSION_A}; mennyu_go_participant=part_abc`,
          },
        })
      );

      expect(res.status).toBe(200);
      expect(mockGetQuickCartPayload).toHaveBeenCalledWith(SESSION_A, "pod_1", {
        markers: { participantId: "part_abc", legacyJoinToken: null },
        hostUserId: null,
      });
    });
  });

  describe("POST mutations", () => {
    it("rejects unauthorized add before mutating", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });

      const res = await POST(
        new NextRequest("http://localhost/api/cart", {
          method: "POST",
          headers: { cookie: `mennyu_session=${SESSION_A}` },
          body: JSON.stringify({ cartId: CART_ID, menuItemId: "item_1", quantity: 1 }),
        })
      );

      expect(res.status).toBe(403);
      expect(mockAddCartItem).not.toHaveBeenCalled();
    });

    it("adds item when session matches", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: true,
        cartId: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        isGroupOrder: false,
      });
      mockAddCartItem.mockResolvedValue({ id: CART_ID, items: [] });

      const res = await POST(
        new NextRequest("http://localhost/api/cart", {
          method: "POST",
          headers: { cookie: `mennyu_session=${SESSION_A}` },
          body: JSON.stringify({ cartId: CART_ID, menuItemId: "item_1", quantity: 1 }),
        })
      );

      expect(res.status).toBe(200);
      expect(mockAddCartItem).toHaveBeenCalled();
    });
  });

  describe("PATCH and DELETE", () => {
    it("rejects unauthorized update", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 401,
        error: "Session required",
      });

      const res = await PATCH(
        new NextRequest("http://localhost/api/cart", {
          method: "PATCH",
          body: JSON.stringify({ cartId: CART_ID, cartItemId: "line_1", quantity: 2 }),
        })
      );

      expect(res.status).toBe(401);
      expect(mockUpdateCartItem).not.toHaveBeenCalled();
    });

    it("rejects unauthorized remove", async () => {
      mockAssertCartSessionAccess.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Cart not found or access denied",
      });

      const res = await DELETE(
        requestWithSession(
          `http://localhost/api/cart?cartId=${CART_ID}&cartItemId=line_1`,
          SESSION_A
        )
      );

      expect(res.status).toBe(403);
      expect(mockRemoveCartItem).not.toHaveBeenCalled();
    });
  });
});
