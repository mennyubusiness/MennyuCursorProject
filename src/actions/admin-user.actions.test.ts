import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdmin = vi.fn();
const mockDisableUser = vi.fn();
const mockCreateAuditLog = vi.fn();

vi.mock("@/lib/admin-action-context", () => ({
  requireAdminActionContext: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/services/admin-user-recovery.service", () => ({
  adminDisableUser: (...args: unknown[]) => mockDisableUser(...args),
  adminEnableUser: vi.fn(),
  adminClearUserPhone: vi.fn(),
  adminMarkEmailVerified: vi.fn(),
  adminMarkPhoneVerified: vi.fn(),
  adminInvalidateUserSessions: vi.fn(),
  adminSendPasswordReset: vi.fn(),
}));

vi.mock("@/services/admin-role-repair.service", () => ({
  adminAddVendorAccess: vi.fn(),
  adminRemoveVendorAccess: vi.fn(),
  adminTransferVendorOwnership: vi.fn(),
  adminAddPodAccess: vi.fn(),
  adminRemovePodAccess: vi.fn(),
  adminTransferPodOwnership: vi.fn(),
  adminAttachVendorToPod: vi.fn(),
  adminDetachVendorFromPod: vi.fn(),
}));

vi.mock("@/services/admin-invite-recovery.service", () => ({
  adminResendInvite: vi.fn(),
  adminRevokeInvite: vi.fn(),
  adminRegenerateInviteLink: vi.fn(),
  adminRepairInviteAttachment: vi.fn(),
}));

vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

import { adminDisableUserAction } from "@/actions/admin-user.actions";

const usersPage = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/users/page.tsx"),
  "utf8"
);
const usersLayout = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/layout.tsx"),
  "utf8"
);
const detailClient = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/users/[userId]/AdminUserDetailClient.tsx"),
  "utf8"
);

describe("admin user recovery actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin callers", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Unauthorized." });

    const result = await adminDisableUserAction("user_1", "support ticket");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockDisableUser).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });

  it("delegates disable to service when authorized", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, adminUserId: "admin_1" });
    mockDisableUser.mockResolvedValue({ ok: true });

    const result = await adminDisableUserAction("user_1", "bad actor");
    expect(result).toEqual({ ok: true, message: "User disabled." });
    expect(mockDisableUser).toHaveBeenCalledWith({
      userId: "user_1",
      adminUserId: "admin_1",
      reason: "bad actor",
    });
  });

  it("does not write audit log when service fails", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, adminUserId: "admin_1" });
    mockDisableUser.mockResolvedValue({ ok: false, error: "User not found." });

    const result = await adminDisableUserAction("missing", "test");
    expect(result).toEqual({ ok: false, error: "User not found." });
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
  });
});

describe("admin users UI wiring", () => {
  it("search page uses searchAdminUsers service", () => {
    expect(usersPage).toContain("searchAdminUsers");
    expect(usersPage).toContain("/admin/users/");
  });

  it("user pages sit behind admin dashboard layout auth", () => {
    expect(usersLayout).toContain("isAdminDashboardLayoutAuthorized");
  });

  it("detail client exposes recovery, role repair, and invite repair sections", () => {
    expect(detailClient).toContain("Recovery actions");
    expect(detailClient).toContain("adminRepairInviteAttachmentAction");
    expect(detailClient).toContain("attachmentWarning");
    expect(detailClient).toContain("Attach vendor to pod from invite");
    expect(detailClient).toContain("Audit log");
  });
});
