import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/services/group-order.service", () => ({
  resolveActorForGroupCart: vi.fn(),
}));

const mockResolveGroupParticipantForSession = vi.fn();

vi.mock("@/lib/group-participant-order-access", () => ({
  resolveGroupParticipantForSession: (...args: unknown[]) =>
    mockResolveGroupParticipantForSession(...args),
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
    mockResolveGroupParticipantForSession.mockResolvedValue(null);
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
        id: "gos_1",
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

    it("blocks host checkout when group session is expired", async () => {
      mockGroupOrderSessionFindUnique.mockResolvedValue({
        id: "gos_1",
        hostUserId: HOST_USER,
        status: "expired",
      });

      const r = await assertCartSessionAccess(CART_ID, null, {
        authUserId: HOST_USER,
        mode: "checkout",
      });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe(403);
        expect(r.error).toContain("closed");
      }
    });

    it("blocks host checkout when group session is ended", async () => {
      mockGroupOrderSessionFindUnique.mockResolvedValue({
        id: "gos_1",
        hostUserId: HOST_USER,
        status: "ended",
      });

      const r = await assertCartSessionAccess(CART_ID, null, {
        authUserId: HOST_USER,
        mode: "checkout",
      });

      expect(r.ok).toBe(false);
    });

    it("blocks non-host checkout on active group cart", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_A, {
        authUserId: CUSTOMER_USER,
        mode: "checkout",
      });

      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("host");
    });

    it("blocks checkout when host auth matches but participant cookie is present", async () => {
      mockResolveGroupParticipantForSession.mockResolvedValue({
        id: "part_guest",
        role: "participant",
        displayName: "Alex",
        leftAt: null,
      });

      const r = await assertCartSessionAccess(CART_ID, SESSION_A, {
        authUserId: HOST_USER,
        mode: "checkout",
        participantMarkers: { participantId: "part_guest", legacyJoinToken: null },
      });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.status).toBe(403);
        expect(r.error).toContain("host");
      }
      expect(mockResolveGroupParticipantForSession).toHaveBeenCalledWith("gos_1", {
        participantId: "part_guest",
        legacyJoinToken: null,
      });
    });

    it("blocks checkout for resolved group participant actor", async () => {
      const r = await assertCartSessionAccess(CART_ID, SESSION_A, {
        groupOrderActor: {
          sessionId: "gos_1",
          sessionStatus: "active",
          cartId: CART_ID,
          podId: "pod_1",
          participantId: "part_guest",
          role: "participant",
        },
        mode: "checkout",
      });

      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("host");
    });

    it("blocks mutate access on expired group cart even for host owner", async () => {
      mockCartFindUnique.mockResolvedValue({
        id: CART_ID,
        sessionId: SESSION_A,
        podId: "pod_1",
        userId: HOST_USER,
      });
      mockGroupOrderSessionFindUnique.mockResolvedValue({
        id: "gos_1",
        hostUserId: HOST_USER,
        status: "expired",
      });

      const r = await assertCartSessionAccess(CART_ID, SESSION_A, {
        authUserId: HOST_USER,
        mode: "mutate",
      });

      expect(r.ok).toBe(false);
    });
  });
});
