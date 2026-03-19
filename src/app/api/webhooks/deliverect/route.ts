import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import {
  verifyDeliverectSignature,
  getDeliverectEventId,
  resolveWebhookStatusUpdate,
  flattenDeliverectWebhookPayload,
} from "@/integrations/deliverect/webhook-handler";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import { applyDeliverectStatusWebhook } from "@/services/order-status.service";

/**
 * Webhook HMAC mode (not the same as NODE_ENV on Vercel).
 * - Set `DELIVERECT_ENV=staging` on Vercel when testing Deliverect sandbox while NODE_ENV=production.
 * - Only `DELIVERECT_ENV=production` (case-insensitive) forces partner-secret verification.
 */
function isDeliverectWebhookProduction(): boolean {
  const d = env.DELIVERECT_ENV?.trim();
  if (d !== undefined && d !== "") {
    return d.toLowerCase() === "production";
  }
  return env.NODE_ENV === "production";
}

/** TEMP: identify real HMAC header names Deliverect sends (no secret/signature values). */
function logDeliverectWebhookHeaderDiagnostics(request: NextRequest): void {
  const allHeaderNames = Array.from(request.headers.keys()).sort();
  const signatureRelatedHeaders: Record<string, { length: number } | { empty: true }> = {};
  for (const name of allHeaderNames) {
    if (/hmac|signature|deliverect/i.test(name)) {
      const v = request.headers.get(name);
      if (v == null || v.trim() === "") {
        signatureRelatedHeaders[name] = { empty: true };
      } else {
        signatureRelatedHeaders[name] = { length: v.length };
      }
    }
  }
  console.log("[DELIVERECT WEBHOOK DEBUG]", {
    allHeaderNames,
    signatureRelatedHeaders,
  });
}

function channelLinkIdFromRecord(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;
  const top = obj.channelLinkId;
  if (top != null && String(top).trim() !== "") {
    return String(top).trim();
  }
  const cl = obj.channelLink;
  if (cl && typeof cl === "object" && !Array.isArray(cl)) {
    const id = (cl as Record<string, unknown>).id;
    if (id != null && String(id).trim() !== "") {
      return String(id).trim();
    }
  }
  return null;
}

/** Staging/sandbox: HMAC secret is the channel link id from the webhook JSON. */
function extractChannelLinkIdSecret(parsed: Record<string, unknown>): string | null {
  const candidates: Array<Record<string, unknown> | undefined> = [
    parsed,
    parsed.data as Record<string, unknown> | undefined,
    parsed.order as Record<string, unknown> | undefined,
    parsed.payload as Record<string, unknown> | undefined,
  ];
  for (const obj of candidates) {
    const found = channelLinkIdFromRecord(obj);
    if (found) return found;
  }
  const loc = parsed.location;
  if (loc && typeof loc === "object" && !Array.isArray(loc)) {
    const lid = (loc as Record<string, unknown>).channelLinkId;
    if (lid != null && String(lid).trim() !== "") {
      return String(lid).trim();
    }
  }
  return null;
}

