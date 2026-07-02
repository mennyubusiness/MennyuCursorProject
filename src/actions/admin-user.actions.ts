"use server";

import { revalidatePath } from "next/cache";
import { PodMembershipRole, VendorMembershipRole } from "@prisma/client";
import { requireAdminActionContext } from "@/lib/admin-action-context";
import {
  adminAttachVendorToPod,
  adminAddPodAccess,
  adminAddVendorAccess,
  adminDetachVendorFromPod,
  adminRemovePodAccess,
  adminRemoveVendorAccess,
  adminTransferPodOwnership,
  adminTransferVendorOwnership,
} from "@/services/admin-role-repair.service";
import {
  adminRegenerateInviteLink,
  adminRepairInviteAttachment,
  adminResendInvite,
  adminRevokeInvite,
} from "@/services/admin-invite-recovery.service";
import {
  adminClearUserPhone,
  adminDisableUser,
  adminEnableUser,
  adminInvalidateUserSessions,
  adminMarkEmailVerified,
  adminMarkPhoneVerified,
  adminRevokeEmailVerificationTokens,
  adminSendEmailVerification,
  adminSendPasswordReset,
  adminDeleteUserAccount,
} from "@/services/admin-user-recovery.service";

type ActionResult =
  | { ok: true; message?: string; inviteUrl?: string }
  | { ok: false; error: string; blockers?: string[] };

async function withAdmin<T extends ActionResult>(
  fn: (ctx: { adminUserId: string | null }) => Promise<T>
): Promise<T | { ok: false; error: string }> {
  const ctx = await requireAdminActionContext();
  if (!ctx.ok) return ctx;
  return fn(ctx);
}

export async function adminDisableUserAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminDisableUser({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "User disabled." } : result;
  });
}

export async function adminEnableUserAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminEnableUser({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "User re-enabled." } : result;
  });
}

export async function adminClearUserPhoneAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminClearUserPhone({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "Profile phone cleared." } : result;
  });
}

export async function adminMarkEmailVerifiedAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminMarkEmailVerified({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "Email marked verified." } : result;
  });
}

export async function adminMarkPhoneVerifiedAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminMarkPhoneVerified({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "Phone marked verified." } : result;
  });
}

export async function adminInvalidateUserSessionsAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminInvalidateUserSessions({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "Sessions invalidated. User must sign in again." } : result;
  });
}

export async function adminSendPasswordResetAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminSendPasswordReset({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "Password reset email sent if the account supports password login." } : result;
  });
}

export async function adminSendEmailVerificationAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminSendEmailVerification({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "Verification email sent." } : result;
  });
}

export async function adminRevokeEmailVerificationTokensAction(
  userId: string,
  reason: string
): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminRevokeEmailVerificationTokens({ userId, adminUserId, reason });
    return result.ok ? { ok: true, message: "Outstanding verification tokens revoked." } : result;
  });
}

export async function adminAddVendorAccessAction(input: {
  userId: string;
  vendorId: string;
  role: VendorMembershipRole;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminAddVendorAccess({ ...input, adminUserId });
    return result.ok ? { ok: true, message: "Vendor access added." } : result;
  });
}

export async function adminRemoveVendorAccessAction(input: {
  userId: string;
  vendorId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminRemoveVendorAccess({ ...input, adminUserId });
    revalidatePath(`/admin/users/${input.userId}`);
    return result.ok ? { ok: true, message: "Vendor access removed." } : result;
  });
}

export async function adminTransferVendorOwnershipAction(input: {
  userId: string;
  vendorId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminTransferVendorOwnership({ ...input, adminUserId });
    return result.ok ? { ok: true, message: "Vendor ownership transferred." } : result;
  });
}

export async function adminAddPodAccessAction(input: {
  userId: string;
  podId: string;
  role: PodMembershipRole;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminAddPodAccess({ ...input, adminUserId });
    return result.ok ? { ok: true, message: "Pod access added." } : result;
  });
}

export async function adminRemovePodAccessAction(input: {
  userId: string;
  podId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminRemovePodAccess({ ...input, adminUserId });
    return result.ok ? { ok: true, message: "Pod access removed." } : result;
  });
}

export async function adminTransferPodOwnershipAction(input: {
  userId: string;
  podId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminTransferPodOwnership({ ...input, adminUserId });
    return result.ok ? { ok: true, message: "Pod ownership transferred." } : result;
  });
}

export async function adminAttachVendorToPodAction(input: {
  userId: string;
  vendorId: string;
  podId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminAttachVendorToPod({
      vendorId: input.vendorId,
      podId: input.podId,
      adminUserId,
      reason: input.reason,
      userIdForRevalidate: input.userId,
    });
    return result.ok ? { ok: true, message: "Vendor attached to pod." } : result;
  });
}

export async function adminDetachVendorFromPodAction(input: {
  userId: string;
  vendorId: string;
  podId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminDetachVendorFromPod({
      vendorId: input.vendorId,
      podId: input.podId,
      adminUserId,
      reason: input.reason,
      userIdForRevalidate: input.userId,
    });
    return result.ok ? { ok: true, message: "Vendor detached from pod." } : result;
  });
}

export async function adminResendInviteAction(input: {
  inviteId: string;
  podId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminResendInvite({ ...input, adminUserId });
    return result.ok
      ? { ok: true, message: "Invite resent.", inviteUrl: result.inviteUrl }
      : result;
  });
}

export async function adminRevokeInviteAction(input: {
  inviteId: string;
  podId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminRevokeInvite({ ...input, adminUserId });
    return result.ok ? { ok: true, message: "Invite revoked." } : result;
  });
}

export async function adminRegenerateInviteLinkAction(input: {
  inviteId: string;
  podId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminRegenerateInviteLink({ ...input, adminUserId });
    return result.ok
      ? { ok: true, message: "Invite link regenerated.", inviteUrl: result.inviteUrl }
      : result;
  });
}

export async function adminRepairInviteAttachmentAction(input: {
  userId: string;
  inviteId: string;
  reason: string;
}): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminRepairInviteAttachment({ ...input, adminUserId });
    return result.ok ? { ok: true, message: "Invite attachment repaired." } : result;
  });
}

export async function adminDeleteUserAccountAction(userId: string, reason: string): Promise<ActionResult> {
  return withAdmin(async ({ adminUserId }) => {
    const result = await adminDeleteUserAccount({ userId, adminUserId, reason });
    if (result.ok) {
      revalidatePath(`/admin/users/${userId}`);
      revalidatePath("/admin/users");
      return { ok: true, message: "Account deactivated and anonymized." };
    }
    return { ok: false, error: result.error, blockers: result.blockers };
  });
}
