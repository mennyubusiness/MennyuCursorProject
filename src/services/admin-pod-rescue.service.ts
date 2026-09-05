import "server-only";

import { revalidatePath } from "next/cache";
import { PodMembershipRole } from "@prisma/client";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { attachVendorToPod } from "@/lib/attach-vendor-to-pod";
import { createSlugRedirect, validatePublicSlug } from "@/lib/slug-admin.server";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; blockers?: string[] };

function revalidatePodPaths(podId: string) {
  revalidatePath(`/admin/pods/${podId}`);
  revalidatePath("/admin/pods");
  revalidatePath(`/pod/${podId}/dashboard`);
  revalidatePath("/explore");
}

/**
 * Sets durable pod-wide ordering intent (orderable vs menu-only).
 *
 * Vendor-level `orderingEnabled` is intentionally left untouched: while the pod is menu-only
 * every vendor is effectively menu-only, and each vendor's own setting resumes when the pod
 * switches back. Menus, routing, and payment configuration are never modified here.
 */
export async function adminSetPodOrderingMode(input: {
  podId: string;
  orderingEnabled: boolean;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true, name: true, slug: true, orderingEnabled: true },
  });
  if (!pod) return { ok: false, error: "Pod not found." };
  if (pod.orderingEnabled === input.orderingEnabled) {
    return {
      ok: false,
      error: input.orderingEnabled
        ? "Ordering is already enabled for this pod."
        : "This pod is already menu only.",
    };
  }

  await prisma.pod.update({
    where: { id: pod.id },
    data: { orderingEnabled: input.orderingEnabled },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: input.orderingEnabled
      ? ADMIN_AUDIT_ACTION.POD_ORDERING_MODE_ENABLED
      : ADMIN_AUDIT_ACTION.POD_ORDERING_MODE_MENU_ONLY,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    oldValue: { orderingEnabled: pod.orderingEnabled },
    newValue: { orderingEnabled: input.orderingEnabled },
  });

  revalidatePodPaths(pod.id);
  revalidatePath(`/pod/${pod.id}`);
  if (pod.slug) revalidatePath(buildPodCustomerPath(pod.slug));
  return {
    ok: true,
    message: input.orderingEnabled
      ? `${pod.name} ordering enabled.`
      : `${pod.name} is now menu only.`,
  };
}

export async function adminPausePodOrdering(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true, name: true, mennyuOrdersPaused: true },
  });
  if (!pod) return { ok: false, error: "Pod not found." };
  if (pod.mennyuOrdersPaused) return { ok: false, error: "Pod ordering is already paused." };

  await prisma.pod.update({ where: { id: pod.id }, data: { mennyuOrdersPaused: true } });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_ORDERING_PAUSED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    oldValue: { mennyuOrdersPaused: false },
    newValue: { mennyuOrdersPaused: true },
  });

  revalidatePodPaths(pod.id);
  return { ok: true, message: `${pod.name} ordering paused for all vendors.` };
}

export async function adminUnpausePodOrdering(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true, name: true, mennyuOrdersPaused: true },
  });
  if (!pod) return { ok: false, error: "Pod not found." };
  if (!pod.mennyuOrdersPaused) return { ok: false, error: "Pod ordering is not paused." };

  await prisma.pod.update({ where: { id: pod.id }, data: { mennyuOrdersPaused: false } });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_ORDERING_UNPAUSED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    oldValue: { mennyuOrdersPaused: true },
    newValue: { mennyuOrdersPaused: false },
  });

  revalidatePodPaths(pod.id);
  return { ok: true, message: `${pod.name} ordering unpaused.` };
}

export async function adminHidePod(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true, name: true, isActive: true },
  });
  if (!pod) return { ok: false, error: "Pod not found." };
  if (!pod.isActive) return { ok: false, error: "Pod is already hidden." };

  await prisma.pod.update({ where: { id: pod.id }, data: { isActive: false } });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_HIDDEN,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    oldValue: { isActive: true },
    newValue: { isActive: false },
  });

  revalidatePodPaths(pod.id);
  return { ok: true, message: `${pod.name} hidden from public pages.` };
}

export async function adminShowPod(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true, name: true, isActive: true },
  });
  if (!pod) return { ok: false, error: "Pod not found." };
  if (pod.isActive) return { ok: false, error: "Pod is already public." };

  await prisma.pod.update({ where: { id: pod.id }, data: { isActive: true } });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_SHOWN,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    oldValue: { isActive: false },
    newValue: { isActive: true },
  });

  revalidatePodPaths(pod.id);
  return { ok: true, message: `${pod.name} is public again.` };
}

