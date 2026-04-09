/**
 * Re-run exact matching for stored channel-registration webhook payloads (no new Deliverect delivery).
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  applyChannelRegistrationToVendor,
  findVendorForChannelRegistration,
  parseChannelRegistrationPayload,
} from "@/services/deliverect-channel-registration.service";

function payloadChannelLocationId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const v = (payload as Record<string, unknown>).channelLocationId;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function isUnmatchedErrorMessage(msg: string | null): boolean {
  if (!msg) return false;
  return msg.startsWith("no_match") || msg.startsWith("ambiguous:");
}

/**
 * True if there is a processed channel-registration webhook that did not match, whose payload
 * references this vendor’s Mennyu Location ID (`channelLocationId` === `vendor.id`).
 */
export async function hasUnmatchedChannelRegistrationForVendor(
  db: PrismaClient,
  vendorId: string
): Promise<boolean> {
  const recent = await db.webhookEvent.findMany({
    where: {
      provider: "deliverect_channel_registration",
      processed: true,
    },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { payload: true, errorMessage: true },
  });

  return recent.some((row) => {
    if (!isUnmatchedErrorMessage(row.errorMessage)) return false;
    return payloadChannelLocationId(row.payload) === vendorId;
  });
}

export async function findLatestUnmatchedWebhookEventIdForVendor(
  db: PrismaClient,
  vendorId: string
): Promise<string | null> {
  const recent = await db.webhookEvent.findMany({
    where: {
      provider: "deliverect_channel_registration",
      processed: true,
    },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: { id: true, payload: true, errorMessage: true },
  });

  for (const row of recent) {
    if (!isUnmatchedErrorMessage(row.errorMessage)) continue;
    if (payloadChannelLocationId(row.payload) === vendorId) {
      return row.id;
    }
  }
  return null;
}

export type RetryChannelRegistrationMatchResult =
  | { ok: true; outcome: "matched" | "already_connected"; vendorId: string; channelLinkId: string }
  | { ok: true; outcome: "still_no_match" }
  | { ok: true; outcome: "ambiguous"; vendorIds: string[] }
  | { ok: false; error: string };

/**
 * Re-parses the stored payload and runs the same matcher + apply as the HTTP webhook (without inserting a new WebhookEvent).
 * Safe to call multiple times: applies idempotent vendor updates only.
 */
export async function retryChannelRegistrationMatchForWebhookEvent(
  db: PrismaClient,
  webhookEventId: string
): Promise<RetryChannelRegistrationMatchResult> {
  const ev = await db.webhookEvent.findUnique({
    where: { id: webhookEventId },
    select: { id: true, provider: true, payload: true },
  });

  if (!ev) {
    return { ok: false, error: "Webhook event not found." };
  }
  if (ev.provider !== "deliverect_channel_registration") {
    return { ok: false, error: "Not a channel registration webhook event." };
  }

  const payload = ev.payload as Record<string, unknown>;
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid payload." };
  }

  const extract = parseChannelRegistrationPayload(payload);
  if (!extract.channelLinkId) {
    return { ok: false, error: "Payload has no channelLinkId." };
  }

  const match = await findVendorForChannelRegistration(db, extract);

  if (match.kind === "ambiguous") {
    return { ok: true, outcome: "ambiguous", vendorIds: match.vendorIds };
  }

  if (match.kind === "none") {
    return { ok: true, outcome: "still_no_match" };
  }

  const applied = await applyChannelRegistrationToVendor(db, match.vendorId, extract);

  if (applied.outcome === "error") {
    return { ok: false, error: applied.message };
  }

  if (applied.outcome === "channel_link_conflict") {
    return {
      ok: false,
      error: `Channel link conflict: vendor already has ${applied.existingChannelLinkId}, incoming ${applied.incomingChannelLinkId}.`,
    };
  }

  await db.webhookEvent.update({
    where: { id: webhookEventId },
    data: {
      processed: true,
      processedAt: new Date(),
      errorMessage:
        applied.outcome === "already_connected"
          ? "retry_resolved:already_connected"
          : "retry_resolved:matched",
    },
  });

  return {
    ok: true,
    outcome: applied.outcome === "already_connected" ? "already_connected" : "matched",
    vendorId: applied.vendorId,
    channelLinkId: applied.channelLinkId,
  };
}

/** Convenience for app code that uses the shared prisma client. */
export async function retryChannelRegistrationMatchForWebhookEventById(
  webhookEventId: string
): Promise<RetryChannelRegistrationMatchResult> {
  return retryChannelRegistrationMatchForWebhookEvent(prisma, webhookEventId);
}

export async function hasUnmatchedChannelRegistrationForVendorById(vendorId: string): Promise<boolean> {
  return hasUnmatchedChannelRegistrationForVendor(prisma, vendorId);
}

export async function findLatestUnmatchedWebhookEventIdForVendorById(vendorId: string): Promise<string | null> {
  return findLatestUnmatchedWebhookEventIdForVendor(prisma, vendorId);
}
