import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const userFindUnique = vi.fn();
const inviteFindUnique = vi.fn();
const ownerFindFirst = vi.fn();
const inviteUpdateMany = vi.fn();
const membershipUpsert = vi.fn();
const userUpdate = vi.fn();
const audit = vi.fn();
const vendorUpdate = vi.fn();
const menuItemUpdateMany = vi.fn();
const menuVersionUpdate = vi.fn();
const podVendorUpdate = vi.fn();

const tx = {
  user: {
    findUnique: (...args: unknown[]) => userFindUnique(...args),
    update: (...args: unknown[]) => userUpdate(...args),
  },
  vendorClaimInvite: {
    findUnique: (...args: unknown[]) => inviteFindUnique(...args),
    updateMany: (...args: unknown[]) => inviteUpdateMany(...args),
  },
  vendorMembership: {
    findFirst: (...args: unknown[]) => ownerFindFirst(...args),
    upsert: (...args: unknown[]) => membershipUpsert(...args),
  },
  vendor: { update: (...args: unknown[]) => vendorUpdate(...args) },
  menuItem: { updateMany: (...args: unknown[]) => menuItemUpdateMany(...args) },
  menuVersion: { update: (...args: unknown[]) => menuVersionUpdate(...args) },
  podVendor: { update: (...args: unknown[]) => podVendorUpdate(...args) },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    vendor: { findUnique: vi.fn() },
    vendorClaimInvite: { findUnique: vi.fn() },
  },
}));
vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => audit(...args),
}));
vi.mock("@/lib/email/vendor-claim-invite-email", () => ({
  sendVendorClaimInviteEmail: vi.fn(),
}));
vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOriginFromEnv: () => "https://openorder.test",
}));

import { acceptVendorClaimInvite } from "@/services/vendor-claim-invite.service";
import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";

const validUser = {
  id: "user_1",
  email: "owner@example.com",
  emailVerified: new Date(),
  disabledAt: null,
};
const validInvite = {
  id: "invite_1",
  invitedEmail: "owner@example.com",
  expiresAt: new Date(Date.now() + 60_000),
  claimedAt: null,
  revokedAt: null,
  vendor: {
    id: "vendor_1",
    name: "Test Kitchen",
    isActive: true,
    deletedAt: null,
    pods: [{ podId: "pod_1" }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  userFindUnique.mockResolvedValue(validUser);
  inviteFindUnique.mockResolvedValue(validInvite);
  ownerFindFirst.mockResolvedValue(null);
  inviteUpdateMany.mockResolvedValue({ count: 1 });
  membershipUpsert.mockResolvedValue({ id: "membership_1" });
  userUpdate.mockResolvedValue({ id: "user_1" });
  audit.mockResolvedValue(undefined);
});

describe("acceptVendorClaimInvite", () => {
  it("creates or promotes the exact claimant membership to owner", async () => {
    const result = await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(result).toMatchObject({ ok: true, vendorId: "vendor_1" });
    expect(membershipUpsert).toHaveBeenCalledWith({
      where: { userId_vendorId: { userId: "user_1", vendorId: "vendor_1" } },
      create: { userId: "user_1", vendorId: "vendor_1", role: "owner" },
      update: { role: "owner" },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { registrationIntent: "vendor", needsAccountRoleSelection: false },
    });
  });

  it("atomically consumes the invitation before granting ownership", async () => {
    await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(inviteUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "invite_1",
        claimedAt: null,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { claimedAt: expect.any(Date), claimedByUserId: "user_1" },
    });
  });

  it("rejects the wrong account without consuming the invite", async () => {
    userFindUnique.mockResolvedValue({ ...validUser, email: "other@example.com" });
    const result = await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(result).toMatchObject({ ok: false, code: "wrong_account" });
    expect(inviteUpdateMany).not.toHaveBeenCalled();
    expect(membershipUpsert).not.toHaveBeenCalled();
  });

  it("requires a verified matching email", async () => {
    userFindUnique.mockResolvedValue({ ...validUser, emailVerified: null });
    const result = await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(result).toMatchObject({ ok: false, code: "email_unverified" });
    expect(membershipUpsert).not.toHaveBeenCalled();
  });

  it("rejects expired, revoked, and already-used invites", async () => {
    inviteFindUnique.mockResolvedValue({ ...validInvite, expiresAt: new Date(Date.now() - 1) });
    expect(
      await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" })
    ).toMatchObject({ ok: false, code: "expired" });

    inviteFindUnique.mockResolvedValue({ ...validInvite, revokedAt: new Date() });
    expect(
      await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" })
    ).toMatchObject({ ok: false, code: "revoked" });

    inviteFindUnique.mockResolvedValue({ ...validInvite, claimedAt: new Date() });
    expect(
      await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" })
    ).toMatchObject({ ok: false, code: "already_claimed" });
  });

  it("rejects a vendor that acquired an owner before claim", async () => {
    ownerFindFirst.mockResolvedValue({ id: "existing_owner" });
    const result = await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(result).toMatchObject({ ok: false, code: "already_claimed" });
    expect(inviteUpdateMany).not.toHaveBeenCalled();
  });

  it("allows only one winner across simultaneous claims", async () => {
    inviteUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const [first, second] = await Promise.all([
      acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" }),
      acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" }),
    ]);
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect([first, second].some((result) => !result.ok && result.code === "conflict")).toBe(true);
    expect(membershipUpsert).toHaveBeenCalledTimes(1);
  });

  it("does not mutate the vendor, menu, ordering, routing, payments, or pod membership", async () => {
    await acceptVendorClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(vendorUpdate).not.toHaveBeenCalled();
    expect(menuItemUpdateMany).not.toHaveBeenCalled();
    expect(menuVersionUpdate).not.toHaveBeenCalled();
    expect(podVendorUpdate).not.toHaveBeenCalled();
  });

  it("writes a claim audit without the raw token", async () => {
    await acceptVendorClaimInvite({ rawToken: "secret-raw-token", userId: "user_1" });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: ADMIN_AUDIT_ACTION.VENDOR_CLAIMED,
        targetId: "vendor_1",
        newValue: { ownerUserId: "user_1" },
      })
    );
    expect(JSON.stringify(audit.mock.calls[0]![0])).not.toContain("secret-raw-token");
  });
});
