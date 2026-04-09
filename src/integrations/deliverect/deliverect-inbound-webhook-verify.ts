/**
 * Shared HMAC verification for Deliverect → Mennyu inbound webhooks (same rules as order/menu/snooze).
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyDeliverectSignature } from "@/integrations/deliverect/webhook-handler";
import {
  getDeliverectSignatureFromRequest,
  isDeliverectWebhookProduction,
  parseDeliverectWebhookJsonObject,
  resolveDeliverectWebhookVerificationSecret,
} from "@/integrations/deliverect/webhook-inbound-shared";

/**
 * Verify HMAC on `rawBody` (unchanged), using `parsedForSecret` to resolve the staging channel-link key
 * (supports bodies that are a single-element array — parse + unwrap before calling).
 */
export async function verifyDeliverectInboundWebhookJson(
  request: NextRequest,
  rawBody: string,
  parsedForSecret?: Record<string, unknown>
): Promise<{ ok: true; parsed: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  let parsed: Record<string, unknown>;
  if (parsedForSecret) {
    parsed = parsedForSecret;
  } else {
    const parsedResult = parseDeliverectWebhookJsonObject(rawBody);
    if (!parsedResult.ok) {
      return { ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
    }
    parsed = parsedResult.parsed;
  }
  const signature = getDeliverectSignatureFromRequest(request);
  const production = isDeliverectWebhookProduction();
  const { secret: verificationSecret } = resolveDeliverectWebhookVerificationSecret(parsed, production);

  if (!verificationSecret) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: production
            ? "Webhook verification misconfigured: DELIVERECT_WEBHOOK_SECRET is missing"
            : "Webhook verification failed: set DELIVERECT_WEBHOOK_SECRET or include channelLinkId in the JSON body for sandbox HMAC",
        },
        { status: 401 }
      ),
    };
  }

  const sigOk = verifyDeliverectSignature(rawBody, signature, verificationSecret, {
    nodeEnv: production ? "production" : "development",
    allowUnsignedDev: false,
  });
  if (!sigOk) {
    return { ok: false, response: NextResponse.json({ error: "Invalid signature" }, { status: 401 }) };
  }

  return { ok: true, parsed };
}
