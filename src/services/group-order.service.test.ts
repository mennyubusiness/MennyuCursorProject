import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirstSession = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindFirstParticipant = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderSession: { findFirst: (...args: unknown[]) => mockFindFirstSession(...args) },
    groupOrderParticipant: {
      findFirst: (...args: unknown[]) => mockFindFirstParticipant(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
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
    mockFindFirstSession.mockResolvedValue(SESSION);
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
    mockFindFirstSession.mockResolvedValue(null);

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
