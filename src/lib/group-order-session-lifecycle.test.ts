import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateMany = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderSession: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

describe("group-order-session-lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 2 });
    mockUpdate.mockResolvedValue({});
  });

  it("normalizeGroupOrderJoinCode pads to six digits", async () => {
    const { normalizeGroupOrderJoinCode } = await import("./group-order-session-lifecycle");
    expect(normalizeGroupOrderJoinCode("42")).toBe("000042");
    expect(normalizeGroupOrderJoinCode("1234567")).toBe("123456");
  });

  it("expireStaleGroupOrderSessions marks active and locked_checkout past expiresAt", async () => {
    const now = new Date("2026-06-04T12:00:00Z");
    const { expireStaleGroupOrderSessions } = await import("./group-order-session-lifecycle");
    const count = await expireStaleGroupOrderSessions(now);
    expect(count).toBe(2);
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ["active", "locked_checkout"] },
          expiresAt: { lt: now },
        },
        data: { status: "expired", lockedAt: null },
      })
    );
  });

  it("expireGroupOrderSessionIfStale expires stale active session", async () => {
    const now = new Date("2026-06-04T12:00:00Z");
    mockFindUnique.mockResolvedValue({
      status: "active",
      expiresAt: new Date("2026-06-03T12:00:00Z"),
    });
    const { expireGroupOrderSessionIfStale } = await import("./group-order-session-lifecycle");
    const result = await expireGroupOrderSessionIfStale("gos_1", now);
    expect(result).toBe("expired");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "gos_1" },
        data: { status: "expired", lockedAt: null },
      })
    );
  });

  it("expireGroupOrderSessionIfStale leaves submitted sessions unchanged", async () => {
    mockFindUnique.mockResolvedValue({
      status: "submitted",
      expiresAt: new Date("2026-06-03T12:00:00Z"),
    });
    const { expireGroupOrderSessionIfStale } = await import("./group-order-session-lifecycle");
    const result = await expireGroupOrderSessionIfStale("gos_1");
    expect(result).toBe("unchanged");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
