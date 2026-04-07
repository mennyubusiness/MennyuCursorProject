"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { PosConnectionStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageVendor } from "@/lib/permissions";

export type VendorPosActionResult = { ok: true } | { ok: false; error: string };

export type StartDeliverectPosOnboardingResult =
  | { ok: true; pendingKey: string }
  | { ok: false; error: string };

/**
 * Starts automatic Deliverect linking: saves onboarding email, generates a correlation key for the channel-registration webhook, sets status to onboarding.
 */
export async function startDeliverectPosOnboarding(input: {
  vendorId: string;
  deliverectAccountEmail: string;
  posProvider: string | null;
}): Promise<StartDeliverectPosOnboardingResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Not signed in." };
  if (!(await canManageVendor(userId, input.vendorId))) {
    return { ok: false, error: "You don’t have permission to update this restaurant." };
  }

  const email = input.deliverectAccountEmail.trim().toLowerCase();
  if (!email) {
    return {
      ok: false,
      error: "Enter the email you use for your POS hub — we need it to match your account when setup finishes.",
    };
  }

  const provider = input.posProvider?.trim() || null;
  const pendingKey = randomUUID();

  await prisma.vendor.update({
    where: { id: input.vendorId },
    data: {
      deliverectAccountEmail: email,
      posProvider: provider,
      ...(provider ? { posType: provider } : {}),
      pendingDeliverectConnectionKey: pendingKey,
      posConnectionStatus: PosConnectionStatus.onboarding,
    },
  });

  revalidatePath(`/vendor/${input.vendorId}/orders`);
  revalidatePath(`/vendor/${input.vendorId}/connect-pos`);
  revalidatePath(`/vendor/${input.vendorId}/settings`);
  return { ok: true, pendingKey };
}

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
      ...(channel ? { pendingDeliverectConnectionKey: null } : {}),
    },
  });

  revalidatePath(`/vendor/${input.vendorId}/orders`);
  revalidatePath(`/vendor/${input.vendorId}/connect-pos`);
  revalidatePath(`/vendor/${input.vendorId}/settings`);
  return { ok: true };
}