export async function adminUpdatePodPublicProfile(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
  name?: string;
  description?: string | null;
  address?: string | null;
  contactEmail?: string | null;
  slug?: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const pod = await prisma.pod.findUnique({
    where: { id: input.podId },
    select: { id: true, name: true, description: true, address: true, contactEmail: true, slug: true },
  });
  if (!pod) return { ok: false, error: "Pod not found." };

  const data: {
    name?: string;
    description?: string | null;
    address?: string | null;
    contactEmail?: string | null;
    slug?: string;
  } = {};

  if (input.name?.trim()) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.address !== undefined) data.address = input.address?.trim() || null;
  if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail?.trim() || null;

  if (input.slug?.trim()) {
    const validated = await validatePublicSlug({ slug: input.slug, entityType: "pod", entityId: pod.id });
    if (!validated.ok) return validated;
    if (validated.slug !== pod.slug) data.slug = validated.slug;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No profile changes provided." };
  }

  const oldValue = {
    name: pod.name,
    description: pod.description,
    address: pod.address,
    contactEmail: pod.contactEmail,
    slug: pod.slug,
  };

  await prisma.pod.update({ where: { id: pod.id }, data });

  if (data.slug && data.slug !== pod.slug) {
    await createSlugRedirect({
      oldSlug: pod.slug,
      newSlug: data.slug,
      entityType: "pod",
      entityId: pod.id,
      adminUserId: input.adminUserId,
      reason: reasonCheck.reason,
    });
    await createAdminAuditLog({
      adminUserId: input.adminUserId,
      actionType: ADMIN_AUDIT_ACTION.SLUG_CHANGED,
      targetType: ADMIN_AUDIT_TARGET.slug,
      targetId: pod.id,
      reason: reasonCheck.reason,
      oldValue: { slug: pod.slug },
      newValue: { slug: data.slug },
      metadata: { entityType: "pod" },
    });
    await createAdminAuditLog({
      adminUserId: input.adminUserId,
      actionType: ADMIN_AUDIT_ACTION.SLUG_REDIRECT_CREATED,
      targetType: ADMIN_AUDIT_TARGET.slug,
      targetId: pod.id,
      reason: reasonCheck.reason,
      newValue: { oldSlug: pod.slug, newSlug: data.slug },
    });
  }

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_PUBLIC_PROFILE_UPDATED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    oldValue,
    newValue: { ...oldValue, ...data },
  });

  revalidatePodPaths(pod.id);
  return { ok: true, message: "Pod profile updated." };
}

export async function adminAttachVendorToPodFromPod(input: {
  podId: string;
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const existing = await prisma.podVendor.findUnique({
    where: { podId_vendorId: { podId: input.podId, vendorId: input.vendorId } },
  });
  if (existing) return { ok: false, error: "Vendor is already attached to this pod." };

  const result = await attachVendorToPod(input.podId, input.vendorId);
  if (!result.ok) return result;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_VENDOR_ATTACHED,
    targetType: ADMIN_AUDIT_TARGET.vendorPodMembership,
    targetId: `${input.podId}:${input.vendorId}`,
    reason: reasonCheck.reason,
    newValue: { podId: input.podId, vendorId: input.vendorId, adminOverride: true },
  });

  revalidatePath(`/admin/pods/${input.podId}`);
  revalidatePath(`/admin/vendors/${input.vendorId}`);
  revalidatePath(`/pod/${input.podId}/vendors`);
  return { ok: true, message: "Vendor attached to pod." };
}

export async function adminDetachVendorFromPodFromPod(input: {
  podId: string;
  vendorId: string;
  adminUserId: string | null;
  reason: string;
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
    actionType: ADMIN_AUDIT_ACTION.POD_VENDOR_DETACHED,
    targetType: ADMIN_AUDIT_TARGET.vendorPodMembership,
    targetId: `${input.podId}:${input.vendorId}`,
    reason: reasonCheck.reason,
    oldValue: { podVendorId: podVendor.id },
  });

  revalidatePath(`/admin/pods/${input.podId}`);
  revalidatePath(`/admin/vendors/${input.vendorId}`);
  return { ok: true, message: "Vendor detached from pod." };
}

