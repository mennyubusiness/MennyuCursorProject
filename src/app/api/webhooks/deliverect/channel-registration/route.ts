import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { DeliverectWebhookPayload } from "@/integrations/deliverect/payloads";
import { logDeliverectChannelRegistration } from "@/integrations/deliverect/deliverect-channel-registration-log";
import {
  getDeliverectSignatureFromRequest,
  isDeliverectWebhookProduction,
  parseDeliverectWebhookJsonObject,
  resolveDeliverectWebhookVerificationSecret,
} from "@/integrations/deliverect/webhook-inbound-shared";
import {
  flattenDeliverectWebhookPayload,
  verifyDeliverectSignature,
} from "@/integrations/deliverect/webhook-handler";
import {
  applyChannelRegistrationToVendor,
  findVendorForChannelRegistration,
  flattenChannelRegistrationPayload,
  formatChannelRegistrationNoMatchDetail,
  getDeliverectChannelRegistrationEventId,
  parseChannelRegistrationPayload,
  summarizeChannelRegistrationPayload,
} from "@/services/deliverect-channel-registration.service";
import { prisma } from "@/lib/db";
import { webhookIdempotencyKey } from "@/lib/idempotency";
import { persistDeliverectOrderWebhookRejection } from "../verification-audit";
import {
  buildDeliverectChannelRegistrationResponseBody,
  resolveDeliverectPublicOrigin,
} from "@/integrations/deliverect/deliverect-channel-registration-response";

function bodyShaPrefix(rawBody: string, n = 12): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex").slice(0, n);
}

/**
 * Deliverect expects the registration response body to list callback URLs (see Deliverect channel registration docs).
 * Mennyu internal outcomes are exposed only via the `X-Mennyu-Channel-Registration-Outcome` header for observability.
 */
