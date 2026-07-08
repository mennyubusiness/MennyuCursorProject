import "server-only";

import { revalidatePath } from "next/cache";
import { MenuImportJobStatus, type VendorOrderRoutingMode } from "@prisma/client";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET, requireAdminReason } from "@/lib/admin-audit-log";
import { VENDOR_ORDER_ROUTING_MODES, isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";
import { menuSourceForOrderRoutingMode } from "@/lib/vendor-menu-source";
import { assertSquareRoutingSelectable } from "@/lib/integrations/square/square-routing-readiness";
import { buildVendorMenuCustomerPath, buildPodCustomerPath } from "@/lib/customer-public-url";
import { prisma } from "@/lib/db";
import { revalidateCustomerVendorMenuCacheForVendor } from "@/services/vendor-customer-menu-cache.service";
import { revalidateOperationalMenuCacheForVendor } from "@/services/menu-active-scope.service";
import {
  createSlugRedirect,
  listSlugRedirectsForEntity,
  normalizePublicSlug,
  validatePublicSlug,
  type SlugEntityType,
} from "@/lib/slug-admin.server";
import { attachVendorToPod } from "@/lib/attach-vendor-to-pod";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";
import { pullDeliverectMenuAndIngestPhase1b } from "@/services/deliverect-menu-pull-ingest.service";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; blockers?: string[] };

function revalidateVendorPaths(vendorId: string) {
  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidatePath("/admin/vendors");
  revalidatePath(`/vendor/${vendorId}/dashboard`);
  revalidatePath(`/vendor/${vendorId}/setup`);
  revalidatePath(`/vendor/${vendorId}/orders`);
  revalidatePath(`/vendor/${vendorId}/kitchen`);
  revalidatePath(`/vendor/${vendorId}/menu`);
  revalidatePath(`/vendor/${vendorId}/menu-builder`);
  revalidatePath(`/vendor/${vendorId}/menu/imports`);
  revalidatePath(`/vendor/${vendorId}/menu-imports`);
  revalidatePath(`/vendor/${vendorId}/connect-pos`);
  revalidatePath("/explore");
}

async function revalidateVendorOrderingSurfaces(vendorId: string) {
  revalidateVendorPaths(vendorId);
  revalidateOperationalMenuCacheForVendor(vendorId);
  revalidateCustomerVendorMenuCacheForVendor(vendorId);

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { slug: true },
  });
  if (!vendor) return;

  const memberships = await prisma.podVendor.findMany({
    where: { vendorId },
    select: { podId: true, pod: { select: { slug: true } } },
  });

  for (const membership of memberships) {
    revalidatePath(`/pod/${membership.podId}`);
    revalidatePath(`/pod/${membership.podId}/dashboard`);
    if (membership.pod.slug) {
      revalidatePath(buildPodCustomerPath(membership.pod.slug));
      if (vendor.slug) {
        revalidatePath(buildVendorMenuCustomerPath(membership.pod.slug, vendor.slug));
      }
    }
    revalidatePath(`/pod/${membership.podId}/vendor/${vendorId}`);
  }
}

export async function adminPauseVendorOrdering(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, mennyuOrdersPaused: true, name: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (vendor.mennyuOrdersPaused) return { ok: false, error: "Vendor ordering is already paused." };

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { mennyuOrdersPaused: true },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_ORDERING_PAUSED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    oldValue: { mennyuOrdersPaused: false },
    newValue: { mennyuOrdersPaused: true },
  });

  revalidateVendorPaths(vendor.id);
  return { ok: true, message: `${vendor.name} ordering paused.` };
}

export async function adminUnpauseVendorOrdering(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, mennyuOrdersPaused: true, name: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (!vendor.mennyuOrdersPaused) return { ok: false, error: "Vendor ordering is not paused." };

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { mennyuOrdersPaused: false },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_ORDERING_UNPAUSED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    oldValue: { mennyuOrdersPaused: true },
    newValue: { mennyuOrdersPaused: false },
  });

  revalidateVendorPaths(vendor.id);
  return { ok: true, message: `${vendor.name} ordering unpaused.` };
}

