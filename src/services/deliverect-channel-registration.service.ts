/**
 * Deliverect channel registration webhook: parse payload, resolve vendor by exact keys (email → correlation → account id), assign channel link id.
 */
import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { PosConnectionStatus } from "@prisma/client";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import { flattenDeliverectWebhookPayload } from "@/integrations/deliverect/webhook-handler";
import {
  extractChannelLinkIdSecret,
  nonEmptyStringField,
} from "@/integrations/deliverect/webhook-inbound-shared";

export type ChannelRegistrationExtract = {
  channelLinkId: string | null;
  locationId: string | null;
  accountId: string | null;
  /** Normalized lowercase email for exact DB match */
  email: string | null;
  mennyuCorrelationKey: string | null;
};

/** Merge common Deliverect nesting for registration-style payloads (channel, account, metadata). */
export function flattenChannelRegistrationPayload(parsed: Record<string, unknown>): Record<string, unknown> {
  const base = { ...parsed };
  const nestedSources = [
    base.data,
    base.channel,
    base.channelLink,
    base.registration,
    base.account,
    base.location,
    base.body,
    base.webhook,
    base.payload,
    base.metadata,
  ].filter(
    (x): x is Record<string, unknown> => x != null && typeof x === "object" && !Array.isArray(x)
  );
  const flat: Record<string, unknown> = { ...base };
  for (const src of nestedSources) {
    for (const [k, v] of Object.entries(src)) {
      if (v === undefined) continue;
      if (!(k in flat) || flat[k] === undefined || flat[k] === null) {
        flat[k] = v;
      }
    }
  }
  const loc = base.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const L = loc as Record<string, unknown>;
    for (const [k, v] of Object.entries(L)) {
      if (v === undefined) continue;
      const prefixed = `location_${k}`;
      if (!(prefixed in flat) || flat[prefixed] === undefined || flat[prefixed] === null) {
        flat[prefixed] = v;
      }
    }
  }
  return flat;
}

function normalizeEmail(raw: unknown): string | null {
  const s = nonEmptyStringField(raw);
  if (!s) return null;
  return s.toLowerCase();
}

function readMetadataString(parsed: Record<string, unknown>, key: string): string | null {
  const meta = parsed.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  return nonEmptyStringField((meta as Record<string, unknown>)[key]);
}

/**
 * Best-effort extraction; Deliverect payload shapes vary by product — keep paths explicit and safe.
 */
export function parseChannelRegistrationPayload(parsed: Record<string, unknown>): ChannelRegistrationExtract {
  const mergedFlat = {
    ...flattenDeliverectWebhookPayload(parsed as DeliverectWebhookPayload),
    ...flattenChannelRegistrationPayload(parsed),
  };

  const channelLinkFromSecret = extractChannelLinkIdSecret(parsed);
  const channelLinkId =
    nonEmptyStringField(mergedFlat.channelLinkId) ??
    nonEmptyStringField(mergedFlat.channel_link_id) ??
    channelLinkFromSecret ??
    null;

  const locationId =
    nonEmptyStringField(mergedFlat.locationId) ??
    nonEmptyStringField(mergedFlat.location_id) ??
    nonEmptyStringField(mergedFlat.storeId) ??
    nonEmptyStringField(mergedFlat.store_id) ??
    nonEmptyStringField(mergedFlat.deliverectLocationId) ??
    nonEmptyStringField(mergedFlat.location__id) ??
    null;

  const accountObj =
    parsed.account && typeof parsed.account === "object" && !Array.isArray(parsed.account)
      ? (parsed.account as Record<string, unknown>)
      : null;
  const accountId =
    nonEmptyStringField(mergedFlat.accountId) ??
    nonEmptyStringField(mergedFlat.account_id) ??
    (accountObj ? nonEmptyStringField(accountObj._id) ?? nonEmptyStringField(accountObj.id) : null);

  const email =
    normalizeEmail(mergedFlat.email) ??
    normalizeEmail(mergedFlat.userEmail) ??
    normalizeEmail(mergedFlat.accountEmail) ??
    normalizeEmail(mergedFlat.contactEmail) ??
    normalizeEmail(readMetadataString(parsed, "email")) ??
    normalizeEmail(readMetadataString(parsed, "accountEmail"));

  const mennyuCorrelationKey =
    nonEmptyStringField(mergedFlat.mennyuCorrelationKey) ??
    nonEmptyStringField(mergedFlat.mennyu_connection_key) ??
    nonEmptyStringField(mergedFlat.pendingDeliverectConnectionKey) ??
    nonEmptyStringField(mergedFlat.externalReference) ??
    nonEmptyStringField(mergedFlat.correlationKey) ??
    readMetadataString(parsed, "mennyuCorrelationKey") ??
    readMetadataString(parsed, "mennyu_connection_key");

  return {
    channelLinkId,
    locationId,
    accountId,
    email,
    mennyuCorrelationKey,
  };
}

