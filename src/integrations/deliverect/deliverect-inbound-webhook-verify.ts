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

export async function verifyDeliverectInboundWebhookJson(
  request: NextRequest,
  rawBody: string
): Promise<{ ok: true; parsed: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const parsedResult = parseDeliverectWebhookJsonObject(rawBody);
  if (!parsedResult.ok) {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
  const parsed = parsedResult.parsed;
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
            : "Webhook verification failed: channelLinkId not found in payload (required for staging/sandbox HMAC)",
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