export async function adminHideVendor(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, isActive: true, name: true, slug: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (!vendor.isActive) return { ok: false, error: "Vendor is already hidden." };

  await prisma.vendor.update({ where: { id: vendor.id }, data: { isActive: false } });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_HIDDEN,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    oldValue: { isActive: true },
    newValue: { isActive: false },
  });

  revalidateVendorPaths(vendor.id);
  return { ok: true, message: `${vendor.name} hidden from public pages.` };
}

export async function adminShowVendor(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, isActive: true, name: true, slug: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (vendor.isActive) return { ok: false, error: "Vendor is already public." };

  await prisma.vendor.update({ where: { id: vendor.id }, data: { isActive: true } });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_SHOWN,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    oldValue: { isActive: false },
    newValue: { isActive: true },
  });

  revalidateVendorPaths(vendor.id);
  return { ok: true, message: `${vendor.name} is public again.` };
}

export async function adminUpdateVendorPublicProfile(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
  name?: string;
  description?: string | null;
  contactEmail?: string | null;
  slug?: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: {
      id: true,
      name: true,
      description: true,
      contactEmail: true,
      slug: true,
    },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };

  const data: {
    name?: string;
    description?: string | null;
    contactEmail?: string | null;
    slug?: string;
  } = {};

  if (input.name?.trim()) data.name = input.name.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.contactEmail !== undefined) data.contactEmail = input.contactEmail?.trim() || null;

  let slugChanged = false;
  if (input.slug?.trim()) {
    const validated = await validatePublicSlug({
      slug: input.slug,
      entityType: "vendor",
      entityId: vendor.id,
    });
    if (!validated.ok) return validated;
    if (validated.slug !== vendor.slug) {
      data.slug = validated.slug;
      slugChanged = true;
    }
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No profile changes provided." };
  }

  const oldValue = {
    name: vendor.name,
    description: vendor.description,
    contactEmail: vendor.contactEmail,
    slug: vendor.slug,
  };

  await prisma.vendor.update({ where: { id: vendor.id }, data });

  if (slugChanged && data.slug) {
    await createSlugRedirect({
      oldSlug: vendor.slug,
      newSlug: data.slug,
      entityType: "vendor",
      entityId: vendor.id,
      adminUserId: input.adminUserId,
      reason: reasonCheck.reason,
    });
    await createAdminAuditLog({
      adminUserId: input.adminUserId,
      actionType: ADMIN_AUDIT_ACTION.SLUG_CHANGED,
      targetType: ADMIN_AUDIT_TARGET.slug,
      targetId: vendor.id,
      reason: reasonCheck.reason,
      oldValue: { slug: vendor.slug },
      newValue: { slug: data.slug },
      metadata: { entityType: "vendor" },
    });
    await createAdminAuditLog({
      adminUserId: input.adminUserId,
      actionType: ADMIN_AUDIT_ACTION.SLUG_REDIRECT_CREATED,
      targetType: ADMIN_AUDIT_TARGET.slug,
      targetId: vendor.id,
      reason: reasonCheck.reason,
      newValue: { oldSlug: vendor.slug, newSlug: data.slug },
    });
  }

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_PUBLIC_PROFILE_UPDATED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: vendor.id,
    reason: reasonCheck.reason,
    oldValue,
    newValue: { ...oldValue, ...data },
  });

  revalidateVendorPaths(vendor.id);
  return { ok: true, message: "Vendor profile updated." };
}

export async function adminAttachVendorToPodFromVendor(input: {
  vendorId: string;
  podId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const existingOtherPod = await prisma.podVendor.findFirst({
    where: { vendorId: input.vendorId, NOT: { podId: input.podId } },
    select: { podId: true },
  });

  const result = await attachVendorToPod(input.podId, input.vendorId);
  if (!result.ok) return result;

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: existingOtherPod
      ? ADMIN_AUDIT_ACTION.VENDOR_MOVED_TO_POD
      : ADMIN_AUDIT_ACTION.VENDOR_ATTACHED_TO_POD,
    targetType: ADMIN_AUDIT_TARGET.vendorPodMembership,
    targetId: `${input.podId}:${input.vendorId}`,
    reason: reasonCheck.reason,
    newValue: {
      podId: input.podId,
      vendorId: input.vendorId,
      fromPodId: existingOtherPod?.podId ?? null,
      adminOverride: true,
    },
  });

  revalidatePath(`/admin/vendors/${input.vendorId}`);
  revalidatePath(`/admin/pods/${input.podId}`);
  revalidatePath(`/pod/${input.podId}/vendors`);
  return { ok: true, message: existingOtherPod ? "Vendor moved to pod." : "Vendor attached to pod." };
}

