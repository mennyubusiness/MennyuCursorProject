"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import {
  applyChannelRegistrationToVendor,
  parseChannelRegistrationPayload,
} from "@/services/deliverect-channel-registration.service";
import { retryChannelRegistrationMatchForWebhookEventById } from "@/services/deliverect-channel-registration-retry.service";

export type AdminApplyChannelRegistrationResult =
  | { ok: true; outcome: string; vendorId: string; channelLinkId: string }
  | { ok: false; error: string };

/**
 * Applies channelLinkId (and optional location/account ids) from a stored channel-registration webhook to a vendor.
 * Use when automatic matching failed but the payload is valid (admin recovery).
 */
export async function adminApplyChannelRegistrationPayloadToVendor(
  webhookEventId: string,
  vendorId: string
): Promise<AdminApplyChannelRegistrationResult> {
  const allowed = await isAdminDashboardLayoutAuthorized();
  if (!allowed) {
    return { ok: false, error: "Unauthorized." };
  }

  const wid = webhookEventId.trim();
  const vid = vendorId.trim();
  if (!wid || !vid) {
    return { ok: false, error: "Webhook event id and vendor id are required." };
  }

  const ev = await prisma.webhookEvent.findUnique({
    where: { id: wid },
    select: { id: true, provider: true, payload: true },
  });
  if (!ev || ev.provider !== "deliverect_channel_registration") {
    return { ok: false, error: "Webhook event not found or not a channel registration event." };
  }

  const payload = ev.payload as Record<string, unknown>;
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid stored payload." };
  }

  const extract = parseChannelRegistrationPayload(payload);
  if (!extract.channelLinkId) {
    return { ok: false, error: "Stored payload has no channelLinkId." };
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: vid },
    select: { id: true, name: true },
  });
  if (!vendor) {
    return { ok: false, error: "Vendor not found." };
  }

  const session = await auth();
  const applied = await applyChannelRegistrationToVendor(prisma, vid, extract);

  if (applied.outcome === "error") {
    return { ok: false, error: applied.message };
  }

  if (applied.outcome === "channel_link_conflict") {
    return {
      ok: false,
      error: `Vendor already has channel link ${applied.existingChannelLinkId}; incoming ${applied.incomingChannelLinkId}. Clear connection first if intentional.`,
    };
  }

  revalidatePath("/admin/deliverect-channel-registrations");
  revalidatePath(`/admin/vendors/${vid}/deliverect-mapping`);
  revalidatePath(`/vendor/${vid}/connect-pos`);
  revalidatePath(`/vendor/${vid}/orders`);

  console.info(
    "[admin:channel_registration_apply]",
    JSON.stringify({
      at: new Date().toISOString(),
      webhookEventId: wid,
      vendorId: vid,
      vendorName: vendor.name,
      outcome: applied.outcome,
      channelLinkId: applied.channelLinkId,
      adminUserId: session?.user?.id ?? null,
    })
  );

  return {
    ok: true,
    outcome: applied.outcome,
    vendorId: applied.vendorId,
    channelLinkId: applied.channelLinkId,
  };
}

export type AdminRetryChannelRegistrationResult =
  | { ok: true; outcome: string; vendorId?: string; channelLinkId?: string }
  | { ok: false; error: string };

/**
 * Re-runs automatic matching for a stored channel-registration webhook (same matcher as inbound POST).
 * Does not create a duplicate WebhookEvent row.
 */
export async function adminRetryChannelRegistrationMatch(
  webhookEventId: string
): Promise<AdminRetryChannelRegistrationResult> {
  const allowed = await isAdminDashboardLayoutAuthorized();
  if (!allowed) {
    return { ok: false, error: "Unauthorized." };
  }

  const wid = webhookEventId.trim();
  if (!wid) {
    return { ok: false, error: "Webhook event id is required." };
  }

  const result = await retryChannelRegistrationMatchForWebhookEventById(wid);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  if (result.outcome === "still_no_match") {
    return { ok: true, outcome: "still_no_match" };
  }

  if (result.outcome === "ambiguous") {
    return { ok: true, outcome: `ambiguous:${result.vendorIds.join(",")}` };
  }

  revalidatePath("/admin/deliverect-channel-registrations");
  if (result.vendorId) {
    revalidatePath(`/admin/vendors/${result.vendorId}/deliverect-mapping`);
    revalidatePath(`/vendor/${result.vendorId}/connect-pos`);
    revalidatePath(`/vendor/${result.vendorId}/orders`);
  }

  console.info(
    "[admin:channel_registration_retry]",
    JSON.stringify({
      at: new Date().toISOString(),
      webhookEventId: wid,
      outcome: result.outcome,
      vendorId: result.vendorId ?? null,
      channelLinkId: result.channelLinkId ?? null,
    })
  );

  return {
    ok: true,
    outcome: result.outcome,
    vendorId: result.vendorId,
    channelLinkId: result.channelLinkId,
  };
}
