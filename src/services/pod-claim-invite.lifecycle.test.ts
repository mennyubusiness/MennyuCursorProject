import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const podFindUnique = vi.fn();
const inviteUpsert = vi.fn();
const inviteUpdate = vi.fn();
const inviteFindUnique = vi.fn();
const audit = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: { findUnique: (...args: unknown[]) => podFindUnique(...args) },
    podClaimInvite: {
      upsert: (...args: unknown[]) => inviteUpsert(...args),
      update: (...args: unknown[]) => inviteUpdate(...args),
      findUnique: (...args: unknown[]) => inviteFindUnique(...args),
    },
  },
}));
vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => audit(...args),
}));
vi.mock("@/lib/email/pod-claim-invite-email", () => ({
  sendPodClaimInviteEmail: (...args: unknown[]) => sendEmail(...args),
}));
vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOriginFromEnv: () => "https://openorder.test",
}));
vi.mock("@/lib/customer-public-url", () => ({
  buildPodCustomerPath: (slug: string) => `/${slug}`,
}));

import {
  resendPodClaimInvite,
  resolvePodClaimInviteByToken,
  revokePodClaimInvite,
  sendPodClaimInvite,
} from "@/services/pod-claim-invite.service";
import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";

const basePod = {
  id: "pod_1",
  name: "Test Pod",
  slug: "test-pod",
  address: "123 Main",
  isActive: true,
  deletedAt: null,
  memberships: [],
  claimInvite: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  podFindUnique.mockResolvedValue(basePod);
  inviteUpsert.mockResolvedValue({ id: "invite_1" });
  inviteUpdate.mockResolvedValue({ id: "invite_1" });
  audit.mockResolvedValue(undefined);
  sendEmail.mockResolvedValue({ status: "sent" });
});

describe("pod claim invitation lifecycle", () => {
  it("stores a SHA-256 hash and returns the one-time raw link", async () => {
    const result = await sendPodClaimInvite({
      podId: "pod_1",
      invitedEmail: "Owner@Example.com",
      adminUserId: "admin_1",
      reason: "Invite pod owner",
    });
    expect(result.ok).toBe(true);
    const data = inviteUpsert.mock.calls[0]![0].create;
    expect(data.invitedEmail).toBe("owner@example.com");
    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    if (result.ok) {
      expect(result.inviteUrl).toMatch(/^https:\/\/openorder\.test\/claim\/pod\//);
      expect(result.inviteUrl).not.toContain(data.tokenHash);
    }
  });

  it("never places the raw token in audit data", async () => {
    const result = await sendPodClaimInvite({
      podId: "pod_1",
      invitedEmail: "owner@example.com",
      adminUserId: "admin_1",
      reason: "Invite pod owner",
    });
    expect(result.ok).toBe(true);
    const auditPayload = JSON.stringify(audit.mock.calls[0]![0]);
    if (result.ok) {
      const rawToken = result.inviteUrl!.split("/").at(-1)!;
      expect(auditPayload).not.toContain(rawToken);
    }
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: ADMIN_AUDIT_ACTION.POD_CLAIM_INVITE_SENT })
    );
  });

  it("rejects invites for an already claimed pod", async () => {
    podFindUnique.mockResolvedValue({
      ...basePod,
      memberships: [{ id: "owner_membership" }],
    });
    const result = await sendPodClaimInvite({
      podId: "pod_1",
      invitedEmail: "owner@example.com",
      adminUserId: "admin_1",
      reason: "Invite pod owner",
    });
    expect(result).toMatchObject({ ok: false, error: "This pod already has an owner." });
    expect(inviteUpsert).not.toHaveBeenCalled();
  });

  it("resend rotates the token and clears revocation", async () => {
    podFindUnique.mockResolvedValue({
      ...basePod,
      claimInvite: {
        id: "invite_1",
        invitedEmail: "owner@example.com",
        expiresAt: new Date(Date.now() - 1),
        claimedAt: null,
        revokedAt: new Date(),
      },
    });
    const result = await resendPodClaimInvite({
      podId: "pod_1",
      adminUserId: "admin_1",
      reason: "Resend requested",
    });
    expect(result.ok).toBe(true);
    expect(inviteUpdate).toHaveBeenCalledWith({
      where: { id: "invite_1" },
      data: expect.objectContaining({
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        revokedAt: null,
        claimedAt: null,
      }),
    });
  });

  it("revoke makes the current token unusable", async () => {
    podFindUnique.mockResolvedValue({
      ...basePod,
      claimInvite: {
        id: "invite_1",
        invitedEmail: "owner@example.com",
        expiresAt: new Date(Date.now() + 60_000),
        claimedAt: null,
        revokedAt: null,
      },
    });
    const result = await revokePodClaimInvite({
      podId: "pod_1",
      adminUserId: "admin_1",
      reason: "Wrong recipient",
    });
    expect(result.ok).toBe(true);
    expect(inviteUpdate).toHaveBeenCalledWith({
      where: { id: "invite_1" },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("resolvePodClaimInviteByToken", () => {
  const resolvedBase = {
    invitedEmail: "owner@example.com",
    expiresAt: new Date(Date.now() + 60_000),
    claimedAt: null,
    revokedAt: null,
    pod: {
      id: "pod_1",
      name: "Test Pod",
      address: "123 Main",
      isActive: true,
      deletedAt: null,
      memberships: [],
    },
  };

  it("rejects an expired token", async () => {
    inviteFindUnique.mockResolvedValue({ ...resolvedBase, expiresAt: new Date(Date.now() - 1) });
    expect((await resolvePodClaimInviteByToken("raw-token")).status).toBe("expired");
  });

  it("rejects a revoked token", async () => {
    inviteFindUnique.mockResolvedValue({ ...resolvedBase, revokedAt: new Date() });
    expect((await resolvePodClaimInviteByToken("raw-token")).status).toBe("revoked");
  });

  it("rejects a used or independently claimed token", async () => {
    inviteFindUnique.mockResolvedValue({ ...resolvedBase, claimedAt: new Date() });
    expect((await resolvePodClaimInviteByToken("raw-token")).status).toBe("already_claimed");
  });

  it("returns only the public claim context for an active token", async () => {
    inviteFindUnique.mockResolvedValue(resolvedBase);
    expect(await resolvePodClaimInviteByToken("raw-token")).toMatchObject({
      status: "active",
      podId: "pod_1",
      podName: "Test Pod",
      address: "123 Main",
      invitedEmail: "owner@example.com",
    });
  });
});