export function getDeliverectChannelRegistrationEventId(
  parsed: Record<string, unknown>,
  flat: Record<string, unknown>,
  rawBody: string
): string {
  const messageKeys = [
    "webhookId",
    "webhook_id",
    "eventId",
    "event_id",
    "uuid",
    "eventUUID",
    "messageId",
    "message_id",
    "correlationId",
    "id",
  ] as const;
  for (const k of messageKeys) {
    const v = flat[k] ?? parsed[k];
    if (v != null && String(v).trim()) {
      return `deliverect:chreg:msg:${String(v).trim()}`;
    }
  }
  const ch = extractChannelLinkIdSecret(parsed);
  if (ch) return `deliverect:chreg:ch:${ch}`;
  return `deliverect:chreg:body:${createHash("sha256").update(rawBody, "utf8").digest("hex").slice(0, 32)}`;
}

export type VendorMatchResult =
  | { kind: "single"; vendorId: string }
  | { kind: "none" }
  | { kind: "ambiguous"; vendorIds: string[] };

/**
 * Exact matching only, ordered: email (onboarding) → pending correlation key → Deliverect account id.
 */
export async function findVendorForChannelRegistration(
  db: PrismaClient,
  extract: ChannelRegistrationExtract
): Promise<VendorMatchResult> {
  const { email, mennyuCorrelationKey, accountId } = extract;

  const awaitingOnly = {
    OR: [
      { posConnectionStatus: PosConnectionStatus.onboarding },
      { pendingDeliverectConnectionKey: { not: null } },
    ],
  };

  if (email) {
    const rows = await db.vendor.findMany({
      where: {
        deliverectChannelLinkId: null,
        deliverectAccountEmail: email,
        ...awaitingOnly,
      },
      select: { id: true },
    });
    if (rows.length === 1) return { kind: "single", vendorId: rows[0].id };
    if (rows.length > 1) return { kind: "ambiguous", vendorIds: rows.map((r) => r.id) };
  }

  if (mennyuCorrelationKey) {
    const rows = await db.vendor.findMany({
      where: {
        deliverectChannelLinkId: null,
        pendingDeliverectConnectionKey: mennyuCorrelationKey,
      },
      select: { id: true },
    });
    if (rows.length === 1) return { kind: "single", vendorId: rows[0].id };
    if (rows.length > 1) return { kind: "ambiguous", vendorIds: rows.map((r) => r.id) };
  }

  if (accountId) {
    const rows = await db.vendor.findMany({
      where: {
        deliverectChannelLinkId: null,
        deliverectAccountId: accountId,
        ...awaitingOnly,
      },
      select: { id: true },
    });
    if (rows.length === 1) return { kind: "single", vendorId: rows[0].id };
    if (rows.length > 1) return { kind: "ambiguous", vendorIds: rows.map((r) => r.id) };
  }

  return { kind: "none" };
}

