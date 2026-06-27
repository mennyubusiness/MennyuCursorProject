import "server-only";

import { revalidatePath } from "next/cache";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import { countActivePlatformAdmins } from "@/lib/admin-action-context";
import { prisma } from "@/lib/db";
import { requestPasswordReset } from "@/services/password-reset.service";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";

type ActionResult = { ok: true } | { ok: false; error: string };

async function loadTargetUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      disabledAt: true,
      isPlatformAdmin: true,
      emailVerified: true,
      customerProfile: { select: { phone: true } },
      customerAccount: { select: { id: true, phoneE164: true, phoneVerifiedAt: true } },
    },
  });
}

export async function adminDisableUser(input: {
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  if (input.adminUserId && input.adminUserId === input.userId) {
    return { ok: false, error: "You cannot disable your own account." };
  }

  const user = await loadTargetUser(input.userId);
  if (!user) return { ok: false, error: "User not found." };
  if (user.disabledAt) return { ok: false, error: "User is already disabled." };

  if (user.isPlatformAdmin) {
    const others = await countActivePlatformAdmins(input.userId);
    if (others === 0) {
      return { ok: false, error: "Cannot disable the only active platform admin." };
    }
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { disabledAt: now, passwordChangedAt: now },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.USER_DISABLED,
    targetType: ADMIN_AUDIT_TARGET.user,
    targetId: user.id,
    reason: reasonCheck.reason,
    oldValue: { disabledAt: null },
    newValue: { disabledAt: now.toISOString() },
  });

  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}

export async function adminEnableUser(input: {
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const user = await loadTargetUser(input.userId);
  if (!user) return { ok: false, error: "User not found." };
  if (!user.disabledAt) return { ok: false, error: "User is not disabled." };

  await prisma.user.update({
    where: { id: user.id },
    data: { disabledAt: null },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.USER_REENABLED,
    targetType: ADMIN_AUDIT_TARGET.user,
    targetId: user.id,
    reason: reasonCheck.reason,
    oldValue: { disabledAt: user.disabledAt.toISOString() },
    newValue: { disabledAt: null },
  });

  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}

export async function adminClearUserPhone(input: {
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const user = await loadTargetUser(input.userId);
  if (!user) return { ok: false, error: "User not found." };

  const oldPhone = user.customerAccount?.phoneE164 ?? user.customerProfile?.phone ?? null;
  if (!oldPhone && !user.customerProfile?.phone) {
    return { ok: false, error: "No phone number is stored on this account." };
  }

  if (user.customerProfile?.phone) {
    await prisma.customerProfile.update({
      where: { userId: user.id },
      data: { phone: null },
    });
  }

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.USER_PHONE_CLEARED,
    targetType: ADMIN_AUDIT_TARGET.user,
    targetId: user.id,
    reason: reasonCheck.reason,
    oldValue: { phone: oldPhone },
    newValue: { phone: null },
  });

  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}

export async function adminMarkEmailVerified(input: {
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const user = await loadTargetUser(input.userId);
  if (!user) return { ok: false, error: "User not found." };
  if (user.emailVerified) return { ok: false, error: "Email is already verified." };

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: now },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.USER_EMAIL_MARKED_VERIFIED,
    targetType: ADMIN_AUDIT_TARGET.user,
    targetId: user.id,
    reason: reasonCheck.reason,
    oldValue: { emailVerified: null },
    newValue: { emailVerified: now.toISOString() },
  });

  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}

export async function adminMarkPhoneVerified(input: {
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const user = await loadTargetUser(input.userId);
  if (!user?.customerAccount) {
    return { ok: false, error: "This user has no linked customer phone account." };
  }
  if (user.customerAccount.phoneVerifiedAt) {
    return { ok: false, error: "Phone is already verified." };
  }

  const now = new Date();
  await prisma.customerAccount.update({
    where: { id: user.customerAccount.id },
    data: { phoneVerifiedAt: now },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.USER_PHONE_MARKED_VERIFIED,
    targetType: ADMIN_AUDIT_TARGET.user,
    targetId: user.id,
    reason: reasonCheck.reason,
    oldValue: { phoneVerifiedAt: null },
    newValue: { phoneVerifiedAt: now.toISOString() },
  });

  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}

export async function adminInvalidateUserSessions(input: {
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordChangedAt: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordChangedAt: now },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.USER_SESSION_INVALIDATED,
    targetType: ADMIN_AUDIT_TARGET.user,
    targetId: user.id,
    reason: reasonCheck.reason,
    oldValue: { passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null },
    newValue: { passwordChangedAt: now.toISOString() },
  });

  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}

export async function adminSendPasswordReset(input: {
  userId: string;
  adminUserId: string | null;
  reason: string;
  requestOrigin?: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, passwordHash: true, disabledAt: true },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.disabledAt) return { ok: false, error: "Disabled users cannot receive password reset emails." };
  if (!user.passwordHash) {
    return { ok: false, error: "This user has no password set. They may need to register or use account setup." };
  }

  const result = await requestPasswordReset(user.email, input.requestOrigin);
  if (!result.ok) return result;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.USER_PASSWORD_RESET_SENT,
    targetType: ADMIN_AUDIT_TARGET.user,
    targetId: user.id,
    reason: reasonCheck.reason,
    metadata: { email: user.email },
  });

  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}
