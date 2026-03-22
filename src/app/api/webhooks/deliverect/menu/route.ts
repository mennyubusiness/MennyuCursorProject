/**
 * Deliverect Menu Update webhook → Phase 1B draft ingest only (no publish, no live menu writes).
 *
 * **HMAC:** Same rules as order-status webhook (`/api/webhooks/deliverect`): production uses
 * `DELIVERECT_WEBHOOK_SECRET`; staging/sandbox uses channel link id from JSON as key.
 *
 * **Idempotency:** `ingestDeliverectMenuImportPhase1b` with `idempotencyKey` derived from
 * {@link webhookIdempotencyKey} (`deliverect_menu` prefix) so retries dedupe on `MenuImportJob`.
 *
 * **Vendor resolution:** `Vendor.deliverectChannelLinkId` must equal the channel link id used as HMAC secret
 * in staging (and typically present in payload). If no vendor matches, returns **200** with
 * `outcome: "vendor_not_found"` to avoid pointless retries when misconfigured.
 */
import { NextRequest, NextResponse } from "next/server";
import { MenuImportSource } from "@prisma/client";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import {
  extractMenuWebhookLocationId,
  extractMenuWebhookMenuId,
} from "@/integrations/deliverect/menu-webhook-payload";
import {
  getDeliverectEventId,
  flattenDeliverectWebhookPayload,
  verifyDeliverectSignature,
} from "@/integrations/deliverect/webhook-handler";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import {
  extractChannelLinkIdSecret,
  getDeliverectSignatureFromRequest,
  isDeliverectWebhookProduction,
  parseDeliverectWebhookJsonObject,
  resolveDeliverectWebhookVerificationSecret,
} from "@/integrations/deliverect/webhook-inbound-shared";
import { env } from "@/lib/env";
import { ingestDeliverectMenuImportPhase1b } from "@/services/menu-import-phase1b.service";

function logDeliverectMenuWebhookHeaderDiagnostics(request: NextRequest): void {
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
  console.log("[DELIVERECT MENU WEBHOOK DEBUG]", {
    allHeaderNames,
    signatureRelatedHeaders,
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  logDeliverectMenuWebhookHeaderDiagnostics(request);

  const signature = getDeliverectSignatureFromRequest(request);
  const parsedResult = parseDeliverectWebhookJsonObject(rawBody);
  if (!parsedResult.ok) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parsedResult.parsed;

  const production = isDeliverectWebhookProduction();
  const { secret: verificationSecret, hasChannelLinkId } = resolveDeliverectWebhookVerificationSecret(
    parsed,
    production
  );

  console.log("[DELIVERECT MENU WEBHOOK VERIFY]", {
    deliverectEnv: env.DELIVERECT_ENV ?? "(unset)",
    nodeEnv: env.NODE_ENV,
    verificationPath: production ? "production_partner_secret" : "staging_channelLinkId",
    hasSignatureFromKnownHeaders: Boolean(signature?.trim()),
    hasChannelLinkId,
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
  const idemKey = webhookIdempotencyKey("deliverect_menu", eventId, rawBody);

  const channelLinkId = extractChannelLinkIdSecret(parsed);
  if (!channelLinkId) {
    return NextResponse.json(
      { received: true, outcome: "missing_channel_link_id" as const },
      { status: 200 }
    );
  }

  const vendor = await prisma.vendor.findFirst({
    where: { deliverectChannelLinkId: channelLinkId },
    select: { id: true, deliverectLocationId: true },
  });

  if (!vendor) {
    console.warn("[DELIVERECT MENU WEBHOOK] No vendor for channelLinkId (configure Vendor.deliverectChannelLinkId)");
    return NextResponse.json(
      {
        received: true,
        outcome: "vendor_not_found" as const,
        channelLinkId,
      },
      { status: 200 }
    );
  }

  try {
    const ingestResult = await ingestDeliverectMenuImportPhase1b({
      vendorId: vendor.id,
      source: MenuImportSource.DELIVERECT_MENU_WEBHOOK,
      rawPayload: parsed,
      deliverectMeta: {
        sourcePayloadKind: "deliverect_menu_webhook_v1",
        channelLinkId,
        locationId:
          extractMenuWebhookLocationId(parsed) ?? (vendor.deliverectLocationId?.trim() || undefined),
        menuId: extractMenuWebhookMenuId(parsed),
      },
      idempotencyKey: idemKey,
    });

    return NextResponse.json({
      received: true,
      outcome: "ingested" as const,
      jobId: ingestResult.jobId,
      draftVersionId: ingestResult.draftVersionId,
      jobStatus: ingestResult.jobStatus,
      issueCount: ingestResult.issueCount,
      ok: ingestResult.ok,
      deduped: ingestResult.deduped,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[DELIVERECT MENU WEBHOOK] ingest failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
