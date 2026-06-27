import "server-only";

import { revalidatePath } from "next/cache";
import { PodMembershipRole, VendorMembershipRole } from "@prisma/client";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import { prisma } from "@/lib/db";
import { attachVendorToPod } from "@/lib/attach-vendor-to-pod";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function adminAddVendorAccess(input: {
  userId: string;
  vendorId: string;
  role: VendorMembershipRole;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const [user, vendor, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
    prisma.vendor.findUnique({ where: { id: input.vendorId }, select: { id: true, name: true } }),
    prisma.vendorMembership.findUnique({
      where: { userId_vendorId: { userId: input.userId, vendorId: input.vendorId } },
    }),
  ]);
  if (!user) return { ok: false, error: "User not found." };
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (existing) return { ok: false, error: "User already has access to this vendor." };

  await prisma.vendorMembership.create({
    data: {
      userId: input.userId,
      vendorId: input.vendorId,
      role: input.role,
    },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_ACCESS_ADDED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: input.vendorId,
    reason: reasonCheck.reason,
    newValue: { userId: input.userId, role: input.role },
    metadata: { vendorName: vendor.name },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath(`/vendor/${input.vendorId}/dashboard`);
  return { ok: true };
}

export async function adminRemoveVendorAccess(input: {
  userId: string;
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const membership = await prisma.vendorMembership.findUnique({
    where: { userId_vendorId: { userId: input.userId, vendorId: input.vendorId } },
    include: { vendor: { select: { name: true } } },
  });
  if (!membership) return { ok: false, error: "Vendor access not found." };

  if (membership.role === VendorMembershipRole.owner) {
    const ownerCount = await prisma.vendorMembership.count({
      where: { vendorId: input.vendorId, role: VendorMembershipRole.owner },
    });
    if (ownerCount <= 1) {
      return { ok: false, error: "Cannot remove the only vendor owner. Transfer ownership first." };
    }
  }

  await prisma.vendorMembership.delete({
    where: { userId_vendorId: { userId: input.userId, vendorId: input.vendorId } },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_ACCESS_REMOVED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: input.vendorId,
    reason: reasonCheck.reason,
    oldValue: { userId: input.userId, role: membership.role },
    metadata: { vendorName: membership.vendor.name },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath(`/vendor/${input.vendorId}/dashboard`);
  return { ok: true };
}

export async function adminTransferVendorOwnership(input: {
  userId: string;
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const targetMembership = await prisma.vendorMembership.findUnique({
    where: { userId_vendorId: { userId: input.userId, vendorId: input.vendorId } },
  });
  if (!targetMembership) {
    return { ok: false, error: "User does not have access to this vendor." };
  }
  if (targetMembership.role === VendorMembershipRole.owner) {
    return { ok: false, error: "User is already the vendor owner." };
  }

  const currentOwners = await prisma.vendorMembership.findMany({
    where: { vendorId: input.vendorId, role: VendorMembershipRole.owner },
    select: { userId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const owner of currentOwners) {
      await tx.vendorMembership.update({
        where: { userId_vendorId: { userId: owner.userId, vendorId: input.vendorId } },
        data: { role: VendorMembershipRole.staff },
      });
    }
    await tx.vendorMembership.update({
      where: { userId_vendorId: { userId: input.userId, vendorId: input.vendorId } },
      data: { role: VendorMembershipRole.owner },
    });
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_OWNER_TRANSFERRED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: input.vendorId,
    reason: reasonCheck.reason,
    oldValue: { owners: currentOwners.map((o) => o.userId) },
    newValue: { ownerUserId: input.userId },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath(`/vendor/${input.vendorId}/dashboard`);
  return { ok: true };
}

export async function adminAddPodAccess(input: {
  userId: string;
  podId: string;
  role: PodMembershipRole;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const [user, pod, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
    prisma.pod.findUnique({ where: { id: input.podId }, select: { id: true, name: true } }),
    prisma.podMembership.findUnique({
      where: { userId_podId: { userId: input.userId, podId: input.podId } },
    }),
  ]);
  if (!user) return { ok: false, error: "User not found." };
  if (!pod) return { ok: false, error: "Pod not found." };
  if (existing) return { ok: false, error: "User already has access to this pod." };

  await prisma.podMembership.create({
    data: {
      userId: input.userId,
      podId: input.podId,
      role: input.role,
    },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_OWNER_ACCESS_ADDED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: input.podId,
    reason: reasonCheck.reason,
    newValue: { userId: input.userId, role: input.role },
    metadata: { podName: pod.name },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath(`/pod/${input.podId}/dashboard`);
  return { ok: true };
}

export async function adminRemovePodAccess(input: {
  userId: string;
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const membership = await prisma.podMembership.findUnique({
    where: { userId_podId: { userId: input.userId, podId: input.podId } },
    include: { pod: { select: { name: true } } },
  });
  if (!membership) return { ok: false, error: "Pod access not found." };

  if (membership.role === PodMembershipRole.owner) {
    const ownerCount = await prisma.podMembership.count({
      where: { podId: input.podId, role: PodMembershipRole.owner },
    });
    if (ownerCount <= 1) {
      return { ok: false, error: "Cannot remove the only pod owner." };
    }
  }

  await prisma.podMembership.delete({
    where: { userId_podId: { userId: input.userId, podId: input.podId } },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_OWNER_ACCESS_REMOVED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: input.podId,
    reason: reasonCheck.reason,
    oldValue: { userId: input.userId, role: membership.role },
    metadata: { podName: membership.pod.name },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath(`/pod/${input.podId}/dashboard`);
  return { ok: true };
}

export async function adminTransferPodOwnership(input: {
  userId: string;
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const targetMembership = await prisma.podMembership.findUnique({
    where: { userId_podId: { userId: input.userId, podId: input.podId } },
  });
  if (!targetMembership) {
    return { ok: false, error: "User does not have access to this pod." };
  }
  if (targetMembership.role === PodMembershipRole.owner) {
    return { ok: false, error: "User is already a pod owner." };
  }

  const currentOwners = await prisma.podMembership.findMany({
    where: { podId: input.podId, role: PodMembershipRole.owner },
    select: { userId: true },
  });

  await prisma.$transaction(async (tx) => {
    for (const owner of currentOwners) {
      await tx.podMembership.update({
        where: { userId_podId: { userId: owner.userId, podId: input.podId } },
        data: { role: PodMembershipRole.manager },
      });
    }
    await tx.podMembership.update({
      where: { userId_podId: { userId: input.userId, podId: input.podId } },
      data: { role: PodMembershipRole.owner },
    });
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_OWNER_TRANSFERRED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: input.podId,
    reason: reasonCheck.reason,
    oldValue: { owners: currentOwners.map((o) => o.userId) },
    newValue: { ownerUserId: input.userId },
  });

  revalidatePath(`/admin/users/${input.userId}`);
  revalidatePath(`/pod/${input.podId}/dashboard`);
  return { ok: true };
}

export async function adminAttachVendorToPod(input: {
  vendorId: string;
  podId: string;
  adminUserId: string | null;
  reason: string;
  userIdForRevalidate?: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const result = await attachVendorToPod(input.podId, input.vendorId);
  if (!result.ok) return result;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_ATTACHED_TO_POD,
    targetType: ADMIN_AUDIT_TARGET.vendorPodMembership,
    targetId: `${input.podId}:${input.vendorId}`,
    reason: reasonCheck.reason,
    newValue: { podId: input.podId, vendorId: input.vendorId, alreadyAttached: result.alreadyAttached },
  });

  if (input.userIdForRevalidate) {
    revalidatePath(`/admin/users/${input.userIdForRevalidate}`);
  }
  revalidatePath(`/pod/${input.podId}/vendors`);
  revalidatePath(`/vendor/${input.vendorId}/dashboard`);
  return { ok: true };
}

export async function adminDetachVendorFromPod(input: {
  vendorId: string;
  podId: string;
  adminUserId: string | null;
  reason: string;
  userIdForRevalidate?: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const podVendor = await prisma.podVendor.findFirst({
    where: { podId: input.podId, vendorId: input.vendorId },
  });
  if (!podVendor) return { ok: false, error: "Vendor is not attached to this pod." };

  await prisma.podVendor.delete({ where: { id: podVendor.id } });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_DETACHED_FROM_POD,
    targetType: ADMIN_AUDIT_TARGET.vendorPodMembership,
    targetId: `${input.podId}:${input.vendorId}`,
    reason: reasonCheck.reason,
    oldValue: { podVendorId: podVendor.id },
  });

  if (input.userIdForRevalidate) {
    revalidatePath(`/admin/users/${input.userIdForRevalidate}`);
  }
  revalidatePath(`/pod/${input.podId}/vendors`);
  return { ok: true };
}