export async function adminDetachVendorFromPodFromVendor(input: {
  vendorId: string;
  podId: string;
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
    actionType: ADMIN_AUDIT_ACTION.VENDOR_DETACHED_FROM_POD,
    targetType: ADMIN_AUDIT_TARGET.vendorPodMembership,
    targetId: `${input.podId}:${input.vendorId}`,
    reason: reasonCheck.reason,
    oldValue: { podVendorId: podVendor.id },
  });

  revalidatePath(`/admin/vendors/${input.vendorId}`);
  revalidatePath(`/admin/pods/${input.podId}`);
  return { ok: true, message: "Vendor detached from pod." };
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

export async function adminUpdateVendorOrderRoutingMode(input: {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  if (!VENDOR_ORDER_ROUTING_MODES.includes(input.orderRoutingMode)) {
    return { ok: false, error: "Invalid order routing mode." };
  }

  if (isSquareRoutingMode(input.orderRoutingMode)) {
    const squareGate = await assertSquareRoutingSelectable(input.vendorId);
    if (!squareGate.ok) return { ok: false, error: squareGate.error };
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, orderRoutingMode: true, menuSource: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };

  const nextMenuSource = menuSourceForOrderRoutingMode(input.orderRoutingMode);
  const routingUnchanged = vendor.orderRoutingMode === input.orderRoutingMode;
  const menuSourceUnchanged = vendor.menuSource === nextMenuSource;

  if (routingUnchanged && menuSourceUnchanged) {
    return { ok: true, message: "Order routing mode unchanged." };
  }

  await prisma.vendor.update({
    where: { id: input.vendorId },
    data: {
      orderRoutingMode: input.orderRoutingMode,
      menuSource: nextMenuSource,
    },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_ORDER_ROUTING_MODE_UPDATED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: input.vendorId,
    reason: reasonCheck.reason,
    oldValue: `${vendor.orderRoutingMode} / menu:${vendor.menuSource}`,
    newValue: `${input.orderRoutingMode} / menu:${nextMenuSource}`,
  });

  await revalidateVendorOrderingSurfaces(input.vendorId);
  return { ok: true, message: "Order routing mode updated." };
}

export async function adminSetSquareOrderRoutingEnabled(input: {
  vendorId: string;
  enabled: boolean;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, orderRoutingMode: true, squareOrderRoutingEnabled: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (!isSquareRoutingMode(vendor.orderRoutingMode)) {
    return { ok: false, error: "Square order routing can only be enabled when order routing mode is Square." };
  }

  if (input.enabled) {
    const gate = await import("@/lib/integrations/square/square-order-routing-readiness").then((m) =>
      m.assertSquareOrderRoutingReady(input.vendorId)
    );
    if (!gate.ok) return { ok: false, error: gate.error };
  }

  if (vendor.squareOrderRoutingEnabled === input.enabled) {
    return { ok: true, message: input.enabled ? "Square order routing already enabled." : "Square order routing already disabled." };
  }

  await prisma.vendor.update({
    where: { id: input.vendorId },
    data: { squareOrderRoutingEnabled: input.enabled },
  });

  await createAdminAuditLog({
    adminUserId: input.adminUserId,
    actionType: ADMIN_AUDIT_ACTION.VENDOR_ORDER_ROUTING_MODE_UPDATED,
    targetType: ADMIN_AUDIT_TARGET.vendor,
    targetId: input.vendorId,
    reason: reasonCheck.reason,
    oldValue: String(vendor.squareOrderRoutingEnabled),
    newValue: String(input.enabled),
  });

  await revalidateVendorOrderingSurfaces(input.vendorId);
  return {
    ok: true,
    message: input.enabled
      ? "Square order routing enabled. Paid orders will inject to Square when SQUARE_ROUTING_LIVE is on."
      : "Square order routing disabled.",
  };
}

export async function adminRefreshVendorMenu(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, name: true, deliverectChannelLinkId: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (!vendor.deliverectChannelLinkId?.trim()) {
    return { ok: false, error: "Menu refresh is not configured yet (no Deliverect channel link)." };
  }

  try {
    const result = await pullDeliverectMenuAndIngestPhase1b({ vendorId: vendor.id });
    await createAdminAuditLog({
      adminUserId: input.adminUserId,
      actionType: ADMIN_AUDIT_ACTION.VENDOR_MENU_REFRESH_REQUESTED,
      targetType: ADMIN_AUDIT_TARGET.vendor,
      targetId: vendor.id,
      reason: reasonCheck.reason,
      newValue: {
        jobId: result.jobId,
        jobStatus: result.jobStatus,
        issueCount: result.issueCount,
      },
    });
    revalidatePath(`/admin/vendors/${vendor.id}`);
    revalidatePath(`/admin/vendors/${vendor.id}/menu-history`);
    return {
      ok: true,
      message: `Menu pull started (job ${result.jobId}, status ${result.jobStatus}).`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Menu refresh failed." };
  }
}

export async function adminChangeVendorSlug(input: {
  vendorId: string;
  newSlug: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  return adminUpdateVendorPublicProfile({
    vendorId: input.vendorId,
    adminUserId: input.adminUserId,
    reason: input.reason,
    slug: input.newSlug,
  });
}

export async function adminRestoreVendorSlug(input: {
  vendorId: string;
  oldSlug: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  return adminUpdateVendorPublicProfile({
    vendorId: input.vendorId,
    adminUserId: input.adminUserId,
    reason: input.reason,
    slug: input.oldSlug,
  });
}

export { listSlugRedirectsForEntity, normalizePublicSlug };

export async function loadVendorMenuSyncSummary(vendorId: string) {
  const [latestSuccess, latestFailed, menuCounts, vendor] = await Promise.all([
    prisma.menuImportJob.findFirst({
      where: { vendorId, status: MenuImportJobStatus.succeeded },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, startedAt: true, source: true },
    }),
    prisma.menuImportJob.findFirst({
      where: { vendorId, status: MenuImportJobStatus.failed },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, errorMessage: true },
    }),
    prisma.menuItem.groupBy({
      by: ["isAvailable"],
      where: { vendorId },
      _count: { _all: true },
    }),
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { deliverectChannelLinkId: true },
    }),
  ]);

  let totalItems = 0;
  let unavailableItems = 0;
  for (const row of menuCounts) {
    totalItems += row._count._all;
    if (!row.isAvailable) unavailableItems += row._count._all;
  }

  return {
    lastSuccessAt: latestSuccess?.completedAt?.toISOString() ?? null,
    lastFailedAt: latestFailed?.completedAt?.toISOString() ?? null,
    lastFailedMessage: latestFailed?.errorMessage ?? null,
    totalItems,
    visibleItems: totalItems - unavailableItems,
    unavailableItems,
    refreshConfigured: Boolean(vendor?.deliverectChannelLinkId?.trim()),
  };
}

export function buildVendorPublicPathPreview(slug: string, podSlug?: string | null) {
  if (podSlug) return buildVendorMenuCustomerPath(podSlug, slug);
  return `/{podSlug}/${slug}`;
}

export function buildPodPublicPathPreview(slug: string) {
  return buildPodCustomerPath(slug);
}

export async function adminDeleteVendorProfile(input: {
  vendorId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<ActionResult> {
  const reasonCheck = requireAdminReason(input.reason);
  if (!reasonCheck.ok) return reasonCheck;

  const { deleteVendorProfile } = await import("@/services/entity-deletion.service");
  return deleteVendorProfile({
    vendorId: input.vendorId,
    actorUserId: input.adminUserId ?? input.vendorId,
    adminReason: reasonCheck.reason,
  });
}

export type { SlugEntityType };
