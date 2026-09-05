"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActionContext } from "@/lib/admin-action-context";
import {
  adminAddPodOwnerFromPod,
  adminAttachVendorToPodFromPod,
  adminDetachVendorFromPodFromPod,
  adminHidePod,
  adminLogPodQrRegenerated,
  adminLogPodReadinessRecheck,
  adminPausePodOrdering,
  adminRemovePodOwnerFromPod,
  adminSetPodOrderingMode,
  adminSetPodVendorActive,
  adminShowPod,
  adminUnpausePodOrdering,
  adminUpdatePodPublicProfile,
  adminDeletePodProfile,
} from "@/services/admin-pod-rescue.service";
import { adminCreateUnclaimedVendor } from "@/services/admin-concierge-vendor.service";

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; blockers?: string[] };

async function withAdmin<T extends ActionResult>(
  fn: (ctx: { adminUserId: string | null }) => Promise<T>
): Promise<T | { ok: false; error: string }> {
  const ctx = await requireAdminActionContext();
  if (!ctx.ok) return ctx;
  const result = await fn(ctx);
  if (result.ok) revalidatePath("/admin/pods");
  return result;
}

export async function adminCreateUnclaimedVendorAction(input: {
  podId: string;
  name: string;
  cuisineCategory?: string;
  contactName?: string;
  contactEmail?: string;
  reason: string;
  allowDuplicateName?: boolean;
}) {
  return withAdmin(({ adminUserId }) =>
    adminCreateUnclaimedVendor({ ...input, adminUserId }).then((result) => {
      if (result.ok) {
        revalidatePath(`/admin/pods/${input.podId}`);
        revalidatePath(`/admin/vendors/${result.vendor.id}`);
      }
      return result;
    })
  );
}

/** Platform-admin only (enforced by `withAdmin`). Pod owners cannot change ordering mode. */
export async function adminSetPodOrderingModeAction(
  podId: string,
  orderingEnabled: boolean,
  reason: string
) {
  return withAdmin(({ adminUserId }) =>
    adminSetPodOrderingMode({ podId, orderingEnabled, adminUserId, reason }).then((r) => {
      if (r.ok) revalidatePath(`/admin/pods/${podId}`);
      return r;
    })
  );
}

export async function adminPausePodOrderingAction(podId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminPausePodOrdering({ podId, adminUserId, reason }));
}

export async function adminUnpausePodOrderingAction(podId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminUnpausePodOrdering({ podId, adminUserId, reason }));
}

export async function adminHidePodAction(podId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminHidePod({ podId, adminUserId, reason }));
}

export async function adminShowPodAction(podId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminShowPod({ podId, adminUserId, reason }));
}

export async function adminUpdatePodPublicProfileAction(input: {
  podId: string;
  reason: string;
  name?: string;
  description?: string;
  address?: string;
  contactEmail?: string;
  slug?: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminUpdatePodPublicProfile({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/pods/${input.podId}`);
      return r;
    })
  );
}

export async function adminAttachVendorToPodFromPodAction(input: {
  podId: string;
  vendorId: string;
  reason: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminAttachVendorToPodFromPod({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/pods/${input.podId}`);
      return r;
    })
  );
}

export async function adminDetachVendorFromPodFromPodAction(input: {
  podId: string;
  vendorId: string;
  reason: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminDetachVendorFromPodFromPod({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/pods/${input.podId}`);
      return r;
    })
  );
}

export async function adminSetPodVendorActiveAction(input: {
  podId: string;
  vendorId: string;
  isActive: boolean;
  reason: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminSetPodVendorActive({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/pods/${input.podId}`);
      return r;
    })
  );
}

export async function adminAddPodOwnerFromPodAction(input: {
  podId: string;
  userId: string;
  reason: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminAddPodOwnerFromPod({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/pods/${input.podId}`);
      return r;
    })
  );
}

export async function adminRemovePodOwnerFromPodAction(input: {
  podId: string;
  userId: string;
  reason: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminRemovePodOwnerFromPod({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/pods/${input.podId}`);
      return r;
    })
  );
}

export async function adminLogPodQrRegeneratedAction(input: {
  podId: string;
  reason: string;
  destinationUrl: string;
}) {
  return withAdmin(({ adminUserId }) => adminLogPodQrRegenerated({ ...input, adminUserId }));
}

export async function adminRecheckPodReadinessAction(podId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminLogPodReadinessRecheck({ podId, adminUserId, reason }));
}

export async function adminDeletePodProfileAction(
  podId: string,
  reason: string,
  acknowledgeActiveVendors?: boolean
) {
  return withAdmin(({ adminUserId }) =>
    adminDeletePodProfile({
      podId,
      adminUserId,
      reason,
      acknowledgeActiveVendors,
    }).then((r) => {
      if (r.ok) {
        revalidatePath(`/admin/pods/${podId}`);
        return { ok: true as const, message: "Pod deleted." };
      }
      return { ok: false as const, error: r.error, blockers: r.blockers };
    })
  );
}
