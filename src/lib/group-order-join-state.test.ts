import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockExpireBatch = vi.fn();
const mockExpireOne = vi.fn();
const mockFindOrderId = vi.fn();
const mockResolveParticipant = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderSession: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/group-order-session-lifecycle", () => ({
  expireStaleGroupOrderSessions: (...args: unknown[]) => mockExpireBatch(...args),
  expireGroupOrderSessionIfStale: (...args: unknown[]) => mockExpireOne(...args),
  normalizeGroupOrderJoinCode: (raw: string) => raw.replace(/\D/g, "").slice(0, 6).padStart(6, "0"),
}));

vi.mock("@/lib/group-participant-order-access", () => ({
  findOrderIdForGroupOrderSession: (...args: unknown[]) => mockFindOrderId(...args),
  resolveGroupParticipantForSession: (...args: unknown[]) => mockResolveParticipant(...args),
}));

const POD = { name: "Test Pod" };

function freshSession(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "gos_1",
    status,
    podId: "pod_1",
    hostUserId: "host_user",
    pod: POD,
    ...overrides,
  };
}

describe("resolveGroupOrderJoinState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExpireBatch.mockResolvedValue(0);
    mockExpireOne.mockResolvedValue("unchanged");
    mockResolveParticipant.mockResolvedValue(null);
    mockFindOrderId.mockResolvedValue(null);
  });

  it("returns not_found when code does not match", async () => {
    mockFindFirst.mockResolvedValue(null);
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      joinCode: "999999",
      markers: { participantId: null, legacyJoinToken: null },
    });
    expect(state.kind).toBe("not_found");
    expect(mockExpireBatch).toHaveBeenCalled();
  });

  it("active session without cookie → can_join", async () => {
    mockFindFirst.mockResolvedValue(freshSession("active", { cartId: "cart_1" }));
    mockFindUnique.mockResolvedValue(freshSession("active"));
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      joinCode: "123456",
      markers: { participantId: null, legacyJoinToken: null },
    });
    expect(state).toEqual({ kind: "can_join", sessionId: "gos_1", podName: "Test Pod" });
  });

  it("locked_checkout without cookie → locked_checkout join paused", async () => {
    mockFindFirst.mockResolvedValue(freshSession("locked_checkout"));
    mockFindUnique.mockResolvedValue(freshSession("locked_checkout"));
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      joinCode: "123456",
      markers: { participantId: null, legacyJoinToken: null },
    });
    expect(state).toMatchObject({
      kind: "locked_checkout",
      participantAccess: false,
      podId: "pod_1",
    });
  });

  it("locked_checkout with participant cookie → participantAccess true", async () => {
    mockFindFirst.mockResolvedValue(freshSession("locked_checkout"));
    mockFindUnique.mockResolvedValue(freshSession("locked_checkout"));
    mockResolveParticipant.mockResolvedValue({
      id: "part_1",
      role: "participant",
      displayName: "Alex",
    });
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      joinCode: "123456",
      markers: { participantId: "part_1", legacyJoinToken: null },
    });
    expect(state).toMatchObject({ kind: "locked_checkout", participantAccess: true });
  });

  it("submitted with participant cookie and order → submitted_with_access", async () => {
    mockFindFirst.mockResolvedValue(freshSession("submitted"));
    mockFindUnique.mockResolvedValue(freshSession("submitted"));
    mockResolveParticipant.mockResolvedValue({ id: "part_1", role: "participant" });
    mockFindOrderId.mockResolvedValue("ord_1");
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      joinCode: "123456",
      markers: { participantId: "part_1", legacyJoinToken: null },
    });
    expect(state).toEqual({ kind: "submitted_with_access", orderId: "ord_1" });
  });

  it("submitted without cookie → submitted_no_access (no order id exposed)", async () => {
    mockFindFirst.mockResolvedValue(freshSession("submitted"));
    mockFindUnique.mockResolvedValue(freshSession("submitted"));
    mockFindOrderId.mockResolvedValue("ord_secret");
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      joinCode: "123456",
      markers: { participantId: null, legacyJoinToken: null },
    });
    expect(state).toEqual({ kind: "submitted_no_access", podName: "Test Pod" });
  });

  it("ended → ended message state", async () => {
    mockFindFirst.mockResolvedValue(freshSession("ended"));
    mockFindUnique.mockResolvedValue(freshSession("ended"));
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      joinCode: "123456",
      markers: { participantId: null, legacyJoinToken: null },
    });
    expect(state).toEqual({ kind: "ended", podName: "Test Pod" });
  });

  it("after expiration refresh → expired", async () => {
    mockFindFirst.mockResolvedValue(freshSession("active"));
    mockExpireOne.mockResolvedValue("expired");
    mockFindUnique.mockResolvedValue(freshSession("expired"));
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      joinCode: "123456",
      markers: { participantId: null, legacyJoinToken: null },
    });
    expect(state).toEqual({ kind: "expired", podName: "Test Pod" });
  });

  it("host user → host_view", async () => {
    mockFindUnique.mockResolvedValue(freshSession("active"));
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      sessionId: "gos_1",
      markers: { participantId: null, legacyJoinToken: null },
      hostUserId: "host_user",
    });
    expect(state).toEqual({ kind: "host_view", podId: "pod_1" });
  });

  it("existing participant on active session → already_joined", async () => {
    mockFindUnique.mockResolvedValue(freshSession("active"));
    mockResolveParticipant.mockResolvedValue({ id: "part_1", role: "participant" });
    const { resolveGroupOrderJoinState } = await import("./group-order-join-state");
    const state = await resolveGroupOrderJoinState({
      sessionId: "gos_1",
      markers: { participantId: "part_1", legacyJoinToken: null },
    });
    expect(state).toEqual({ kind: "already_joined", podId: "pod_1" });
  });
});
