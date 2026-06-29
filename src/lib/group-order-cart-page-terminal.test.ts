import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const mockAuth = vi.fn();
const mockFindSessionByCartId = vi.fn();
const mockResolveGroupParticipantForSession = vi.fn();
const mockIsHandoffActive = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderSession: { findFirst: vi.fn() },
    cart: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/cart.service", () => ({
  CART_DISPLAY_SESSION_CART_INCLUDE: {},
}));

vi.mock("@/services/group-order.service", () => ({
  findSessionByCartId: (...args: unknown[]) => mockFindSessionByCartId(...args),
  resolveActorForGroupCart: vi.fn().mockResolvedValue(null),
  startGroupOrderSession: vi.fn(),
  unlockGroupOrderSessionFromCheckout: vi.fn(),
}));

vi.mock("@/lib/group-order-session-lifecycle", () => ({
  expireGroupOrderSessionIfStale: vi.fn().mockResolvedValue("unchanged"),
}));

vi.mock("@/lib/group-participant-order-access", () => ({
  findOrderIdForGroupOrderSession: vi.fn().mockResolvedValue("ord_old"),
  resolveGroupParticipantForSession: (...args: unknown[]) =>
    mockResolveGroupParticipantForSession(...args),
}));

vi.mock("@/lib/group-participant-submitted-cart", () => ({
  isParticipantGroupOrderHandoffActive: (...args: unknown[]) => mockIsHandoffActive(...args),
}));

describe("getGroupOrderStateForCartPage terminal submitted sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockResolveGroupParticipantForSession.mockResolvedValue(null);
    mockIsHandoffActive.mockResolvedValue(false);
  });

  it("deactivates submitted group state when handoff is complete", async () => {
    mockFindSessionByCartId.mockResolvedValue({
      id: "gos_1",
      joinCode: "123456",
      status: "submitted",
      podId: "pod_1",
      hostUserId: "user_host",
      participants: [{ id: "p_guest", displayName: "Alex", role: "participant", leftAt: null }],
    });

    const { getGroupOrderStateForCartPage } = await import("./group-order-cart-page");
    const state = await getGroupOrderStateForCartPage("cart_1", {
      participantMarkers: { participantId: "p_guest", legacyJoinToken: null },
    });
    expect(state).toEqual({ active: false });
  });
});
