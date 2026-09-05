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
const podUpdate = vi.fn();
const podVendorUpdate = vi.fn();
const vendorUpdate = vi.fn();
const menuItemUpdateMany = vi.fn();

const tx = {
  user: {
    findUnique: (...args: unknown[]) => userFindUnique(...args),
    update: (...args: unknown[]) => userUpdate(...args),
  },
  podClaimInvite: {
    findUnique: (...args: unknown[]) => inviteFindUnique(...args),
    updateMany: (...args: unknown[]) => inviteUpdateMany(...args),
  },
  podMembership: {
    findFirst: (...args: unknown[]) => ownerFindFirst(...args),
    upsert: (...args: unknown[]) => membershipUpsert(...args),
  },
  pod: { update: (...args: unknown[]) => podUpdate(...args) },
  podVendor: { update: (...args: unknown[]) => podVendorUpdate(...args) },
  vendor: { update: (...args: unknown[]) => vendorUpdate(...args) },
  menuItem: { updateMany: (...args: unknown[]) => menuItemUpdateMany(...args) },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    pod: { findUnique: vi.fn() },
    podClaimInvite: { findUnique: vi.fn() },
  },
}));
vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => audit(...args),
}));
vi.mock("@/lib/email/pod-claim-invite-email", () => ({
  sendPodClaimInviteEmail: vi.fn(),
}));
vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOriginFromEnv: () => "https://openorder.test",
}));
vi.mock("@/lib/customer-public-url", () => ({
  buildPodCustomerPath: (slug: string) => `/${slug}`,
}));

import { acceptPodClaimInvite } from "@/services/pod-claim-invite.service";
import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";

const validUser = {
  id: "user_1",
  email: "owner@example.com",
  emailVerified: new Date(),
  disabledAt: null,
  deletedAt: null,
};
const validInvite = {
  id: "invite_1",
  invitedEmail: "owner@example.com",
  expiresAt: new Date(Date.now() + 60_000),
  claimedAt: null,
  revokedAt: null,
  pod: {
    id: "pod_1",
    name: "Test Pod",
    slug: "test-pod",
    isActive: true,
    deletedAt: null,
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

describe("acceptPodClaimInvite", () => {
  it("creates or promotes the exact claimant membership to owner", async () => {
    const result = await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(result).toMatchObject({ ok: true, podId: "pod_1" });
    expect(membershipUpsert).toHaveBeenCalledWith({
      where: { userId_podId: { userId: "user_1", podId: "pod_1" } },
      create: { userId: "user_1", podId: "pod_1", role: "owner" },
      update: { role: "owner" },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { registrationIntent: "pod_owner", needsAccountRoleSelection: false },
    });
  });

  it("atomically consumes the invitation before granting ownership", async () => {
    await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" });
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
    const result = await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(result).toMatchObject({ ok: false, code: "wrong_account" });
    expect(inviteUpdateMany).not.toHaveBeenCalled();
    expect(membershipUpsert).not.toHaveBeenCalled();
  });

  it("requires a verified matching email", async () => {
    userFindUnique.mockResolvedValue({ ...validUser, emailVerified: null });
    const result = await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(result).toMatchObject({ ok: false, code: "email_unverified" });
    expect(membershipUpsert).not.toHaveBeenCalled();
  });

  it("rejects expired, revoked, and already-used invites", async () => {
    inviteFindUnique.mockResolvedValue({ ...validInvite, expiresAt: new Date(Date.now() - 1) });
    expect(
      await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" })
    ).toMatchObject({ ok: false, code: "expired" });

    inviteFindUnique.mockResolvedValue({ ...validInvite, revokedAt: new Date() });
    expect(
      await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" })
    ).toMatchObject({ ok: false, code: "revoked" });

    inviteFindUnique.mockResolvedValue({ ...validInvite, claimedAt: new Date() });
    expect(
      await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" })
    ).toMatchObject({ ok: false, code: "already_claimed" });
  });

  it("rejects a pod that acquired an owner before claim", async () => {
    ownerFindFirst.mockResolvedValue({ id: "existing_owner" });
    const result = await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(result).toMatchObject({ ok: false, code: "already_claimed" });
    expect(inviteUpdateMany).not.toHaveBeenCalled();
  });

  it("allows only one winner across simultaneous claims", async () => {
    inviteUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const [first, second] = await Promise.all([
      acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" }),
      acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" }),
    ]);
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect([first, second].some((result) => !result.ok && result.code === "conflict")).toBe(true);
    expect(membershipUpsert).toHaveBeenCalledTimes(1);
  });

  it("does not mutate the pod, vendors, menus, or pod-vendor rows", async () => {
    await acceptPodClaimInvite({ rawToken: "raw-token", userId: "user_1" });
    expect(podUpdate).not.toHaveBeenCalled();
    expect(podVendorUpdate).not.toHaveBeenCalled();
    expect(vendorUpdate).not.toHaveBeenCalled();
    expect(menuItemUpdateMany).not.toHaveBeenCalled();
  });

  it("writes a claim audit without the raw token", async () => {
    await acceptPodClaimInvite({ rawToken: "secret-raw-token", userId: "user_1" });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: ADMIN_AUDIT_ACTION.POD_CLAIMED,
        targetId: "pod_1",
        newValue: { ownerUserId: "user_1" },
      })
    );
    expect(JSON.stringify(audit.mock.calls[0]![0])).not.toContain("secret-raw-token");
  });
});
