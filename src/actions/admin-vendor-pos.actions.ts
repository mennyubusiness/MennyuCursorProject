"use server";

import { revalidatePath } from "next/cache";
import { PosConnectionStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";

const LOG_PREFIX = "[admin:disconnect-vendor-pos]";

function adminMappingPath(vendorId: string) {
  return `/admin/vendors/${vendorId}/deliverect-mapping`;
}

export type DisconnectVendorPosResult =
  | { ok: true; cleared: Record<string, string | null> }
  | { ok: false; error: string };

/**
 * Clears vendor-level Deliverect / POS connection fields so identifiers can be reused elsewhere.
 * Admin dashboard authorization only. Does not mutate VendorOrder history or menu row PLUs.
 */
export async function adminDisconnectVendorFromPos(vendorId: string): Promise<DisconnectVendorPosResult> {
  const allowed = await isAdminDashboardLayoutAuthorized();
  if (!allowed) {
    return { ok: false, error: "Unauthorized." };
  }

  const id = vendorId.trim();
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
      deliverectAccountId: true,
      deliverectAccountEmail: true,
      posProvider: true,
      posConnectionStatus: true,
      autoPublishMenus: true,
    },
  });
  if (!vendor) {
    return { ok: false, error: "Vendor not found." };
  }

  const session = await auth();
  const adminUserId = session?.user?.id ?? null;
  const adminEmail = session?.user?.email ?? null;

  const before = {
    deliverectChannelLinkId: vendor.deliverectChannelLinkId,
    deliverectLocationId: vendor.deliverectLocationId,
    deliverectAccountId: vendor.deliverectAccountId,
    deliverectAccountEmail: vendor.deliverectAccountEmail,
    posProvider: vendor.posProvider,
    posConnectionStatus: vendor.posConnectionStatus,
    autoPublishMenus: vendor.autoPublishMenus,
  };

  await prisma.vendor.update({
    where: { id },
    data: {
      deliverectChannelLinkId: null,
      deliverectLocationId: null,
      deliverectAccountId: null,
      deliverectAccountEmail: null,
      posProvider: null,
      posConnectionStatus: PosConnectionStatus.not_connected,
      autoPublishMenus: false,
    },
  });

  const cleared: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(before)) {
    if (k === "posConnectionStatus") {
      if (v !== PosConnectionStatus.not_connected) {
        cleared[k] = String(v);
      }
    } else if (k === "autoPublishMenus") {
      if (v === true) cleared[k] = "true";
    } else if (v != null && String(v).trim() !== "") {
      cleared[k] = typeof v === "string" ? v : String(v);
    }
  }

  console.info(
    LOG_PREFIX,
    JSON.stringify({
      at: new Date().toISOString(),
      vendorId: vendor.id,
      vendorName: vendor.name,
      adminUserId,
      adminEmail,
      clearedFields: Object.keys(cleared),
      previousSnapshot: before,
    })
  );

  revalidatePath(adminMappingPath(id));
  revalidatePath(`/vendor/${id}/orders`);
  revalidatePath(`/vendor/${id}/settings`);
  revalidatePath(`/vendor/${id}/connect-pos`);

  return { ok: true, cleared };
}
