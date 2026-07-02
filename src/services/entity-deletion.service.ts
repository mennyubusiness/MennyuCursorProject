import "server-only";

import { revalidatePath } from "next/cache";
import { PodMembershipRole, VendorMembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import { buildDeletedUserEmail } from "@/lib/entity-deletion/entity-deletion.constants";
import {
  precheckAccountDeletion,
  precheckPodDeletion,
  precheckVendorDeletion,
} from "@/lib/entity-deletion/entity-deletion-guards";
import { createEntityDeletionGuardDeps } from "@/lib/entity-deletion/entity-deletion-guards.server";
import { buildPodCustomerPath, buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { isAdminUser } from "@/lib/permissions";
import { revalidateVendorPodMembershipSurfaces } from "@/lib/revalidate-vendor-pod-surfaces.server";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";
import { POD_VENDOR_INVITE_STATUS } from "@/services/pod-vendor-invite.service";

export type EntityDeletionResult = { ok: true } | { ok: false; error: string; blockers?: string[] };

async function cancelVendorPendingInvites(
  vendorId: string,
  tx: Pick<typeof prisma, "podVendorInvite" | "podMembershipRequest">
) {
  await tx.podVendorInvite.updateMany({
    where: {
      status: POD_VENDOR_INVITE_STATUS.pending,
      OR: [{ targetVendorId: vendorId }, { acceptedVendorId: vendorId }],
    },
    data: { status: POD_VENDOR_INVITE_STATUS.cancelled },
  });
  await tx.podMembershipRequest.updateMany({
    where: { vendorId, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date() },
  });
}

async function cancelPodPendingInvites(
  podId: string,
  tx: Pick<typeof prisma, "podVendorInvite" | "podMembershipRequest">
) {
  await tx.podVendorInvite.updateMany({
    where: { podId, status: POD_VENDOR_INVITE_STATUS.pending },
    data: { status: POD_VENDOR_INVITE_STATUS.cancelled },
  });
  await tx.podMembershipRequest.updateMany({
    where: { podId, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date() },
  });
}

export async function canDeleteVendor(userId: string, vendorId: string): Promise<boolean> {
  if (await isAdminUser(userId)) return true;
  const membership = await prisma.vendorMembership.findUnique({
    where: { userId_vendorId: { userId, vendorId } },
    select: { role: true },
  });
  return membership?.role === VendorMembershipRole.owner;
}

export async function canDeletePod(userId: string, podId: string): Promise<boolean> {
  if (await isAdminUser(userId)) return true;
  const membership = await prisma.podMembership.findUnique({
    where: { userId_podId: { userId, podId } },
    select: { role: true },
  });
  return membership?.role === PodMembershipRole.owner;
}

export async function deleteUserAccount(input: {
  userId: string;
  actorUserId: string;
}): Promise<EntityDeletionResult> {
  if (input.actorUserId !== input.userId && !(await isAdminUser(input.actorUserId))) {
    return { ok: false, error: "Forbidden." };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      deletedAt: true,
      disabledAt: true,
      isPlatformAdmin: true,
      customerProfile: { select: { id: true } },
      customerAccount: { select: { id: true } },
    },
  });
  if (!user) return { ok: false, error: "Account not found." };
  if (user.deletedAt || user.disabledAt) return { ok: false, error: "Account is already deleted." };

  const precheck = await precheckAccountDeletion(user.id, createEntityDeletionGuardDeps());
  if (!precheck.ok) {
    return {
      ok: false,
      error: precheck.blockers[0]?.message ?? "Account cannot be deleted yet.",
      blockers: precheck.blockers.map((b) => b.message),
    };
  }

  const now = new Date();
  const anonymizedEmail = buildDeletedUserEmail(user.id);

  await prisma.$transaction(async (tx) => {
    if (user.customerProfile) {
      await tx.customerProfile.update({
        where: { id: user.customerProfile.id },
        data: { phone: null, firstName: "Deleted", lastName: "User" },
      });
    }
    if (user.customerAccount) {
      await tx.customerSession.updateMany({
        where: { customerAccountId: user.customerAccount.id, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: anonymizedEmail,
        name: null,
        image: null,
        passwordHash: null,
        pendingVendorInviteId: null,
        deletedAt: now,
        deletedByUserId: input.actorUserId,
        disabledAt: now,
        passwordChangedAt: now,
      },
    });
  });

  revalidatePath("/account");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteVendorProfile(input: {
  vendorId: string;
  actorUserId: string;
  adminReason?: string;
}): Promise<EntityDeletionResult> {
  if (!(await canDeleteVendor(input.actorUserId, input.vendorId))) {
    return { ok: false, error: "Forbidden." };
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, name: true, slug: true, deletedAt: true, isActive: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (vendor.deletedAt || !vendor.isActive) {
    return { ok: false, error: "Vendor is already deleted or hidden." };
  }

  const precheck = await precheckVendorDeletion(vendor.id, createEntityDeletionGuardDeps());
  if (!precheck.ok) {
    return {
      ok: false,
      error: precheck.blockers[0]?.message ?? "Vendor cannot be deleted yet.",
      blockers: precheck.blockers.map((b) => b.message),
    };
  }

  const now = new Date();
  const podLinks = await prisma.podVendor.findMany({
    where: { vendorId: vendor.id },
    select: { podId: true, pod: { select: { slug: true } } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.vendor.update({
      where: { id: vendor.id },
      data: {
        isActive: false,
        mennyuOrdersPaused: true,
        deletedAt: now,
        deletedByUserId: input.actorUserId,
      },
    });
    await tx.podVendor.updateMany({
      where: { vendorId: vendor.id },
      data: { isActive: false },
    });
    await cancelVendorPendingInvites(vendor.id, tx);
  });

  if (input.adminReason) {
    const reasonCheck = requireAdminReason(input.adminReason);
    if (reasonCheck.ok) {
      await createAdminAuditLog({
        adminUserId: input.actorUserId,
        actionType: ADMIN_AUDIT_ACTION.VENDOR_DELETED,
        targetType: ADMIN_AUDIT_TARGET.vendor,
        targetId: vendor.id,
        reason: reasonCheck.reason,
        oldValue: { isActive: true, deletedAt: null },
        newValue: { isActive: false, deletedAt: now.toISOString() },
      });
    }
  }

  for (const link of podLinks) {
    await revalidateVendorPodMembershipSurfaces({
      vendorId: vendor.id,
      podIds: [link.podId],
    });
  }

  revalidatePath(`/vendor/${vendor.id}`);
  revalidatePath(`/admin/vendors/${vendor.id}`);
  revalidatePath("/explore");
  return { ok: true };
}

export async function deletePodProfile(input: {
  podId: string;
  actorUserId: string;
  acknowledgeActiveVendors?: boolean;
  adminReason?: string;
}): Promise<EntityDeletionResult> {
  if (!(await canDeletePod(input.actorUserId, input.podId))) {
    return { ok: false, error: "Forbidden." };
  }

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true, name: true, slug: true, deletedAt: true, isActive: true },
  });
  if (!pod) return { ok: false, error: "Pod not found." };
  if (pod.deletedAt || !pod.isActive) {
    return { ok: false, error: "Pod is already deleted or hidden." };
  }

  const precheck = await precheckPodDeletion(pod.id, createEntityDeletionGuardDeps(), {
    acknowledgeActiveVendors: input.acknowledgeActiveVendors,
  });
  if (!precheck.ok) {
    return {
      ok: false,
      error: precheck.blockers[0]?.message ?? "Pod cannot be deleted yet.",
      blockers: precheck.blockers.map((b) => b.message),
    };
  }

  const now = new Date();
  const podVendors = await prisma.podVendor.findMany({
    where: { podId: pod.id },
    select: { vendorId: true, vendor: { select: { slug: true } } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.pod.update({
      where: { id: pod.id },
      data: {
        isActive: false,
        mennyuOrdersPaused: true,
        deletedAt: now,
        deletedByUserId: input.actorUserId,
      },
    });
    await tx.podVendor.updateMany({
      where: { podId: pod.id },
      data: { isActive: false },
    });
    await cancelPodPendingInvites(pod.id, tx);
  });

  if (input.adminReason) {
    const reasonCheck = requireAdminReason(input.adminReason);
    if (reasonCheck.ok) {
      await createAdminAuditLog({
        adminUserId: input.actorUserId,
        actionType: ADMIN_AUDIT_ACTION.POD_DELETED,
        targetType: ADMIN_AUDIT_TARGET.pod,
        targetId: pod.id,
        reason: reasonCheck.reason,
        oldValue: { isActive: true, deletedAt: null },
        newValue: { isActive: false, deletedAt: now.toISOString() },
      });
    }
  }

  revalidatePath(buildPodCustomerPath(pod.slug));
  revalidatePath(`/pod/${pod.id}`);
  revalidatePath(`/admin/pods/${pod.id}`);
  revalidatePath("/explore");

  for (const link of podVendors) {
    if (link.vendor.slug) {
      revalidatePath(buildVendorMenuCustomerPath(pod.slug, link.vendor.slug));
    }
    await revalidateVendorPodMembershipSurfaces({
      vendorId: link.vendorId,
      podIds: [pod.id],
    });
  }

  return { ok: true };
}

export async function requireAuthenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