function deliverectRegistrationContractResponse(
  request: NextRequest,
  outcome: string,
  status = 200
) {
  const origin = resolveDeliverectPublicOrigin(request);
  const body = buildDeliverectChannelRegistrationResponseBody(origin);
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Mennyu-Channel-Registration-Outcome": outcome,
    },
  });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = getDeliverectSignatureFromRequest(request);

  const parsedResult = parseDeliverectWebhookJsonObject(rawBody);
  if (!parsedResult.ok) {
    logDeliverectChannelRegistration("invalid_json", {
      bodyLength: rawBody.length,
      bodySha256Prefix: bodyShaPrefix(rawBody),
    });
    await persistDeliverectOrderWebhookRejection(rawBody, "invalid_json");
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parsedResult.parsed;

  const production = isDeliverectWebhookProduction();
  const { secret: verificationSecret } = resolveDeliverectWebhookVerificationSecret(parsed, production);

  if (!verificationSecret) {
    logDeliverectChannelRegistration("verification_failed", {
      reason: "missing_verification_secret",
      production,
      bodySha256Prefix: bodyShaPrefix(rawBody),
    });
    await persistDeliverectOrderWebhookRejection(rawBody, "missing_verification_secret");
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
    logDeliverectChannelRegistration("verification_failed", {
      reason: "bad_signature",
      production,
      hasSignature: Boolean(signature?.trim()),
      bodySha256Prefix: bodyShaPrefix(rawBody),
    });
    await persistDeliverectOrderWebhookRejection(rawBody, "bad_signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const flat = {
    ...flattenDeliverectWebhookPayload(parsed as DeliverectWebhookPayload),
    ...flattenChannelRegistrationPayload(parsed),
  };
  const eventId = getDeliverectChannelRegistrationEventId(parsed, flat, rawBody);
  const idemKey = webhookIdempotencyKey("deliverect_chreg", eventId, rawBody);

  const existing = await prisma.webhookEvent.findUnique({
    where: { idempotencyKey: idemKey },
  });
  if (existing) {
    logDeliverectChannelRegistration("duplicate_ignored", {
      idempotencyKey: idemKey,
      eventId: eventId ?? existing.eventId ?? null,
      processed: existing.processed,
      existingError: existing.errorMessage ?? null,
    });
    return deliverectRegistrationContractResponse(request, "duplicate");
  }

  await prisma.webhookEvent.create({
    data: {
      provider: "deliverect_channel_registration",
      eventId,
      idempotencyKey: idemKey,
      payload: parsed as object,
    },
  });

  const extract = parseChannelRegistrationPayload(parsed);

  if (!extract.channelLinkId) {
    logDeliverectChannelRegistration("missing_channel_link_id", {
      eventId,
      idempotencyKey: idemKey,
      bodySha256Prefix: bodyShaPrefix(rawBody),
    });
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage: "missing_channel_link_id",
      },
    });
    /** 200 + Deliverect URL contract so Deliverect can persist callbacks; matching failed internally. */
    return deliverectRegistrationContractResponse(request, "missing_channel_link_id", 200);
  }

  const match = await findVendorForChannelRegistration(prisma, extract);

  if (match.kind === "ambiguous") {
    logDeliverectChannelRegistration("ambiguous", {
      eventId,
      idempotencyKey: idemKey,
      vendorIds: match.vendorIds,
      channelLinkId: extract.channelLinkId,
    });
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage: `ambiguous:${match.vendorIds.join(",")}`,
      },
    });
    return deliverectRegistrationContractResponse(request, `ambiguous:${match.vendorIds.join(",")}`);
  }

  if (match.kind === "none") {
    const summary = summarizeChannelRegistrationPayload(parsed, extract);
    const noMatchDetail = formatChannelRegistrationNoMatchDetail(summary);
    logDeliverectChannelRegistration("no_match", {
      eventId,
      idempotencyKey: idemKey,
      receivedAt: new Date().toISOString(),
      payloadTopLevelKeys: summary.payloadTopLevelKeys,
      channelLinkId: extract.channelLinkId,
      channelLocationId: extract.channelLocationId,
      deliverectPortalLocationId: extract.deliverectPortalLocationId,
      status: extract.status,
      channelLinkName: extract.channelLinkName,
      hadEmail: Boolean(extract.email),
      hadCorrelationKey: Boolean(extract.mennyuCorrelationKey),
      hadAccountId: Boolean(extract.accountId),
      note:
        "Deliverect channel-registration payloads (see docs) include channelLinkId, channelLocationId, locationId, status — not email. Mennyu matches channelLocationId to Vendor.id (Mennyu Location ID), or portal locationId to Vendor.deliverectLocationId when onboarding.",
    });
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage: noMatchDetail,
      },
    });
    return deliverectRegistrationContractResponse(request, "no_match");
  }

  const applied = await applyChannelRegistrationToVendor(prisma, match.vendorId, extract);

  if (applied.outcome === "error") {
    logDeliverectChannelRegistration("apply_error", {
      eventId,
      idempotencyKey: idemKey,
      vendorId: match.vendorId,
      message: applied.message,
    });
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: false,
        errorMessage: applied.message,
      },
    });
    return NextResponse.json({ error: applied.message }, { status: 500 });
  }

  if (applied.outcome === "channel_link_conflict") {
    logDeliverectChannelRegistration("channel_link_conflict", {
      eventId,
      idempotencyKey: idemKey,
      vendorId: applied.vendorId,
      existingChannelLinkId: applied.existingChannelLinkId,
      incomingChannelLinkId: applied.incomingChannelLinkId,
    });
    await prisma.webhookEvent.updateMany({
      where: { idempotencyKey: idemKey },
      data: {
        processed: true,
        processedAt: new Date(),
        errorMessage: `channel_link_conflict:${applied.existingChannelLinkId}`,
      },
    });
    return deliverectRegistrationContractResponse(request, "channel_link_conflict");
  }

  logDeliverectChannelRegistration(applied.outcome === "already_connected" ? "already_connected" : "matched", {
    eventId,
    idempotencyKey: idemKey,
    vendorId: applied.vendorId,
    channelLinkId: applied.channelLinkId,
  });

  await prisma.webhookEvent.updateMany({
    where: { idempotencyKey: idemKey },
    data: {
      processed: true,
      processedAt: new Date(),
      errorMessage: null,
    },
  });

  return deliverectRegistrationContractResponse(request, applied.outcome);
}