/** TEMP: payload shape only (no values). */
function logDeliverectWebhookPayloadShape(parsed: Record<string, unknown>): void {
  const topLevelKeys = Object.keys(parsed).sort();
  const data = parsed.data;
  const dataKeys =
    data && typeof data === "object" && !Array.isArray(data)
      ? Object.keys(data as Record<string, unknown>).sort()
      : [];
  const order = parsed.order;
  const orderKeys =
    order && typeof order === "object" && !Array.isArray(order)
      ? Object.keys(order as Record<string, unknown>).sort()
      : [];
  console.log("[DELIVERECT WEBHOOK DEBUG]", {
    topLevelKeys,
    dataKeys,
    orderKeys,
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  logDeliverectWebhookHeaderDiagnostics(request);

  const signature =
    request.headers.get("x-server-authorization-hmac-sha256") ??
    request.headers.get("X-Server-Authorization-Hmac-Sha256") ??
    request.headers.get("x-deliverect-hmacsha256") ??
    request.headers.get("X-Deliverect-Hmac-Sha256") ??
    request.headers.get("x-deliverect-signature") ??
    request.headers.get("x-signature") ??
    null;

  let parsed: Record<string, unknown>;
  try {
    const v = JSON.parse(rawBody) as unknown;
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    parsed = v as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  logDeliverectWebhookPayloadShape(parsed);

  const production = isDeliverectWebhookProduction();
  let verificationSecret: string | undefined;
  let channelLinkIdForLog = false;

  if (production) {
    verificationSecret = env.DELIVERECT_WEBHOOK_SECRET?.trim() || undefined;
  } else {
    const ch = extractChannelLinkIdSecret(parsed);
    verificationSecret = ch ?? undefined;
    channelLinkIdForLog = !!ch;
  }

  console.log("[DELIVERECT WEBHOOK VERIFY]", {
    deliverectEnv: env.DELIVERECT_ENV ?? "(unset)",
    nodeEnv: env.NODE_ENV,
    verificationPath: production ? "production_partner_secret" : "staging_channelLinkId",
    note:
      env.DELIVERECT_ENV == null || env.DELIVERECT_ENV.trim() === ""
        ? "DELIVERECT_ENV unset → NODE_ENV decides; set DELIVERECT_ENV=staging on Vercel for sandbox"
        : undefined,
    hasSignatureFromKnownHeaders: Boolean(signature?.trim()),
    secretSource: production ? "env" : "channelLinkId",
    hasEnvSecret: Boolean(env.DELIVERECT_WEBHOOK_SECRET?.trim()),
    hasChannelLinkId: channelLinkIdForLog,
  });

  if (!verificationSecret) {
    return NextResponse.json(
      {
        error: production
          ? "Webhook verification misconfigured: DELIVERECT_WEBHOOK_SECRET is missing"
          : "Webhook verification failed: channelLinkId not found in payload (required for staging/sandbox HMAC)",
      },
      { status: 401 }
    );
  }

  if (
    !verifyDeliverectSignature(rawBody, signature, verificationSecret, {
      nodeEnv: production ? "production" : "development",
      allowUnsignedDev: false,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = parsed as DeliverectWebhookPayload;
  const flat = flattenDeliverectWebhookPayload(payload);
  const eventId = getDeliverectEventId(payload, flat, rawBody);
  const idemKey = webhookIdempotencyKey("deliverect", eventId, rawBody);

  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey: idemKey },
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true, processed: existing.processed });
  }

  const parsedPayload = parsed as object;

  await prisma.webhookEvent.create({
    data: {
      provider: "deliverect",
      eventId: eventId ?? undefined,
      idempotencyKey: idemKey,
      payload: parsedPayload,
    },
  });

  const { internalVendorOrderId, externalOrderId } = resolveWebhookStatusUpdate(payload);

  let vendorOrderId: string | null = null;
  if (internalVendorOrderId) {
    const byId = await prisma.vendorOrder.findUnique({
      where: { id: internalVendorOrderId },
      select: { id: true },
    });
    if (byId) vendorOrderId = byId.id;
  }
  if (!vendorOrderId && externalOrderId) {
    const byExternal = await prisma.vendorOrder.findFirst({
      where: { deliverectOrderId: externalOrderId },
      select: { id: true },
    });
    if (byExternal) vendorOrderId = byExternal.id;
  }

  if (!vendorOrderId) {
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage:
          "match_failed: could not resolve vendor order (channelOrderId / mennyuVendorOrderId or deliverectOrderId)",
      },
    });
    return NextResponse.json({
      received: true,
      resolved: false,
      outcome: "match_failed" as const,
    });
  }

  let applyResult: Awaited<ReturnType<typeof applyDeliverectStatusWebhook>>;
  try {
    applyResult = await applyDeliverectStatusWebhook(vendorOrderId, externalOrderId, payload);
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: { processed: false, errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    resolved: true,
    outcome: applyResult.outcome,
    updatedVendorOrderState: applyResult.updatedVendorOrderState,
  });
}
