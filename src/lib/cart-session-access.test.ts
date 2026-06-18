import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/services/group-order.service", () => ({
  resolveActorForGroupCart: vi.fn(),
}));

const mockCartFindUnique = vi.fn();
const mockGroupOrderSessionFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cart: { findUnique: (...args: unknown[]) => mockCartFindUnique(...args) },
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockGroupOrderSessionFindUnique(...args),
    },
  },
}));

import { assertCartSessionAccess } from "./cart-session-access";

const CART_ID = "cart_1";
const SESSION_A = "sess_a";
const SESSION_B = "sess_b";
const HOST_USER = "user_host";
const CUSTOMER_USER = "user_customer";

const hostActor = {
  sessionId: "gos_1",
  sessionStatus: "active" as const,
  cartId: CART_ID,
  podId: "pod_1",
  participantId: "part_host",
  role: "host" as const,
};

describe("assertCartSessionAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupOrderSessionFindUnique.mockResolvedValue(null);
  });

  describe("account-owned solo cart", () => {
    it("allows owner when signed in even if session differs", async () => {
      mockCartFindUnique.mockResolvedValue({
        id: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        userId: CUSTOMER_USER,
      });

      const r = await assertCartSessionAccess(CART_ID, SESSION_B, {
        authUserId: CUSTOMER_USER,
        mode: "mutate",
      });

      expect(r.ok).toBe(true);
      if (r.ok) expect(r.isGroupOrder).toBe(false);
    });

    it("rejects signed-out access to account cart", async () => {
      mockCartFindUnique.mockResolvedValue({
        id: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        userId: CUSTOMER_USER,
      });

      const r = await assertCartSessionAccess(CART_ID, SESSION_A, { mode: "read" });

      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(403);
    });

    it("rejects signed-in user accessing another account cart", async () => {
      mockCartFindUnique.mockResolvedValue({
        id: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        userId: "user_other",
      });

      const r = await assertCartSessionAccess(CART_ID, SESSION_A, {
        authUserId: CUSTOMER_USER,
        mode: "mutate",
      });

      expect(r.ok).toBe(false);
    });

    it("rejects signed-in user accessing guest session cart orphan", async () => {
      mockCartFindUnique.mockResolvedValue({
        id: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        userId: null,
      });

      const r = await assertCartSessionAccess(CART_ID, SESSION_A, {
        authUserId: CUSTOMER_USER,
        mode: "mutate",
      });

      expect(r.ok).toBe(false);
    });
  });

  describe("solo cart", () => {
    beforeEach(() => {
      mockCartFindUnique.mockResolvedValue({
        id: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        userId: null,
      });
    });

    it("allows matching guest session for read/mutate", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_A, { mode: "mutate" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.isGroupOrder).toBe(false);
    });

    it("rejects missing session with 401", async () => {
      const r = await assertCartSessionAccess(CART_ID, null);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(401);
    });

    it("rejects wrong session with 403", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_B);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(403);
    });
  });

  describe("group cart", () => {
    beforeEach(() => {
      mockCartFindUnique.mockResolvedValue({
        id: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        userId: null,
      });
      mockGroupOrderSessionFindUnique.mockResolvedValue({
        hostUserId: HOST_USER,
        status: "active",
      });
    });

    it("allows host checkout with auth user id", async () => {
      const r = await assertCartSessionAccess(CART_ID, null, {
        authUserId: HOST_USER,
        mode: "checkout",
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.isGroupOrder).toBe(true);
    });

    it("allows read/mutate for resolved group actor", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_B, {
        groupOrderActor: hostActor,
        mode: "mutate",
      });
      expect(r.ok).toBe(true);
    });
  });
});
