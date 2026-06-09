import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirstSession = vi.fn();
const mockFindUniqueSession = vi.fn();
const mockSessionUpdate = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindFirstParticipant = vi.fn();
const mockExpireOne = vi.fn();
const mockCartFindUnique = vi.fn();
const mockParticipantUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    cart: {
      findUnique: (...args: unknown[]) => mockCartFindUnique(...args),
    },
    groupOrderSession: {
      findFirst: (...args: unknown[]) => mockFindFirstSession(...args),
      findUnique: (...args: unknown[]) => mockFindUniqueSession(...args),
      update: (...args: unknown[]) => mockSessionUpdate(...args),
    },
    groupOrderParticipant: {
      findFirst: (...args: unknown[]) => mockFindFirstParticipant(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockParticipantUpdateMany(...args),
    },
    cartItem: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("@/lib/group-order-session-lifecycle", () => ({
  expireGroupOrderSessionIfStale: (...args: unknown[]) => mockExpireOne(...args),
  expireStaleGroupOrderSessions: vi.fn().mockResolvedValue(0),
  normalizeGroupOrderJoinCode: (raw: string) => raw.replace(/\D/g, "").slice(0, 6).padStart(6, "0"),
}));

vi.mock("@/lib/phone-e164", () => ({
  normalizePhoneToE164US: (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10) return { ok: false as const, error: "Invalid phone" };
    return { ok: true as const, e164: `+1${digits.slice(-10)}` };
  },
}));

const SESSION = {
  id: "gos_1",
  cartId: "cart_1",
  podId: "pod_1",
  status: "active",
  expiresAt: new Date(Date.now() + 60_000),
};

describe("joinGroupOrderSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpireOne.mockResolvedValue("unchanged");
    mockFindUniqueSession.mockResolvedValue(SESSION);
    mockUpdate.mockResolvedValue({});
  });

  it("creates one participant on first join", async () => {
    mockFindFirstParticipant.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "part_1",
      joinToken: "tok_1",
    });

    const { joinGroupOrderSession } = await import("./group-order.service");
    const res = await joinGroupOrderSession({
      groupOrderSessionId: "gos_1",
      displayName: "Alex",
      phoneRaw: "5551234567",
      joinAttemptKey: "attempt_a",
    });

    expect(res.participantId).toBe("part_1");
    expect(res.joinToken).toMatch(/^[a-f0-9]{64}$/);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns existing participant for duplicate joinAttemptKey without creating", async () => {
    mockFindFirstParticipant.mockResolvedValueOnce({
      id: "part_existing",
      joinToken: "tok_existing",
      leftAt: null,
    });

    const { joinGroupOrderSession } = await import("./group-order.service");
    const res = await joinGroupOrderSession({
      groupOrderSessionId: "gos_1",
      displayName: "Alex",
      phoneRaw: "5551234567",
      joinAttemptKey: "attempt_a",
    });

    expect(res.participantId).toBe("part_existing");
    expect(res.joinToken).toBe("tok_existing");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("restores left participant on rejoin with same phone", async () => {
    mockFindFirstParticipant.mockResolvedValueOnce({
      id: "part_left",
      joinToken: "tok_left",
      leftAt: new Date("2026-01-01"),
    });

    const { joinGroupOrderSession } = await import("./group-order.service");
    const res = await joinGroupOrderSession({
      groupOrderSessionId: "gos_1",
      displayName: "Alex",
      phoneRaw: "5551234567",
    });

    expect(res.participantId).toBe("part_left");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "part_left" },
        data: expect.objectContaining({ leftAt: null }),
      })
    );
  });

  it("resolves unique conflict to existing row (concurrent double-submit)", async () => {
    const p2002 = Object.assign(new Error("Unique"), { code: "P2002" });
    mockCreate.mockRejectedValue(p2002);
    mockFindFirstParticipant
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "part_race",
        joinToken: "tok_race",
        leftAt: null,
      });

    const { joinGroupOrderSession } = await import("./group-order.service");
    const res = await joinGroupOrderSession({
      groupOrderSessionId: "gos_1",
      displayName: "Alex",
      phoneRaw: "5551234567",
      joinAttemptKey: "attempt_race",
    });

    expect(res.participantId).toBe("part_race");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("blocks join when session is locked_checkout", async () => {
    mockFindUniqueSession.mockResolvedValue({ ...SESSION, status: "locked_checkout" });

    const { joinGroupOrderSession } = await import("./group-order.service");
    await expect(
      joinGroupOrderSession({
        groupOrderSessionId: "gos_1",
        displayName: "Alex",
        phoneRaw: "5551234567",
      })
    ).rejects.toThrow(/Joining is paused/);
  });

  it("blocks join when session is expired by status", async () => {
    mockFindUniqueSession.mockResolvedValue({ ...SESSION, status: "expired" });

    const { joinGroupOrderSession } = await import("./group-order.service");
    await expect(
      joinGroupOrderSession({
        groupOrderSessionId: "gos_1",
        displayName: "Alex",
        phoneRaw: "5551234567",
      })
    ).rejects.toThrow(/no longer open/);
  });

  it("reuses participant matched by join cookie", async () => {
    mockFindFirstParticipant.mockResolvedValueOnce({
      id: "part_cookie",
      joinToken: "cookie_tok",
      leftAt: null,
    });

    const { joinGroupOrderSession } = await import("./group-order.service");
    const res = await joinGroupOrderSession({
      groupOrderSessionId: "gos_1",
      displayName: "Alex",
      phoneRaw: "5559999999",
      participantIdFromCookie: "part_cookie",
      joinTokenFromCookie: "cookie_tok",
    });

    expect(res.participantId).toBe("part_cookie");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("generateUniqueJoinCodeForTest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries join code generation on unique collision", async () => {
    mockFindUniqueSession
      .mockResolvedValueOnce({ id: "gos_taken" })
      .mockResolvedValueOnce({ id: "gos_taken2" })
      .mockResolvedValueOnce(null);

    const { generateUniqueJoinCodeForTest } = await import("./group-order.service");
    const code = await generateUniqueJoinCodeForTest();
    expect(code).toMatch(/^\d{6}$/);
    expect(mockFindUniqueSession.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe("unlockGroupOrderSessionFromCheckout", () => {
  beforeEach(() => {
    mockSessionUpdate.mockResolvedValue({});
  });

  it("does not unlock submitted, ended, or expired sessions", async () => {
    const { unlockGroupOrderSessionFromCheckout } = await import("./group-order.service");
    for (const status of ["submitted", "ended", "expired"] as const) {
      mockSessionUpdate.mockClear();
      mockFindUniqueSession.mockResolvedValue({
        id: "gos_1",
        hostUserId: "host_1",
        status,
      });
      await unlockGroupOrderSessionFromCheckout("cart_1", "host_1");
      expect(mockSessionUpdate).not.toHaveBeenCalled();
    }
  });

  it("unlocks locked_checkout for host", async () => {
    mockFindUniqueSession.mockResolvedValue({
      id: "gos_1",
      hostUserId: "host_1",
      status: "locked_checkout",
    });
    const { unlockGroupOrderSessionFromCheckout } = await import("./group-order.service");
    await unlockGroupOrderSessionFromCheckout("cart_1", "host_1");
    expect(mockSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "gos_1" },
        data: { status: "active", lockedAt: null },
      })
    );
  });
});

describe("resolveActiveGroupCartIdForPod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns host active cart before participant markers", async () => {
    mockFindFirstSession.mockResolvedValueOnce({ cartId: "cart_host" });

    const { resolveActiveGroupCartIdForPod } = await import("./group-order.service");
    const cartId = await resolveActiveGroupCartIdForPod("pod_1", {
      markers: { participantId: "part_stale", legacyJoinToken: null },
      hostUserId: "host_1",
    });

    expect(cartId).toBe("cart_host");
    expect(mockFindFirstSession).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          podId: "pod_1",
          hostUserId: "host_1",
        }),
      })
    );
  });
});

