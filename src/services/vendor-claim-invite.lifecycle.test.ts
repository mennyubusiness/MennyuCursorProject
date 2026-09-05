import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const vendorFindUnique = vi.fn();
const inviteUpsert = vi.fn();
const inviteUpdate = vi.fn();
const inviteFindUnique = vi.fn();
const audit = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: { findUnique: (...args: unknown[]) => vendorFindUnique(...args) },
    vendorClaimInvite: {
      upsert: (...args: unknown[]) => inviteUpsert(...args),
      update: (...args: unknown[]) => inviteUpdate(...args),
      findUnique: (...args: unknown[]) => inviteFindUnique(...args),
    },
  },
}));
vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => audit(...args),
}));
vi.mock("@/lib/email/vendor-claim-invite-email", () => ({
  sendVendorClaimInviteEmail: (...args: unknown[]) => sendEmail(...args),
}));
vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOriginFromEnv: () => "https://openorder.test",
}));

import {
  resendVendorClaimInvite,
  resolveVendorClaimInviteByToken,
  revokeVendorClaimInvite,
  sendVendorClaimInvite,
} from "@/services/vendor-claim-invite.service";
import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";

const baseVendor = {
  id: "vendor_1",
  name: "Test Kitchen",
  isActive: true,
  deletedAt: null,
  pods: [{ pod: { id: "pod_1", name: "Test Pod" } }],
  vendorMemberships: [],
  claimInvite: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vendorFindUnique.mockResolvedValue(baseVendor);
  inviteUpsert.mockResolvedValue({ id: "invite_1" });
  inviteUpdate.mockResolvedValue({ id: "invite_1" });
  audit.mockResolvedValue(undefined);
  sendEmail.mockResolvedValue({ status: "sent" });
});

describe("vendor claim invitation lifecycle", () => {
  it("stores a SHA-256 hash and returns the one-time raw link", async () => {
    const result = await sendVendorClaimInvite({
      vendorId: "vendor_1",
      invitedEmail: "Owner@Example.com",
      adminUserId: "admin_1",
      reason: "Invite vendor owner",
    });
    expect(result.ok).toBe(true);
    const data = inviteUpsert.mock.calls[0]![0].create;
    expect(data.invitedEmail).toBe("owner@example.com");
    expect(data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    if (result.ok) {
      expect(result.inviteUrl).toMatch(/^https:\/\/openorder\.test\/claim\/vendor\//);
      expect(result.inviteUrl).not.toContain(data.tokenHash);
    }
  });

  it("never places the raw token in audit data", async () => {
    const result = await sendVendorClaimInvite({
      vendorId: "vendor_1",
      invitedEmail: "owner@example.com",
      adminUserId: "admin_1",
      reason: "Invite vendor owner",
    });
    expect(result.ok).toBe(true);
    const auditPayload = JSON.stringify(audit.mock.calls[0]![0]);
    if (result.ok) {
      const rawToken = result.inviteUrl!.split("/").at(-1)!;
      expect(auditPayload).not.toContain(rawToken);
    }
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: ADMIN_AUDIT_ACTION.VENDOR_CLAIM_INVITE_SENT })
    );
  });

  it("rejects invites for an already claimed vendor", async () => {
    vendorFindUnique.mockResolvedValue({
      ...baseVendor,
      vendorMemberships: [{ id: "owner_membership" }],
    });
    const result = await sendVendorClaimInvite({
      vendorId: "vendor_1",
      invitedEmail: "owner@example.com",
      adminUserId: "admin_1",
      reason: "Invite vendor owner",
    });
    expect(result).toMatchObject({ ok: false, error: "This vendor already has an owner." });
    expect(inviteUpsert).not.toHaveBeenCalled();
  });

  it("resend rotates the token and clears revocation", async () => {
    vendorFindUnique.mockResolvedValue({
      ...baseVendor,
      claimInvite: {
        id: "invite_1",
        invitedEmail: "owner@example.com",
        expiresAt: new Date(Date.now() - 1),
        claimedAt: null,
        revokedAt: new Date(),
      },
    });
    const result = await resendVendorClaimInvite({
      vendorId: "vendor_1",
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
    vendorFindUnique.mockResolvedValue({
      ...baseVendor,
      claimInvite: {
        id: "invite_1",
        invitedEmail: "owner@example.com",
        expiresAt: new Date(Date.now() + 60_000),
        claimedAt: null,
        revokedAt: null,
      },
    });
    const result = await revokeVendorClaimInvite({
      vendorId: "vendor_1",
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

describe("resolveVendorClaimInviteByToken", () => {
  const resolvedBase = {
    invitedEmail: "owner@example.com",
    expiresAt: new Date(Date.now() + 60_000),
    claimedAt: null,
    revokedAt: null,
    vendor: {
      id: "vendor_1",
      name: "Test Kitchen",
      isActive: true,
      deletedAt: null,
      vendorMemberships: [],
      pods: [{ pod: { name: "Test Pod" } }],
    },
  };

  it("rejects an expired token", async () => {
    inviteFindUnique.mockResolvedValue({ ...resolvedBase, expiresAt: new Date(Date.now() - 1) });
    expect((await resolveVendorClaimInviteByToken("raw-token")).status).toBe("expired");
  });

  it("rejects a revoked token", async () => {
    inviteFindUnique.mockResolvedValue({ ...resolvedBase, revokedAt: new Date() });
    expect((await resolveVendorClaimInviteByToken("raw-token")).status).toBe("revoked");
  });

  it("rejects a used or independently claimed token", async () => {
    inviteFindUnique.mockResolvedValue({ ...resolvedBase, claimedAt: new Date() });
    expect((await resolveVendorClaimInviteByToken("raw-token")).status).toBe("already_claimed");
  });

  it("returns only the public claim context for an active token", async () => {
    inviteFindUnique.mockResolvedValue(resolvedBase);
    expect(await resolveVendorClaimInviteByToken("raw-token")).toMatchObject({
      status: "active",
      vendorId: "vendor_1",
      vendorName: "Test Kitchen",
      podName: "Test Pod",
      invitedEmail: "owner@example.com",
    });
  });
});
