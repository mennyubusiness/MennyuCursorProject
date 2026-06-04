import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderParticipant: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

describe("resolveActiveGroupParticipantBinding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves by participant id cookie", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "part_1",
      groupOrderSession: {
        id: "gos_1",
        cartId: "cart_group",
        podId: "pod_1",
        status: "active",
      },
    });

    const { resolveActiveGroupParticipantBinding } = await import("./group-order-participant-resolve");
    const binding = await resolveActiveGroupParticipantBinding({
      participantId: "part_1",
      legacyJoinToken: null,
    });

    expect(binding?.cartId).toBe("cart_group");
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "part_1" }),
      })
    );
  });

  it("falls back to legacy join token cookie", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "part_2",
      groupOrderSession: {
        id: "gos_1",
        cartId: "cart_group",
        podId: "pod_1",
        status: "locked_checkout",
      },
    });

    const { resolveActiveGroupParticipantBinding } = await import("./group-order-participant-resolve");
    const binding = await resolveActiveGroupParticipantBinding({
      participantId: null,
      legacyJoinToken: "tok_legacy",
    });

    expect(binding?.participantId).toBe("part_2");
    expect(binding?.sessionStatus).toBe("locked_checkout");
  });
});
