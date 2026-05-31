/**
 * Shared HMAC verification for Deliverect → Mennyu inbound webhooks.
 *
 * Default auth mode (`channel_link`): HMAC secret is the channelLinkId from the payload,
 * but only after the id matches a known Vendor.deliverectChannelLinkId (except channel-registration).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyDeliverectSignature } from "@/integrations/deliverect/webhook-handler";
import {
  extractChannelLinkIdSecret,
  getDeliverectSignatureFromRequest,
  getDeliverectWebhookAuthMode,
  parseDeliverectWebhookJsonObject,
} from "@/integrations/deliverect/webhook-inbound-shared";
import { enrichPrepTimePayloadForWebhookVerification } from "@/services/deliverect-prep-time-webhook.service";
import { getKnownDeliverectChannelLink } from "@/services/deliverect-known-channel-link.service";
import { env } from "@/lib/env";

export type DeliverectWebhookVerifyOptions = {
  /**
   * When true (default), channelLinkId must match Vendor.deliverectChannelLinkId.
   * Set false for channel-registration webhooks (link id is assigned before it is stored).
   */
  requireKnownChannelLink?: boolean;
};

export type DeliverectWebhookVerifyFailureReason =
  | "invalid_json"
  | "missing_signature"
  | "missing_channel_link_id"
  | "unknown_channel_link"
  | "inactive_channel_link"
  | "misconfigured"
  | "bad_signature";

export type DeliverectWebhookVerifySuccess = {
  ok: true;
  parsed: Record<string, unknown>;
  authMode: "channel_link" | "partner_secret";
  channelLinkId: string | null;
  vendorId?: string;
};

export type DeliverectWebhookVerifyResult =
  | DeliverectWebhookVerifySuccess
  | { ok: false; response: NextResponse; reason: DeliverectWebhookVerifyFailureReason };

function verifyFailureResponse(
  reason: DeliverectWebhookVerifyFailureReason,
  message: string,
  status: 401 | 403
): { ok: false; response: NextResponse; reason: DeliverectWebhookVerifyFailureReason } {
  return {
    ok: false,
    response: NextResponse.json({ error: message, code: reason }, { status }),
    reason,
  };
}

async function resolveChannelLinkIdForVerification(
  parsed: Record<string, unknown>
): Promise<string | null> {
  const direct = extractChannelLinkIdSecret(parsed);
  if (direct) return direct;
  const enriched = await enrichPrepTimePayloadForWebhookVerification(parsed);
  return extractChannelLinkIdSecret(enriched);
}

/**
 * Verify HMAC on `rawBody` (unchanged). Parses JSON when `parsedForSecret` is omitted.
 */
export async function verifyDeliverectInboundWebhookJson(
  request: NextRequest,
  rawBody: string,
  parsedForSecret?: Record<string, unknown>,
  options?: DeliverectWebhookVerifyOptions
): Promise<DeliverectWebhookVerifyResult> {
  const requireKnownChannelLink = options?.requireKnownChannelLink ?? true;

  let parsed: Record<string, unknown>;
  if (parsedForSecret) {
    parsed = parsedForSecret;
  } else {
    const parsedResult = parseDeliverectWebhookJsonObject(rawBody);
    if (!parsedResult.ok) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
        reason: "invalid_json" as const,
      };
    }
    parsed = parsedResult.parsed;
  }

  const signature = getDeliverectSignatureFromRequest(request);
  if (!signature?.trim()) {
    return verifyFailureResponse("missing_signature", "Missing webhook signature", 401);
  }

  const authMode = getDeliverectWebhookAuthMode();

  if (authMode === "partner_secret") {
    const secret = env.DELIVERECT_WEBHOOK_SECRET?.trim();
    if (!secret) {
      return verifyFailureResponse(
        "misconfigured",
        "Webhook verification misconfigured: DELIVERECT_WEBHOOK_SECRET is missing (partner_secret mode)",
        401
      );
    }
    const sigOk = verifyDeliverectSignature(rawBody, signature, secret, {
      nodeEnv: "production",
      allowUnsignedDev: false,
    });
    if (!sigOk) {
      return verifyFailureResponse("bad_signature", "Invalid signature", 401);
    }
    const channelLinkId = await resolveChannelLinkIdForVerification(parsed);
    return {
      ok: true,
      parsed,
      authMode: "partner_secret",
      channelLinkId,
    };
  }

  const channelLinkId = await resolveChannelLinkIdForVerification(parsed);
  if (!channelLinkId) {
    return verifyFailureResponse(
      "missing_channel_link_id",
      "Webhook verification failed: channelLinkId not found in payload",
      401
    );
  }

  if (requireKnownChannelLink) {
    const known = await getKnownDeliverectChannelLink(channelLinkId);
    if (!known) {
      return verifyFailureResponse(
        "unknown_channel_link",
        "Unknown Deliverect channel link",
        403
      );
    }
    if (!known.isActive) {
      return verifyFailureResponse(
        "inactive_channel_link",
        "Deliverect channel link is inactive",
        403
      );
    }

    const sigOk = verifyDeliverectSignature(rawBody, signature, known.channelLinkId, {
      nodeEnv: "production",
      allowUnsignedDev: false,
    });
    if (!sigOk) {
      return verifyFailureResponse("bad_signature", "Invalid signature", 401);
    }

    return {
      ok: true,
      parsed,
      authMode: "channel_link",
      channelLinkId: known.channelLinkId,
      vendorId: known.vendorId,
    };
  }

  // Channel-registration: HMAC uses the new channelLinkId from Deliverect before we store it.
  const sigOk = verifyDeliverectSignature(rawBody, signature, channelLinkId, {
    nodeEnv: "production",
    allowUnsignedDev: false,
  });
  if (!sigOk) {
    return verifyFailureResponse("bad_signature", "Invalid signature", 401);
  }

  return {
    ok: true,
    parsed,
    authMode: "channel_link",
    channelLinkId,
  };
}

/** Alias for readability in route handlers. */
export const verifyDeliverectWebhookRequest = verifyDeliverectInboundWebhookJson;
