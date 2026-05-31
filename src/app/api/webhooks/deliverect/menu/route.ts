/**
 * Deliverect Menu Update webhook → Phase 1B draft ingest only (no publish, no live menu writes).
 *
 * **HMAC:** Same rules as other inbound Deliverect webhooks: default `channel_link` auth uses
 * `channelLinkId` from the payload as the HMAC secret after confirming it matches a known
 * `Vendor.deliverectChannelLinkId`. Legacy `partner_secret` mode uses `DELIVERECT_WEBHOOK_SECRET`.
 *
 * **Idempotency:** `ingestDeliverectMenuImportPhase1b` with `idempotencyKey` derived from
 * {@link webhookIdempotencyKey} (`deliverect_menu` prefix) so retries dedupe on `MenuImportJob`.
 *
 * **Vendor resolution:** `Vendor.deliverectChannelLinkId` must equal the verified channel link id.
 * If no vendor matches after verification, returns **403** (unknown/inactive channel link).
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
} from "@/integrations/deliverect/webhook-handler";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import { extractChannelLinkIdSecret } from "@/integrations/deliverect/webhook-inbound-shared";
import { verifyDeliverectInboundWebhookJson } from "@/integrations/deliverect/deliverect-inbound-webhook-verify";
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

  const verified = await verifyDeliverectInboundWebhookJson(
    request,
    rawBody,
    objectForProcessing
  );
  if (!verified.ok) {
    console.warn("[DELIVERECT MENU WEBHOOK] verification failed", { reason: verified.reason });
    return verified.response;
  }

  const payload = objectForProcessing as DeliverectWebhookPayload;
  const flat = flattenDeliverectWebhookPayload(payload);
  const eventId = getDeliverectEventId(payload, flat, rawBody);
  const idemKey = webhookIdempotencyKey("deliverect_menu", eventId, rawBody);

  const channelLinkId = verified.channelLinkId ?? extractChannelLinkIdSecret(objectForProcessing);
  if (!channelLinkId || !verified.vendorId) {
    return NextResponse.json(
      { error: "Unknown Deliverect channel link", code: "unknown_channel_link" },
      { status: 403 }
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: verified.vendorId },
    select: { id: true, deliverectLocationId: true },
  });

  if (!vendor) {
    return NextResponse.json(
      { error: "Unknown Deliverect channel link", code: "unknown_channel_link" },
      { status: 403 }
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