describe("resolveGroupCartActorForRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("infers host actor for active session when strict resolution fails", async () => {
    mockFindUniqueSession.mockImplementation(
      async ({ where }: { where: Record<string, string> }) => {
        if (where.cartId === "cart_1") {
          return {
            id: "gos_1",
            cartId: "cart_1",
            podId: "pod_1",
            hostUserId: "host_1",
            status: "active",
            expiresAt: new Date(Date.now() + 60_000),
            participants: [],
          };
        }
        return null;
      }
    );
    mockFindFirstParticipant.mockResolvedValueOnce({ id: "part_host" });

    const { resolveGroupCartActorForRead } = await import("./group-order.service");
    const actor = await resolveGroupCartActorForRead("cart_1", {
      hostUserId: "host_1",
      participantIdFromCookie: "stale_part",
    });

    expect(actor).toMatchObject({ role: "host", cartId: "cart_1", participantId: "part_host" });
  });
});

describe("startGroupOrderSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCartFindUnique.mockResolvedValue({ id: "cart_1", podId: "pod_1" });
    mockParticipantUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("reactivates submitted session for the same host", async () => {
    let cartLookupCount = 0;
    mockFindUniqueSession.mockImplementation(
      async ({ where }: { where: Record<string, string> }) => {
        if ("joinCode" in where) return null;
        if (where.cartId === "cart_1" || where.id === "gos_1") {
          cartLookupCount += 1;
          if (cartLookupCount === 1) {
            return {
              id: "gos_1",
              joinCode: "111111",
              hostUserId: "host_1",
              podId: "pod_1",
            };
          }
          if (cartLookupCount === 2) {
            return { id: "gos_1", joinCode: "111111", status: "submitted" };
          }
        }
        return null;
      }
    );
    mockSessionUpdate.mockResolvedValue({});

    const { startGroupOrderSession } = await import("./group-order.service");
    const res = await startGroupOrderSession({
      hostUserId: "host_1",
      cartId: "cart_1",
      podId: "pod_1",
      hostDisplayName: "Sam",
    });

    expect(res.sessionId).toBe("gos_1");
    expect(res.joinCode).toMatch(/^\d{6}$/);
    expect(mockSessionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "gos_1" },
        data: expect.objectContaining({ status: "active" }),
      })
    );
    expect(mockParticipantUpdateMany).toHaveBeenCalled();
  });
});

describe("enforceGroupOrderCartMutation", () => {
  it("blocks mutations on expired sessions", async () => {
    mockFindUniqueSession.mockResolvedValue({ status: "expired" });
    const { enforceGroupOrderCartMutation } = await import("./group-order.service");
    await expect(
      enforceGroupOrderCartMutation("cart_1", null, { kind: "add" })
    ).rejects.toMatchObject({ code: "GROUP_ORDER_CLOSED" });
  });
});

describe("findExistingParticipantForJoin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers cookie token before phone lookup", async () => {
    mockFindFirstParticipant.mockResolvedValueOnce({
      id: "by_token",
      joinToken: "t1",
      leftAt: null,
    });

    const { findExistingParticipantForJoin } = await import("./group-order.service");
    const row = await findExistingParticipantForJoin("gos_1", {
      participantIdFromCookie: null,
      joinTokenFromCookie: "t1",
      joinAttemptKey: null,
      userId: null,
      phoneE164: "+15551234567",
    });

    expect(row?.id).toBe("by_token");
    expect(mockFindFirstParticipant).toHaveBeenCalledTimes(1);
  });
});
