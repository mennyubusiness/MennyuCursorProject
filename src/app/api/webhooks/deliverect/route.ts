import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { agentDebugDeliverect, redactIdTail } from "@/lib/agent-debug-deliverect";
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
import {
  extractChannelLinkIdSecret,
  getDeliverectSignatureFromRequest,
  isDeliverectWebhookProduction,
  parseDeliverectWebhookJsonObject,
  resolveDeliverectWebhookVerificationSecret,
} from "@/integrations/deliverect/webhook-inbound-shared";

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

/** TEMP: channelLink / location structure only (no values). */
function logDeliverectWebhookChannelLinkShape(parsed: Record<string, unknown>): void {
  const cl = parsed.channelLink;
  const channelLinkType =
    cl === null ? "null" : Array.isArray(cl) ? "array" : typeof cl;
  const channelLinkKeys =
    cl !== null && typeof cl === "object" && !Array.isArray(cl)
      ? Object.keys(cl as Record<string, unknown>).sort()
      : [];

  const loc = parsed.location;
  const locationType =
    loc === null ? "null" : Array.isArray(loc) ? "array" : typeof loc;
  const locationKeys =
    loc !== null && typeof loc === "object" && !Array.isArray(loc)
      ? Object.keys(loc as Record<string, unknown>).sort()
      : [];

  console.log("[DELIVERECT WEBHOOK CHANNELLINK SHAPE]", {
    channelLinkType,
    channelLinkKeys,
    locationType,
    locationKeys,
  });
}

export async function POST(request: NextRequest) {
  const webhookRunId = crypto.randomUUID();
  const dbg = (args: {
    hypothesisId: string;
    message: string;
    data?: Record<string, unknown>;
  }) =>
    agentDebugDeliverect({
      ...args,
      data: { webhookRunId, ...args.data },
    });

  try {
    const rawBody = await request.text();
    // #region agent log
    dbg({
      hypothesisId: "H_webhook_inbound",
      message: "webhook_POST_received",
      data: {
        path: request.nextUrl.pathname,
        rawBodyBytes: rawBody.length,
        contentType: request.headers.get("content-type")?.slice(0, 64) ?? null,
      },
    });
    // #endregion
    logDeliverectWebhookHeaderDiagnostics(request);

    const signature = getDeliverectSignatureFromRequest(request);

    const parsedResult = parseDeliverectWebhookJsonObject(rawBody);
    if (!parsedResult.ok) {
      dbg({
        hypothesisId: "H_webhook_parse",
        message: "webhook_invalid_json",
        data: { rawBodyBytes: rawBody.length },
      });
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = parsedResult.parsed;

    // #region agent log
    dbg({
      hypothesisId: "H_webhook_pipeline",
      message: "webhook_json_parsed_ok",
      data: {
        hasChannelLinkCandidate: Boolean(extractChannelLinkIdSecret(parsed)),
        topLevelKeyCount: Object.keys(parsed).length,
      },
    });
    // #endregion

    logDeliverectWebhookPayloadShape(parsed);
    logDeliverectWebhookChannelLinkShape(parsed);

    const production = isDeliverectWebhookProduction();
    const { secret: verificationSecret, hasChannelLinkId: channelLinkIdForLog } =
      resolveDeliverectWebhookVerificationSecret(parsed, production);

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
      dbg({
        hypothesisId: "H_webhook_verify",
        message: "webhook_no_verification_secret",
        data: {
          production,
          hasChannelLinkId: channelLinkIdForLog,
        },
      });
      return NextResponse.json(
        {
          error: production
            ? "Webhook verification misconfigured: DELIVERECT_WEBHOOK_SECRET is missing"
            : "Webhook verification failed: channelLinkId not found in payload (required for staging/sandbox HMAC)",
        },
        { status: 401 }
      );
    }

    const sigOk = verifyDeliverectSignature(rawBody, signature, verificationSecret, {
      nodeEnv: production ? "production" : "development",
      allowUnsignedDev: false,
    });
    if (!sigOk) {
      dbg({
        hypothesisId: "H_webhook_verify",
        message: "webhook_hmac_invalid",
        data: {
          production,
          hasSignatureHeader: Boolean(signature?.trim()),
          channelLinkTail: redactIdTail(extractChannelLinkIdSecret(parsed) ?? undefined),
        },
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    dbg({
      hypothesisId: "H_webhook_verify",
      message: "webhook_hmac_ok",
      data: { production },
    });

    const payload = parsed as DeliverectWebhookPayload;
    const flat = flattenDeliverectWebhookPayload(payload);
    const eventId = getDeliverectEventId(payload, flat, rawBody);
    const idemKey = webhookIdempotencyKey("deliverect", eventId, rawBody);

    const existing = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey: idemKey },
    });
    if (existing) {
      dbg({
        hypothesisId: "H_webhook_idempotency",
        message: "webhook_duplicate_event",
        data: { processed: existing.processed, idempotencyKeyLen: idemKey.length },
      });
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

    dbg({
      hypothesisId: "H_webhook_match",
      message: "webhook_resolve_vendor_order",
      data: {
        hasInternalId: Boolean(internalVendorOrderId),
        hasExternalId: Boolean(externalOrderId),
        resolved: Boolean(vendorOrderId),
        externalIdLen: externalOrderId?.length ?? 0,
      },
    });

    if (!vendorOrderId) {
      dbg({
        hypothesisId: "H_webhook_match",
        message: "webhook_match_failed",
        data: {
          internalVendorOrderIdPresent: Boolean(internalVendorOrderId),
          externalOrderIdPresent: Boolean(externalOrderId),
        },
      });
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
      dbg({
        hypothesisId: "H_webhook_apply",
        message: "webhook_apply_success",
        data: {
          vendorOrderId,
          outcome: applyResult.outcome,
          updatedVendorOrderState: applyResult.updatedVendorOrderState,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dbg({
        hypothesisId: "H_webhook_apply",
        message: "webhook_apply_threw",
        data: { vendorOrderId, error: message.slice(0, 200) },
      });
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
  } catch (err) {
    // #region agent log
    dbg({
      hypothesisId: "H_webhook_uncaught",
      message: "webhook_handler_threw",
      data: {
        error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      },
    });
    // #endregion
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
