import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockPrisma = {
  podVendorInvite: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  pod: { findUnique: vi.fn() },
  vendor: { findUnique: vi.fn(), findFirst: vi.fn() },
  podVendor: { findUnique: vi.fn(), findFirst: vi.fn() },
  podMembershipRequest: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  vendorMembership: { findMany: vi.fn() },
  $transaction: vi.fn(),
};

const mockAttachVendorToPod = vi.fn();
const mockSendPodVendorInviteEmail = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/attach-vendor-to-pod", () => ({
  attachVendorToPod: (...args: unknown[]) => mockAttachVendorToPod(...args),
}));
vi.mock("@/lib/email/pod-vendor-invite-email", () => ({
  sendPodVendorInviteEmail: (...args: unknown[]) => mockSendPodVendorInviteEmail(...args),
}));
vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOriginFromEnv: () => "https://app.example.com",
}));

describe("pod vendor invite service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendPodVendorInviteEmail.mockResolvedValue({ status: "dry_run" });
    mockAttachVendorToPod.mockResolvedValue({ ok: true, alreadyAttached: false });
  });

  it("resolves pending invite by token", async () => {
    const { resolvePodVendorInviteByToken } = await import("@/services/pod-vendor-invite.service");
    const { hashSecureInviteToken } = await import("@/lib/auth/secure-invite-token");
    const token = "abc";
    mockPrisma.podVendorInvite.findUnique.mockResolvedValue({
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
      invitedEmail: "vendor@example.com",
      invitedVendorName: "Billy's",
      pod: { id: "pod_1", name: "Garage Pod" },
    });

    const result = await resolvePodVendorInviteByToken(token);
    expect(result.ok).toBe(true);
    expect(mockPrisma.podVendorInvite.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashSecureInviteToken(token) },
      include: { pod: { select: { id: true, name: true } } },
    });
  });

  it("creates invite and returns invite URL", async () => {
    const { createPodVendorInvite } = await import("@/services/pod-vendor-invite.service");
    mockPrisma.pod.findUnique.mockResolvedValue({ id: "pod_1", name: "Garage Pod" });
    mockPrisma.podVendorInvite.findFirst.mockResolvedValue(null);
    mockPrisma.podVendorInvite.create.mockResolvedValue({ id: "inv_1" });

    const result = await createPodVendorInvite({
      podId: "pod_1",
      createdByUserId: "user_1",
      invitedEmail: "vendor@example.com",
      invitedVendorName: "Billy's",
      sendEmail: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.inviteUrl).toContain("/vendor/invite/");
      expect(result.inviteId).toBe("inv_1");
    }
  });

  it("blocks email mismatch on accept", async () => {
    const { acceptPodVendorInvite } = await import("@/services/pod-vendor-invite.service");
    mockPrisma.podVendorInvite.findUnique.mockResolvedValue({
      id: "inv_1",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
      invitedEmail: "vendor@example.com",
      targetVendorId: null,
      podId: "pod_1",
      acceptedVendorId: null,
      pod: { id: "pod_1", name: "Garage Pod" },
    });

    const result = await acceptPodVendorInvite({
      rawToken: "token",
      userId: "user_1",
      userEmail: "other@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("email_mismatch");
  });

  it("accepts invite and attaches vendor", async () => {
    const { acceptPodVendorInvite } = await import("@/services/pod-vendor-invite.service");
    mockPrisma.podVendorInvite.findUnique.mockResolvedValue({
      id: "inv_1",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
      invitedEmail: "vendor@example.com",
      targetVendorId: "vendor_1",
      podId: "pod_1",
      acceptedVendorId: null,
      pod: { id: "pod_1", name: "Garage Pod" },
    });
    mockPrisma.vendorMembership.findMany.mockResolvedValue([{ vendorId: "vendor_1", role: "owner" }]);
    mockPrisma.podVendor.findFirst.mockResolvedValue(null);
    mockPrisma.podVendorInvite.update.mockResolvedValue({});

    const result = await acceptPodVendorInvite({
      rawToken: "token",
      userId: "user_1",
      userEmail: "vendor@example.com",
    });

    expect(result.ok).toBe(true);
    expect(mockAttachVendorToPod).toHaveBeenCalledWith("pod_1", "vendor_1");
  });
});
