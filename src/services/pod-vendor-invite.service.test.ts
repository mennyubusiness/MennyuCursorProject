import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockPrisma = {
  podVendorInvite: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  pod: { findUnique: vi.fn() },
  vendor: { findUnique: vi.fn(), findFirst: vi.fn() },
  podVendor: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  podMembershipRequest: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  vendorMembership: { findMany: vi.fn() },
  user: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
};

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockAttachVendorToPod = vi.fn();
const mockRevalidateVendorPodMembershipSurfaces = vi.fn();
const mockSendPodVendorInviteEmail = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/attach-vendor-to-pod", () => ({
  attachVendorToPod: (...args: unknown[]) => mockAttachVendorToPod(...args),
}));
vi.mock("@/lib/revalidate-vendor-pod-surfaces.server", () => ({
  revalidateVendorPodMembershipSurfaces: (...args: unknown[]) =>
    mockRevalidateVendorPodMembershipSurfaces(...args),
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
    mockAttachVendorToPod.mockResolvedValue({ ok: true, alreadyAttached: false, previousPodId: null });
    mockRevalidateVendorPodMembershipSurfaces.mockResolvedValue(undefined);
    mockPrisma.podVendorInvite.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.podVendor.findUnique.mockResolvedValue(null);
    mockPrisma.vendor.findUnique.mockResolvedValue({ contactEmail: "vendor@example.com" });
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
      acceptedByUserId: null,
      pod: { id: "pod_1", name: "Garage Pod" },
    });
    mockPrisma.vendorMembership.findMany.mockResolvedValue([{ vendorId: "vendor_1", role: "owner" }]);
    mockPrisma.podVendor.findFirst.mockResolvedValue(null);
    mockPrisma.podVendorInvite.updateMany.mockResolvedValue({ count: 1 });

    const result = await acceptPodVendorInvite({
      rawToken: "token",
      userId: "user_1",
      userEmail: "vendor@example.com",
    });

    expect(result.ok).toBe(true);
    expect(mockAttachVendorToPod).toHaveBeenCalledWith("pod_1", "vendor_1");
    expect(mockPrisma.podVendorInvite.updateMany).toHaveBeenCalled();
  });

  it("marks invite accepted when vendor is already attached to pod", async () => {
    const { acceptPodVendorInvite } = await import("@/services/pod-vendor-invite.service");
    mockPrisma.podVendorInvite.findUnique.mockResolvedValue({
      id: "inv_1",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
      invitedEmail: "vendor@example.com",
      targetVendorId: "vendor_1",
      podId: "pod_1",
      membershipRequestId: null,
      acceptedVendorId: null,
      acceptedByUserId: null,
      pod: { id: "pod_1", name: "Garage Pod" },
    });
    mockPrisma.vendorMembership.findMany.mockResolvedValue([{ vendorId: "vendor_1", role: "owner" }]);
    mockPrisma.podVendor.findUnique.mockResolvedValue({ vendorId: "vendor_1" });
    mockPrisma.podVendorInvite.updateMany.mockResolvedValue({ count: 1 });

    const result = await acceptPodVendorInvite({
      rawToken: "token",
      userId: "user_1",
      userEmail: "vendor@example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.alreadyAccepted).toBe(true);
    expect(mockAttachVendorToPod).not.toHaveBeenCalled();
    expect(mockPrisma.podVendorInvite.updateMany).toHaveBeenCalled();
  });

  it("acceptPodVendorInviteForUser loads email and accepts", async () => {
    const { acceptPodVendorInviteForUser } = await import("@/services/pod-vendor-invite.service");
    mockPrisma.user.findUnique.mockResolvedValue({ email: "vendor@example.com" });
    mockPrisma.podVendorInvite.findUnique.mockResolvedValue({
      id: "inv_1",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
      invitedEmail: "vendor@example.com",
      targetVendorId: null,
      podId: "pod_1",
      acceptedVendorId: null,
      acceptedByUserId: null,
      pod: { id: "pod_1", name: "Garage Pod" },
    });
    mockPrisma.vendorMembership.findMany.mockResolvedValue([{ vendorId: "vendor_1", role: "owner" }]);
    mockPrisma.podVendor.findFirst.mockResolvedValue(null);
    mockPrisma.podVendorInvite.update.mockResolvedValue({});

    const result = await acceptPodVendorInviteForUser({ token: "token", userId: "user_1" });
    expect(result.ok).toBe(true);
  });

  it("returns already accepted for same user", async () => {
    const { acceptPodVendorInvite } = await import("@/services/pod-vendor-invite.service");
    mockPrisma.podVendorInvite.findUnique.mockResolvedValue({
      id: "inv_1",
      status: "accepted",
      expiresAt: new Date(Date.now() + 60_000),
      invitedEmail: "vendor@example.com",
      targetVendorId: null,
      podId: "pod_1",
      acceptedVendorId: "vendor_1",
      acceptedByUserId: "user_1",
      pod: { id: "pod_1", name: "Garage Pod" },
    });

    const result = await acceptPodVendorInvite({
      rawToken: "token",
      userId: "user_1",
      userEmail: "vendor@example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.alreadyAccepted).toBe(true);
  });

  it("blocks already accepted invite from different user", async () => {
    const { acceptPodVendorInvite } = await import("@/services/pod-vendor-invite.service");
    mockPrisma.podVendorInvite.findUnique.mockResolvedValue({
      id: "inv_1",
      status: "accepted",
      expiresAt: new Date(Date.now() + 60_000),
      invitedEmail: "vendor@example.com",
      targetVendorId: null,
      podId: "pod_1",
      acceptedVendorId: "vendor_1",
      acceptedByUserId: "other_user",
      pod: { id: "pod_1", name: "Garage Pod" },
    });

    const result = await acceptPodVendorInvite({
      rawToken: "token",
      userId: "user_1",
      userEmail: "vendor@example.com",
    });

    expect(result.ok).toBe(false);
  });

  it("repairs and excludes invites for vendors already in pod from open list", async () => {
    const { listPendingPodVendorInvites } = await import("@/services/pod-vendor-invite.service");
    mockPrisma.podVendor.findMany.mockResolvedValue([
      { vendorId: "vendor_1", vendor: { contactEmail: "vendor@example.com" } },
    ]);
    mockPrisma.podVendorInvite.findMany.mockResolvedValue([
      {
        id: "inv_attached",
        invitedEmail: "vendor@example.com",
        invitedVendorName: "Iron Skewer",
        invitedContactName: null,
        targetVendorId: "vendor_1",
        lastSentAt: new Date("2026-01-01"),
        createdAt: new Date("2026-01-01"),
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        id: "inv_open",
        invitedEmail: "other@example.com",
        invitedVendorName: "Other",
        invitedContactName: null,
        targetVendorId: null,
        lastSentAt: new Date("2026-01-02"),
        createdAt: new Date("2026-01-02"),
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);
    mockPrisma.podVendorInvite.updateMany.mockResolvedValue({ count: 1 });

    const open = await listPendingPodVendorInvites("pod_1");

    expect(open).toHaveLength(1);
    expect(open[0]?.id).toBe("inv_open");
    expect(mockPrisma.podVendorInvite.updateMany).toHaveBeenCalled();
  });
});