export async function adminSetPodVendorActive(input: {
  podId: string;
  vendorId: string;
  isActive: boolean;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const podVendor = await prisma.podVendor.findUnique({
    where: { podId_vendorId: { podId: input.podId, vendorId: input.vendorId } },
  });
  if (!podVendor) return { ok: false, error: "Vendor is not attached to this pod." };
  if (podVendor.isActive === input.isActive) {
    return { ok: false, error: input.isActive ? "Vendor is already active in pod." : "Vendor is already paused in pod." };
  }

  await prisma.podVendor.update({
    where: { id: podVendor.id },
    data: { isActive: input.isActive },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: input.isActive ? ADMIN_AUDIT_ACTION.VENDOR_SHOWN : ADMIN_AUDIT_ACTION.VENDOR_HIDDEN,
    targetType: ADMIN_AUDIT_TARGET.vendorPodMembership,
    targetId: `${input.podId}:${input.vendorId}`,
    reason: reasonCheck.reason,
    oldValue: { podVendorActive: podVendor.isActive },
    newValue: { podVendorActive: input.isActive },
    metadata: { scope: "pod_roster" },
  });

  revalidatePath(`/admin/pods/${input.podId}`);
  revalidatePath(`/admin/vendors/${input.vendorId}`);
  return { ok: true, message: input.isActive ? "Vendor active in pod." : "Vendor paused in pod." };
}

export async function adminAddPodOwnerFromPod(input: {
  podId: string;
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const [user, pod, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } }),
    prisma.pod.findUnique({ where: { id: input.podId }, select: { id: true } }),
    prisma.podMembership.findUnique({
      where: { userId_podId: { userId: input.userId, podId: input.podId } },
    }),
  ]);
  if (!user) return { ok: false, error: "User not found." };
  if (!pod) return { ok: false, error: "Pod not found." };
  if (existing?.role === PodMembershipRole.owner) {
    return { ok: false, error: "User is already a pod owner." };
  }

  if (existing) {
    await prisma.podMembership.update({
      where: { userId_podId: { userId: input.userId, podId: input.podId } },
      data: { role: PodMembershipRole.owner },
    });
  } else {
    await prisma.podMembership.create({
      data: { userId: input.userId, podId: input.podId, role: PodMembershipRole.owner },
    });
  }

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_OWNER_ACCESS_ADDED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: input.podId,
    reason: reasonCheck.reason,
    newValue: { userId: input.userId },
  });

  revalidatePath(`/admin/pods/${input.podId}`);
  revalidatePath(`/admin/users/${input.userId}`);
  return { ok: true, message: "Pod owner access added." };
}

export async function adminRemovePodOwnerFromPod(input: {
  podId: string;
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const membership = await prisma.podMembership.findUnique({
    where: { userId_podId: { userId: input.userId, podId: input.podId } },
  });
  if (!membership) return { ok: false, error: "User does not have pod access." };

  const owners = await prisma.podMembership.count({
    where: { podId: input.podId, role: PodMembershipRole.owner },
  });
  if (membership.role === PodMembershipRole.owner && owners <= 1) {
    return { ok: false, error: "Cannot remove the only pod owner." };
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
  });

  revalidatePath(`/admin/pods/${input.podId}`);
  revalidatePath(`/admin/users/${input.userId}`);
  return { ok: true, message: "Pod access removed." };
}

export async function adminLogPodQrRegenerated(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
  destinationUrl: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const pod = await prisma.pod.findUnique({ where: { id: input.podId }, select: { id: true, slug: true } });
  if (!pod) return { ok: false, error: "Pod not found." };

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.QR_REGENERATED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: pod.id,
    reason: reasonCheck.reason,
    newValue: { destinationUrl: input.destinationUrl, slug: pod.slug },
    metadata: { note: "QR codes are generated dynamically from the canonical pod URL." },
  });

  return { ok: true, message: "QR destination confirmed and logged." };
}

export async function adminLogPodReadinessRecheck(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.POD_READINESS_RECHECKED,
    targetType: ADMIN_AUDIT_TARGET.pod,
    targetId: input.podId,
    reason: reasonCheck.reason,
    metadata: { note: "Readiness is computed dynamically on page load." },
  });

  return { ok: true, message: "Readiness rechecked (computed on load)." };
}

export async function adminLogVendorReadinessRecheck(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_READINESS_RECHECKED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: input.vendorId,
    reason: reasonCheck.reason,
    metadata: { note: "Readiness is computed dynamically on page load." },
  });

  return { ok: true, message: "Readiness rechecked (computed on load)." };
}

export function buildPodPublicPathPreview(slug: string) {
  return buildPodCustomerPath(slug);
}

export async function adminDeletePodProfile(input: {
  podId: string;
  adminUserId: string | null;
  reason: string;
  acknowledgeActiveVendors?: boolean;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const { deletePodProfile } = await import("@/services/entity-deletion.service");
  return deletePodProfile({
    podId: input.podId,
    actorUserId: input.adminUserId ?? input.podId,
    acknowledgeActiveVendors: input.acknowledgeActiveVendors === true,
    adminReason: reasonCheck.reason,
  });
}
