"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActionContext } from "@/lib/admin-action-context";
import {
  adminAttachVendorToPodFromVendor,
  adminChangeVendorSlug,
  adminDetachVendorFromPodFromVendor,
  adminHideVendor,
  adminLogVendorReadinessRecheck,
  adminPauseVendorOrdering,
  adminRefreshVendorMenu,
  adminRestoreVendorSlug,
  adminShowVendor,
  adminUnpauseVendorOrdering,
  adminUpdateVendorPublicProfile,
  adminUpdateVendorOrderRoutingMode,
} from "@/services/admin-vendor-rescue.service";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function withAdmin<T extends ActionResult>(
  fn: (ctx: { adminUserId: string | null }) => Promise<T>
): Promise<T | { ok: false; error: string }> {
  const ctx = await requireAdminActionContext();
  if (!ctx.ok) return ctx;
  const result = await fn(ctx);
  if (result.ok) revalidatePath("/admin/vendors");
  return result;
}

export async function adminPauseVendorOrderingAction(vendorId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminPauseVendorOrdering({ vendorId, adminUserId, reason }));
}

export async function adminUnpauseVendorOrderingAction(vendorId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminUnpauseVendorOrdering({ vendorId, adminUserId, reason }));
}

export async function adminHideVendorAction(vendorId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminHideVendor({ vendorId, adminUserId, reason }));
}

export async function adminShowVendorAction(vendorId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminShowVendor({ vendorId, adminUserId, reason }));
}

export async function adminUpdateVendorPublicProfileAction(input: {
  vendorId: string;
  reason: string;
  name?: string;
  description?: string;
  contactEmail?: string;
  slug?: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminUpdateVendorPublicProfile({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/vendors/${input.vendorId}`);
      return r;
    })
  );
}

export async function adminChangeVendorSlugAction(vendorId: string, newSlug: string, reason: string) {
  return withAdmin(({ adminUserId }) =>
    adminChangeVendorSlug({ vendorId, newSlug, adminUserId, reason }).then((r) => {
      if (r.ok) revalidatePath(`/admin/vendors/${vendorId}`);
      return r;
    })
  );
}

export async function adminRestoreVendorSlugAction(vendorId: string, oldSlug: string, reason: string) {
  return withAdmin(({ adminUserId }) =>
    adminRestoreVendorSlug({ vendorId, oldSlug, adminUserId, reason }).then((r) => {
      if (r.ok) revalidatePath(`/admin/vendors/${vendorId}`);
      return r;
    })
  );
}

export async function adminAttachVendorToPodFromVendorAction(input: {
  vendorId: string;
  podId: string;
  reason: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminAttachVendorToPodFromVendor({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/vendors/${input.vendorId}`);
      return r;
    })
  );
}

export async function adminDetachVendorFromPodFromVendorAction(input: {
  vendorId: string;
  podId: string;
  reason: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminDetachVendorFromPodFromVendor({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/vendors/${input.vendorId}`);
      return r;
    })
  );
}

export async function adminRefreshVendorMenuAction(vendorId: string, reason: string) {
  return withAdmin(({ adminUserId }) =>
    adminRefreshVendorMenu({ vendorId, adminUserId, reason }).then((r) => {
      if (r.ok) revalidatePath(`/admin/vendors/${vendorId}`);
      return r;
    })
  );
}

export async function adminRecheckVendorReadinessAction(vendorId: string, reason: string) {
  return withAdmin(({ adminUserId }) => adminLogVendorReadinessRecheck({ vendorId, adminUserId, reason }));
}

export async function adminUpdateVendorOrderRoutingModeAction(input: {
  vendorId: string;
  orderRoutingMode: "manual_dashboard" | "deliverect";
  reason: string;
}) {
  return withAdmin(({ adminUserId }) =>
    adminUpdateVendorOrderRoutingMode({ ...input, adminUserId }).then((r) => {
      if (r.ok) revalidatePath(`/admin/vendors/${input.vendorId}`);
      return r;
    })
  );
}
