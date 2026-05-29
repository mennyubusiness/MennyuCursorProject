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

const soloCart = {
  id: CART_ID,
  sessionId: SESSION_A,
  podId: "pod_1",
};

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
    mockCartFindUnique.mockResolvedValue(soloCart);
    mockGroupOrderSessionFindUnique.mockResolvedValue(null);
  });

  describe("solo cart", () => {
    it("allows matching session for read/mutate", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_A, { mode: "mutate" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.isGroupOrder).toBe(false);
    });

    it("rejects missing session with 401", async () => {
      const r = await assertCartSessionAccess(CART_ID, null);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(401);
    });

    it("rejects wrong session with 403 without confirming cart existence", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_B);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe(403);
        expect(r.error).toBe("Cart not found or access denied");
      }
    });

    it("returns 403 when cart id is unknown", async () => {
      mockCartFindUnique.mockResolvedValueOnce(null);
      const r = await assertCartSessionAccess("missing", SESSION_A);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(403);
    });
  });

  describe("group cart", () => {
    beforeEach(() => {
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

    it("rejects non-host checkout", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_A, {
        authUserId: "user_other",
        mode: "checkout",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe(403);
        expect(r.error).toContain("host");
      }
    });

    it("allows read/mutate for resolved group actor", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_B, {
        groupOrderActor: hostActor,
        mode: "mutate",
      });
      expect(r.ok).toBe(true);
    });

    it("rejects read/mutate without group actor even if session matches host cart", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_A, { mode: "mutate" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(403);
    });

    it("rejects checkout when group session is closed", async () => {
      mockGroupOrderSessionFindUnique.mockResolvedValueOnce({
        hostUserId: HOST_USER,
        status: "submitted",
      });
      const r = await assertCartSessionAccess(CART_ID, null, {
        authUserId: HOST_USER,
        mode: "checkout",
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(403);
    });
  });
});
