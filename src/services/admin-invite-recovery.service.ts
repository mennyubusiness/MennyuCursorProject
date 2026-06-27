import "server-only";

import { revalidatePath } from "next/cache";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/db";
import { attachVendorToPod } from "@/lib/attach-vendor-to-pod";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";
import {
  cancelPodVendorInvite,
  markPodVendorInviteAccepted,
  POD_VENDOR_INVITE_STATUS,
  resendPodVendorInvite,
} from "@/services/pod-vendor-invite.service";

type ActionResult = { ok: true; inviteUrl?: string } | { ok: false; error: string };

export async function adminResendInvite(input: {
  inviteId: string;
  podId: string;
  adminUserId: string | null;
  reason: string;
  requestOrigin?: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const result = await resendPodVendorInvite({
    podId: input.podId,
    inviteId: input.inviteId,
    requestOrigin: input.requestOrigin,
  });
  if (!result.ok) return result;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.INVITE_RESENT,
    targetType: ADMIN_AUDIT_TARGET.invite,
    targetId: input.inviteId,
    reason: reasonCheck.reason,
    metadata: { emailStatus: result.emailStatus },
  });

  revalidatePath(`/admin/users`);
  return { ok: true, inviteUrl: result.inviteUrl };
}

export async function adminRevokeInvite(input: {
  inviteId: string;
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const invite = await prisma.podVendorInvite.findFirst({
    where: { id: input.inviteId, podId: input.podId },
  });
  if (!invite) return { ok: false, error: "Invite not found." };

  const result = await cancelPodVendorInvite(input.podId, input.inviteId);
  if (!result.ok) return result;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.INVITE_REVOKED,
    targetType: ADMIN_AUDIT_TARGET.invite,
    targetId: input.inviteId,
    reason: reasonCheck.reason,
    oldValue: { status: invite.status },
    newValue: { status: POD_VENDOR_INVITE_STATUS.cancelled },
  });

  return { ok: true };
}

export async function adminRegenerateInviteLink(input: {
  inviteId: string;
  podId: string;
  adminUserId: string | null;
  reason: string;
  requestOrigin?: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const result = await resendPodVendorInvite({
    podId: input.podId,
    inviteId: input.inviteId,
    requestOrigin: input.requestOrigin,
  });
  if (!result.ok) return result;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.INVITE_LINK_REGENERATED,
    targetType: ADMIN_AUDIT_TARGET.invite,
    targetId: input.inviteId,
    reason: reasonCheck.reason,
  });

  return { ok: true, inviteUrl: result.inviteUrl };
}

export async function adminRepairInviteAttachment(input: {
  inviteId: string;
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const invite = await prisma.podVendorInvite.findUnique({
    where: { id: input.inviteId },
    select: {
      id: true,
      podId: true,
      status: true,
      acceptedVendorId: true,
      targetVendorId: true,
      acceptedByUserId: true,
    },
  });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.status !== POD_VENDOR_INVITE_STATUS.accepted) {
    return { ok: false, error: "Only accepted invites can be repaired." };
  }

  let vendorId = invite.acceptedVendorId ?? invite.targetVendorId;
  if (!vendorId) {
    const membership = await prisma.vendorMembership.findFirst({
      where: { userId: input.userId },
      orderBy: { createdAt: "asc" },
      select: { vendorId: true },
    });
    vendorId = membership?.vendorId ?? null;
  }
  if (!vendorId) {
    return { ok: false, error: "No vendor is linked to this invite or user." };
  }

  const attach = await attachVendorToPod(invite.podId, vendorId);
  if (!attach.ok) return attach;

  await markPodVendorInviteAccepted({
    inviteId: invite.id,
    vendorId,
    acceptedByUserId: invite.acceptedByUserId ?? input.userId,
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.INVITE_ATTACHMENT_REPAIRED,
    targetType: ADMIN_AUDIT_TARGET.invite,
    targetId: invite.id,
    reason: reasonCheck.reason,
    newValue: { podId: invite.podId, vendorId },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  return { ok: true };
}