export type ApplyChannelRegistrationResult =
  | { outcome: "success"; vendorId: string; channelLinkId: string }
  | { outcome: "already_connected"; vendorId: string; channelLinkId: string }
  | { outcome: "channel_link_conflict"; vendorId: string; existingChannelLinkId: string; incomingChannelLinkId: string }
  | { outcome: "error"; message: string };

const AUTO_MAP_OUTCOMES = {
  success: "success",
  already_connected: "already_connected",
  channel_link_conflict: "channel_link_conflict",
} as const;

export async function applyChannelRegistrationToVendor(
  db: PrismaClient,
  vendorId: string,
  extract: ChannelRegistrationExtract
): Promise<ApplyChannelRegistrationResult> {
  const { channelLinkId, locationId, accountId } = extract;
  if (!channelLinkId) {
    return { outcome: "error", message: "missing_channel_link_id" };
  }

  const vendor = await db.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      deliverectChannelLinkId: true,
    },
  });
  if (!vendor) {
    return { outcome: "error", message: "vendor_not_found" };
  }

  const existing = vendor.deliverectChannelLinkId?.trim() ?? null;
  if (existing) {
    if (existing === channelLinkId) {
      await db.vendor.update({
        where: { id: vendorId },
        data: {
          posConnectionStatus: PosConnectionStatus.connected,
          pendingDeliverectConnectionKey: null,
          deliverectAutoMapLastAt: new Date(),
          deliverectAutoMapLastOutcome: AUTO_MAP_OUTCOMES.already_connected,
          deliverectAutoMapLastDetail: null,
          ...(locationId ? { deliverectLocationId: locationId } : {}),
          ...(accountId ? { deliverectAccountId: accountId } : {}),
        },
      });
      return { outcome: "already_connected", vendorId, channelLinkId };
    }
    await db.vendor.update({
      where: { id: vendorId },
      data: {
        posConnectionStatus: PosConnectionStatus.error,
        deliverectAutoMapLastAt: new Date(),
        deliverectAutoMapLastOutcome: AUTO_MAP_OUTCOMES.channel_link_conflict,
        deliverectAutoMapLastDetail: `existing=${existing} incoming=${channelLinkId}`,
      },
    });
    return {
      outcome: "channel_link_conflict",
      vendorId,
      existingChannelLinkId: existing,
      incomingChannelLinkId: channelLinkId,
    };
  }

  await db.vendor.update({
    where: { id: vendorId },
    data: {
      deliverectChannelLinkId: channelLinkId,
      ...(locationId ? { deliverectLocationId: locationId } : {}),
      ...(accountId ? { deliverectAccountId: accountId } : {}),
      posConnectionStatus: PosConnectionStatus.connected,
      pendingDeliverectConnectionKey: null,
      deliverectAutoMapLastAt: new Date(),
      deliverectAutoMapLastOutcome: AUTO_MAP_OUTCOMES.success,
      deliverectAutoMapLastDetail: null,
    },
  });

  return { outcome: "success", vendorId, channelLinkId };
}

/** Pure helper for tests: same sequential rules as findVendorForChannelRegistration (email → key → account). */
export function resolveSequentialVendorMatch(
  emailRows: { id: string }[],
  keyRows: { id: string }[],
  accountRows: { id: string }[]
): VendorMatchResult {
  if (emailRows.length === 1) return { kind: "single", vendorId: emailRows[0].id };
  if (emailRows.length > 1) return { kind: "ambiguous", vendorIds: emailRows.map((r) => r.id) };

  if (keyRows.length === 1) return { kind: "single", vendorId: keyRows[0].id };
  if (keyRows.length > 1) return { kind: "ambiguous", vendorIds: keyRows.map((r) => r.id) };

  if (accountRows.length === 1) return { kind: "single", vendorId: accountRows[0].id };
  if (accountRows.length > 1) return { kind: "ambiguous", vendorIds: accountRows.map((r) => r.id) };

  return { kind: "none" };
}
