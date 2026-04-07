"use server";

import { revalidatePath } from "next/cache";
import { PosConnectionStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageVendor } from "@/lib/permissions";

export type VendorPosActionResult = { ok: true } | { ok: false; error: string };

/**
 * Saves Deliverect / POS identifiers from the guided flow.
 * Does not call Deliverect APIs yet — optional validation can be added behind env.
 */
export async function saveVendorPosConnection(input: {
  vendorId: string;
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  deliverectAccountEmail: string | null;
  posProvider: string | null;
}): Promise<VendorPosActionResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in." };
  if (!(await canManageVendor(userId, input.vendorId))) {
    return { ok: false, error: "You don’t have permission to update this restaurant." };
  }

  const channel = input.deliverectChannelLinkId?.trim() || null;
  const location = input.deliverectLocationId?.trim() || null;
  const email = input.deliverectAccountEmail?.trim().toLowerCase() || null;
  const provider = input.posProvider?.trim() || null;

  let posConnectionStatus: PosConnectionStatus;
  if (channel) {
    posConnectionStatus = PosConnectionStatus.connected;
  } else if (email || location || provider) {
    posConnectionStatus = PosConnectionStatus.onboarding;
  } else {
    posConnectionStatus = PosConnectionStatus.not_connected;
  }

  await prisma.vendor.update({
    where: { id: input.vendorId },
    data: {
      deliverectChannelLinkId: channel,
      deliverectLocationId: location,
      deliverectAccountEmail: email,
      posProvider: provider,
      ...(provider ? { posType: provider } : {}),
      posConnectionStatus,
    },
  });

  revalidatePath(`/vendor/${input.vendorId}/orders`);
  revalidatePath(`/vendor/${input.vendorId}/connect-pos`);
  revalidatePath(`/vendor/${input.vendorId}/settings`);
  return { ok: true };
}
