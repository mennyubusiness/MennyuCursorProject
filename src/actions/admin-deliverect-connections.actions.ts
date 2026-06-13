"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import {
  adminApplyStoredChannelRegistrationPayload,
  adminManualReconnectDeliverect,
  disconnectVendorFromDeliverect,
  type DeliverectConnectionOwner,
} from "@/services/admin-deliverect-connection.service";
import { retryChannelRegistrationMatchForWebhookEventById } from "@/services/deliverect-channel-registration-retry.service";
import { pullDeliverectMenuAndIngestPhase1b } from "@/services/deliverect-menu-pull-ingest.service";

const ADMIN_CONNECTIONS_PATH = "/admin/deliverect-connections";

function revalidateDeliverectVendorPaths(vendorId: string) {
  revalidatePath(ADMIN_CONNECTIONS_PATH);
  revalidatePath("/admin/deliverect-channel-registrations");
  revalidatePath(`/admin/vendors/${vendorId}/deliverect-mapping`);
  revalidatePath(`/admin/vendors/${vendorId}/menu-history`);
  revalidatePath(`/admin/menu-imports`);
  revalidatePath(`/vendor/${vendorId}/connect-pos`);
  revalidatePath(`/vendor/${vendorId}/settings`);
  revalidatePath(`/vendor/${vendorId}/orders`);
  revalidatePath(`/vendor/${vendorId}/menu`);
}

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const allowed = await isAdminDashboardLayoutAuthorized();
  if (!allowed) return { ok: false, error: "Unauthorized." };
  return { ok: true };
}

export type AdminActionResult =
  | { ok: true; message: string; details?: Record<string, unknown> }
  | { ok: false; error: string; conflicts?: DeliverectConnectionOwner[] };

export async function adminApplyChannelRegistrationPayloadToVendor(
  webhookEventId: string,
  vendorId: string,
  forceTransfer = false
): Promise<
  | { ok: true; outcome: string; vendorId: string; channelLinkId: string }
  | { ok: false; error: string; conflicts?: DeliverectConnectionOwner[] }
> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const result = await adminApplyStoredChannelRegistrationPayload(prisma, {
    webhookEventId,
    targetVendorId: vendorId,
    forceTransfer,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, conflicts: result.conflicts };
  }

  const session = await auth();
  console.info(
    "[admin:channel_registration_apply]",
    JSON.stringify({
      at: new Date().toISOString(),
      webhookEventId,
      vendorId: result.targetVendorId,
      outcome: result.outcome,
      channelLinkId: result.channelLinkId,
      forceTransfer,
      disconnectedVendors: result.disconnectedVendors,
      adminUserId: session?.user?.id ?? null,
    })
  );

  revalidateDeliverectVendorPaths(result.targetVendorId);
  for (const d of result.disconnectedVendors) {
    revalidateDeliverectVendorPaths(d.vendorId);
  }

  return {
    ok: true,
    outcome: result.outcome,
    vendorId: result.targetVendorId,
    channelLinkId: result.channelLinkId,
  };
}

export async function adminManualReconnectDeliverectConnection(input: {
  targetVendorId: string;
  channelLinkId: string;
  locationId?: string;
  accountId?: string;
  accountEmail?: string;
  forceTransfer: boolean;
}): Promise<AdminActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const result = await adminManualReconnectDeliverect(prisma, {
    targetVendorId: input.targetVendorId,
    channelLinkId: input.channelLinkId,
    locationId: input.locationId,
    accountId: input.accountId,
    accountEmail: input.accountEmail,
    forceTransfer: input.forceTransfer,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, conflicts: result.conflicts };
  }

  const session = await auth();
  console.info(
    "[admin:deliverect_manual_reconnect]",
    JSON.stringify({
      at: new Date().toISOString(),
      targetVendorId: result.targetVendorId,
      channelLinkId: result.channelLinkId,
      forceTransfer: input.forceTransfer,
      disconnectedVendors: result.disconnectedVendors,
      adminUserId: session?.user?.id ?? null,
    })
  );

  revalidateDeliverectVendorPaths(result.targetVendorId);
  for (const d of result.disconnectedVendors) {
    revalidateDeliverectVendorPaths(d.vendorId);
  }

  const disconnectedNote =
    result.disconnectedVendors.length > 0
      ? ` Disconnected: ${result.disconnectedVendors.map((v) => v.vendorName).join(", ")}.`
      : "";

  return {
    ok: true,
    message: `Connected ${result.targetVendorId} to channel ${result.channelLinkId}.${disconnectedNote}`,
    details: {
      targetVendorId: result.targetVendorId,
      channelLinkId: result.channelLinkId,
      disconnectedVendors: result.disconnectedVendors,
    },
  };
}

export async function adminDisconnectDeliverectConnection(vendorId: string): Promise<AdminActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const id = vendorId.trim();
  if (!id) return { ok: false, error: "Vendor id is required." };

  try {
    const disconnected = await disconnectVendorFromDeliverect(prisma, id);
    const session = await auth();
    console.info(
      "[admin:deliverect_disconnect]",
      JSON.stringify({
        at: new Date().toISOString(),
        vendorId: disconnected.vendorId,
        vendorName: disconnected.vendorName,
        adminUserId: session?.user?.id ?? null,
      })
    );
    revalidateDeliverectVendorPaths(id);
    return {
      ok: true,
      message: `Disconnected ${disconnected.vendorName} from Deliverect.`,
      details: { vendorId: disconnected.vendorId },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function adminTriggerDeliverectMenuPull(vendorId: string): Promise<AdminActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const id = vendorId.trim();
  if (!id) return { ok: false, error: "Vendor id is required." };

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: { id: true, name: true, deliverectChannelLinkId: true },
  });
  if (!vendor) return { ok: false, error: "Vendor not found." };
  if (!vendor.deliverectChannelLinkId?.trim()) {
    return { ok: false, error: "Vendor is not connected to Deliverect (no channel link id)." };
  }

  try {
    const result = await pullDeliverectMenuAndIngestPhase1b({ vendorId: id });
    revalidateDeliverectVendorPaths(id);
    return {
      ok: true,
      message: `Menu pull started for ${vendor.name}. Job ${result.jobId} (${result.jobStatus}).`,
      details: {
        jobId: result.jobId,
        draftVersionId: result.draftVersionId,
        jobStatus: result.jobStatus,
        issueCount: result.issueCount,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type AdminRetryChannelRegistrationResult =
  | { ok: true; outcome: string; vendorId?: string; channelLinkId?: string }
  | { ok: false; error: string };

/** Re-runs automatic matching — does not create WebhookEvent rows. Prefer apply payload for wrong channelLocationId. */
export async function adminRetryChannelRegistrationMatch(
  webhookEventId: string
): Promise<AdminRetryChannelRegistrationResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;

  const wid = webhookEventId.trim();
  if (!wid) return { ok: false, error: "Webhook event id is required." };

  const result = await retryChannelRegistrationMatchForWebhookEventById(wid);
  if (!result.ok) return { ok: false, error: result.error };

  if (result.outcome === "matched" || result.outcome === "already_connected") {
    revalidateDeliverectVendorPaths(result.vendorId);
    return {
      ok: true,
      outcome: result.outcome,
      vendorId: result.vendorId,
      channelLinkId: result.channelLinkId,
    };
  }

  revalidatePath(ADMIN_CONNECTIONS_PATH);
  return { ok: true, outcome: result.outcome };
}
