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
 *
 * **Payload shape:** In our tenant, Deliverect Menu Push may send a **top-level JSON array** (e.g. `[{...}]`).
 * A single-element array is unwrapped for HMAC secret resolution and Phase 1A; the full parsed value is still
 * stored on `MenuImportRawPayload`. Multiple menus in one request are rejected with a structured 400.
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

type MenuWebhookUnwrapOk = {
  ok: true;
  /** Full JSON.parse result — stored verbatim on `MenuImportRawPayload`. */
  verbatim: unknown;
  /** Object used for channel link / event id / Deliverect meta (unwrap when array length 1). */
  objectForProcessing: Record<string, unknown>;
  /** When set, Phase 1A uses this instead of `verbatim` (top-level array wrapper). */
  normalizationRaw: unknown | undefined;
};

type MenuWebhookUnwrapErr = {
  ok: false;
  status: 400;
  body: Record<string, unknown>;
};

/**
 * Deliverect Menu Push (our tenant): body may be `{...}` or `[{...}]`.
 * Multiple menus in one payload are not supported (no silent pick).
 */
function unwrapSingleMenuWebhookPayload(parsed: unknown): MenuWebhookUnwrapOk | MenuWebhookUnwrapErr {
  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Menu webhook body must be a JSON object or array",
        code: "INVALID_JSON_SHAPE",
      },
    };
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        ok: false,
        status: 400,
        body: {
          error: "Menu webhook body is an empty array",
          code: "EMPTY_MENU_ARRAY",
        },
      };
    }
    if (parsed.length > 1) {
      return {
        ok: false,
        status: 400,
        body: {
          error: "Multiple menus in one webhook payload is not supported yet",
          code: "MULTIPLE_MENUS_NOT_SUPPORTED",
          menuCount: parsed.length,
        },
      };
    }
    const only = parsed[0];
    if (only === null || typeof only !== "object" || Array.isArray(only)) {
      return {
        ok: false,
        status: 400,
        body: {
          error: "Menu webhook array must contain one JSON object",
          code: "INVALID_MENU_ELEMENT",
        },
      };
    }
    return {
      ok: true,
      verbatim: parsed,
      objectForProcessing: only as Record<string, unknown>,
      normalizationRaw: only,
    };
  }

  return {
    ok: true,
    verbatim: parsed,
    objectForProcessing: parsed as Record<string, unknown>,
    normalizationRaw: undefined,
  };
}

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

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody) as unknown;
  } catch {
    // Syntax errors only — tenant uses top-level JSON array for menu push; log raw preview for debugging.
    console.log("[DELIVERECT MENU WEBHOOK RAW]", {
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      rawLength: rawBody.length,
      rawPreview: rawBody.slice(0, 200),
      isBlank: rawBody.trim().length === 0,
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const unwrap = unwrapSingleMenuWebhookPayload(parsedJson);
  if (!unwrap.ok) {
    return NextResponse.json(unwrap.body, { status: unwrap.status });
  }
  const { verbatim, objectForProcessing, normalizationRaw } = unwrap;

  const production = isDeliverectWebhookProduction();
  const { secret: verificationSecret, hasChannelLinkId } = resolveDeliverectWebhookVerificationSecret(
    objectForProcessing,
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

  const payload = objectForProcessing as DeliverectWebhookPayload;
  const flat = flattenDeliverectWebhookPayload(payload);
  const eventId = getDeliverectEventId(payload, flat, rawBody);
  const idemKey = webhookIdempotencyKey("deliverect_menu", eventId, rawBody);

  const channelLinkId = extractChannelLinkIdSecret(objectForProcessing);
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
      rawPayload: verbatim,
      normalizationRaw,
      deliverectMeta: {
        sourcePayloadKind: "deliverect_menu_webhook_v1",
        channelLinkId,
        locationId:
          extractMenuWebhookLocationId(objectForProcessing) ??
          (vendor.deliverectLocationId?.trim() || undefined),
        menuId: extractMenuWebhookMenuId(objectForProcessing),
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
