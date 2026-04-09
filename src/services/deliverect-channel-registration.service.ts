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
  /** Deliverect request field `locationId` — id of the location in the Deliverect portal (not necessarily Mennyu’s field name). */
  deliverectPortalLocationId: string | null;
  /**
   * Deliverect request field `channelLocationId` — unique id of the merchant in the *channel* platform.
   * When the channel is Mennyu, this should be the Mennyu `Vendor.id` (see Mennyu Location ID in vendor UI).
   */
  channelLocationId: string | null;
  /** Deliverect `status`: register | active | inactive */
  status: string | null;
  channelLinkName: string | null;
  accountId: string | null;
  /** Normalized lowercase email for exact DB match */
  email: string | null;
  mennyuCorrelationKey: string | null;
};

/** Shallow summary for logs and WebhookEvent rows (no fuzzy logic). */
export function summarizeChannelRegistrationPayload(
  parsed: Record<string, unknown>,
  extract: ChannelRegistrationExtract
): {
  payloadTopLevelKeys: string[];
  extract: ChannelRegistrationExtract;
} {
  return {
    payloadTopLevelKeys: Object.keys(parsed).sort(),
    extract,
  };
}

export function formatChannelRegistrationNoMatchDetail(summary: {
  payloadTopLevelKeys: string[];
  extract: ChannelRegistrationExtract;
}): string {
  const e = summary.extract;
  const parts = [
    "no_match",
    `keys=${summary.payloadTopLevelKeys.join(",")}`,
    `status=${e.status ?? ""}`,
    `channelLinkId=${e.channelLinkId ?? ""}`,
    `channelLocationId=${e.channelLocationId ?? ""}`,
    `portalLocationId=${e.deliverectPortalLocationId ?? ""}`,
    `channelLinkName=${e.channelLinkName ?? ""}`,
    `email=${e.email ? "[set]" : ""}`,
    `corr=${e.mennyuCorrelationKey ? "[set]" : ""}`,
    `accountId=${e.accountId ?? ""}`,
  ];
  return parts.join("|").slice(0, 2000);
}

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

  /** Deliverect channel-registration webhook: `locationId` in portal; also accept common aliases. */
  const deliverectPortalLocationId =
    nonEmptyStringField(mergedFlat.locationId) ??
    nonEmptyStringField(mergedFlat.location_id) ??
    nonEmptyStringField(mergedFlat.deliverectLocationId) ??
    nonEmptyStringField(mergedFlat.storeId) ??
    nonEmptyStringField(mergedFlat.store_id) ??
    nonEmptyStringField(mergedFlat.location__id) ??
    null;

  /** Deliverect channel-registration: external merchant id (use Mennyu Vendor.id when Mennyu is the channel). */
  const channelLocationId =
    nonEmptyStringField(mergedFlat.channelLocationId) ??
    nonEmptyStringField(mergedFlat.channel_location_id) ??
    null;

  const status = nonEmptyStringField(mergedFlat.status);
  const channelLinkName = nonEmptyStringField(mergedFlat.channelLinkName) ?? nonEmptyStringField(mergedFlat.channel_link_name);

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
    deliverectPortalLocationId,
    channelLocationId,
    status,
    channelLinkName,
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
 * Exact matching only. Order:
 * 1) email (onboarding) 2) pending correlation key 3) Deliverect `channelLocationId` === Mennyu Vendor.id
 * 4) Deliverect portal `locationId` === Vendor.deliverectLocationId 5) Deliverect account id
 */
export async function findVendorForChannelRegistration(
  db: PrismaClient,
  extract: ChannelRegistrationExtract
): Promise<VendorMatchResult> {
  const { email, mennyuCorrelationKey, accountId, channelLocationId, deliverectPortalLocationId } = extract;

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

  if (channelLocationId) {
    const row = await db.vendor.findFirst({
      where: {
        id: channelLocationId,
        deliverectChannelLinkId: null,
      },
      select: { id: true },
    });
    if (row) return { kind: "single", vendorId: row.id };
  }

  if (deliverectPortalLocationId) {
    const rows = await db.vendor.findMany({
      where: {
        deliverectChannelLinkId: null,
        deliverectLocationId: deliverectPortalLocationId,
        ...awaitingOnly,
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
  const { channelLinkId, deliverectPortalLocationId, accountId } = extract;
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
          ...(deliverectPortalLocationId ? { deliverectLocationId: deliverectPortalLocationId } : {}),
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
      ...(deliverectPortalLocationId ? { deliverectLocationId: deliverectPortalLocationId } : {}),
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
