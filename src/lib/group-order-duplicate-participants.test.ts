import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderParticipant: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

describe("findDuplicateGroupOrderParticipantsByPhone (merge module)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports sessions with duplicate phone rows", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "p1",
        groupOrderSessionId: "gos_1",
        phoneE164: "+15551234567",
        displayName: "Alex",
      },
      {
        id: "p2",
        groupOrderSessionId: "gos_1",
        phoneE164: "+15551234567",
        displayName: "Alex ",
      },
      {
        id: "p3",
        groupOrderSessionId: "gos_2",
        phoneE164: "+15551234567",
        displayName: "Alex",
      },
    ]);

    const { findDuplicateGroupOrderParticipantsByPhone } = await import(
      "./group-order-participant-merge"
    );
    const dupes = await findDuplicateGroupOrderParticipantsByPhone();
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.groupOrderSessionId).toBe("gos_1");
    expect(dupes[0]?.participantIds).toEqual(["p1", "p2"]);
  });

  it("returns empty when no duplicates", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "p1",
        groupOrderSessionId: "gos_1",
        phoneE164: "+15551111111",
        displayName: "A",
      },
      {
        id: "p2",
        groupOrderSessionId: "gos_1",
        phoneE164: "+15552222222",
        displayName: "B",
      },
    ]);

    const { findDuplicateGroupOrderParticipantsByPhone } = await import(
      "./group-order-participant-merge"
    );
    expect(await findDuplicateGroupOrderParticipantsByPhone()).toEqual([]);
  });
});
