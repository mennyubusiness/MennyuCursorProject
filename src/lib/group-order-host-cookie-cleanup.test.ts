import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

vi.mock("server-only", () => ({}));

const mockParticipantFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    groupOrderParticipant: {
      findUnique: (...args: unknown[]) => mockParticipantFindUnique(...args),
    },
  },
}));

import { clearStaleGroupParticipantCookiesForNewHostGroup } from "@/lib/group-order-host-cookie-cleanup";
import { GROUP_ORDER_PARTICIPANT_ID_COOKIE } from "@/lib/group-order-participant-cookie";

function mockStore(initial: Record<string, string> = {}) {
  const jar = new Map(Object.entries(initial));
  return {
    get: (name: string) => {
      const value = jar.get(name);
      return value ? { value } : undefined;
    },
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    has: (name: string) => jar.has(name),
    set: vi.fn(),
    delete: vi.fn((name: string) => {
      jar.delete(name);
    }),
  } as unknown as ResponseCookies;
}

describe("clearStaleGroupParticipantCookiesForNewHostGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears participant cookie for terminal session on the same cart being restarted", async () => {
    const store = mockStore({ [GROUP_ORDER_PARTICIPANT_ID_COOKIE]: "part_old" });
    mockParticipantFindUnique.mockResolvedValue({
      role: "participant",
      groupOrderSession: {
        id: "gos_old",
        cartId: "cart_a",
        hostUserId: "other_host",
        status: "submitted",
      },
    });

    const result = await clearStaleGroupParticipantCookiesForNewHostGroup(store, {
      hostUserId: "host_1",
      activeSessionId: "gos_new",
      activeSessionCartId: "cart_a",
    });

    expect(result.cleared).toBe(true);
    expect(store.delete).toHaveBeenCalled();
  });

  it("preserves participant cookie for unrelated submitted tracking session", async () => {
    const store = mockStore({ [GROUP_ORDER_PARTICIPANT_ID_COOKIE]: "part_track" });
    mockParticipantFindUnique.mockResolvedValue({
      role: "participant",
      groupOrderSession: {
        id: "gos_submitted",
        cartId: "cart_other",
        hostUserId: "other_host",
        status: "submitted",
      },
    });

    const result = await clearStaleGroupParticipantCookiesForNewHostGroup(store, {
      hostUserId: "host_1",
      activeSessionId: "gos_new",
      activeSessionCartId: "cart_a",
    });

    expect(result.cleared).toBe(false);
    expect(store.delete).not.toHaveBeenCalled();
  });

  it("clears stale participant cookie pointing at a different active session", async () => {
    const store = mockStore({ [GROUP_ORDER_PARTICIPANT_ID_COOKIE]: "part_other" });
    mockParticipantFindUnique.mockResolvedValue({
      role: "participant",
      groupOrderSession: {
        id: "gos_other",
        cartId: "cart_b",
        hostUserId: "other_host",
        status: "active",
      },
    });

    const result = await clearStaleGroupParticipantCookiesForNewHostGroup(store, {
      hostUserId: "host_1",
      activeSessionId: "gos_new",
      activeSessionCartId: "cart_a",
    });

    expect(result.cleared).toBe(true);
    expect(store.delete).toHaveBeenCalled();
  });
});
