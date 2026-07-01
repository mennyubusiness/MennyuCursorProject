import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    podVendorInvite: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/auth/secure-invite-token", () => ({
  hashSecureInviteToken: (token: string) => `hash:${token}`,
}));

import {
  getValidatedPendingVendorInviteForUser,
  persistPendingVendorInviteForUser,
  persistPendingVendorInviteFromReturnPath,
} from "@/lib/auth/pending-vendor-invite.server";

describe("persistPendingVendorInviteForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it("stores invite id and vendor registration intent on user", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "inv_1",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
      invitedEmail: "chef@example.com",
      pod: { id: "pod_1", name: "Garage Pod" },
    });

    const result = await persistPendingVendorInviteForUser("user_1", "inv_1");
    expect(result).toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        pendingVendorInviteId: "inv_1",
        registrationIntent: "vendor",
        needsAccountRoleSelection: false,
      },
    });
  });
});

describe("persistPendingVendorInviteFromReturnPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it("persists invite from vendor invite return path", async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: "inv_1" })
      .mockResolvedValueOnce({
        id: "inv_1",
        status: "pending",
        expiresAt: new Date(Date.now() + 60_000),
        invitedEmail: "chef@example.com",
        pod: { id: "pod_1", name: "Garage Pod" },
      });

    const result = await persistPendingVendorInviteFromReturnPath(
      "user_1",
      "/vendor/invite/abc123"
    );
    expect(result).toEqual({ ok: true });
  });

  it("skips when return path is not an invite path", async () => {
    const result = await persistPendingVendorInviteFromReturnPath("user_1", "/explore");
    expect(result).toEqual({ ok: true, skipped: true });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});

describe("getValidatedPendingVendorInviteForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("returns active pending invite with pod context", async () => {
    mockFindUnique.mockResolvedValue({
      email: "chef@example.com",
      pendingVendorInviteId: "inv_1",
      pendingVendorInvite: {
        id: "inv_1",
        status: "pending",
        expiresAt: new Date(Date.now() + 60_000),
        invitedEmail: "chef@example.com",
        invitedVendorName: "Taco Cart",
        pod: { id: "pod_1", name: "Garage Pod" },
      },
    });

    await expect(getValidatedPendingVendorInviteForUser("user_1")).resolves.toEqual({
      status: "active",
      inviteId: "inv_1",
      podId: "pod_1",
      podName: "Garage Pod",
      invitedVendorName: "Taco Cart",
    });
  });

  it("clears and reports expired invites", async () => {
    mockFindUnique.mockResolvedValue({
      email: "chef@example.com",
      pendingVendorInviteId: "inv_1",
      pendingVendorInvite: {
        id: "inv_1",
        status: "pending",
        expiresAt: new Date(Date.now() - 60_000),
        invitedEmail: "chef@example.com",
        invitedVendorName: null,
        pod: { id: "pod_1", name: "Garage Pod" },
      },
    });

    const result = await getValidatedPendingVendorInviteForUser("user_1");
    expect(result.status).toBe("expired");
    expect(mockUpdateMany).toHaveBeenCalled();
  });
});
