import { NextRequest, NextResponse } from "next/server";

import {
  classifyInboundSmsBody,
  readTwilioWebhookParams,
  TWILIO_INBOUND_HELP_REPLY,
  TWILIO_INBOUND_OTHER_REPLY,
  TWILIO_INBOUND_START_REPLY,
  TWILIO_INBOUND_STOP_REPLY,
  twimlMessage,
  validateTwilioWebhookRequest,
} from "@/lib/twilio-webhook";
import {
  normalizeSmsPhoneE164,
  recordSmsOptIn,
  recordSmsOptOut,
} from "@/lib/sms-opt-out.service";

export const runtime = "nodejs";

function twimlResponse(message: string): NextResponse {
  return new NextResponse(twimlMessage(message), {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

/**
 * Twilio inbound SMS webhook (Messaging Service or phone number).
 * Configure in Twilio Console → phone / Messaging Service → "A message comes in" → Webhook URL.
 */
export async function POST(request: NextRequest) {
  const params = await readTwilioWebhookParams(request);
  const signature = request.headers.get("x-twilio-signature");
  const requestUrl = request.url;

  if (!validateTwilioWebhookRequest(requestUrl, params, signature)) {
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  const from = params.From?.trim() ?? "";
  const body = params.Body ?? "";
  const phoneE164 = normalizeSmsPhoneE164(from);

  const kind = classifyInboundSmsBody(body);

  if (kind === "stop") {
    if (phoneE164) {
      await recordSmsOptOut(phoneE164);
    } else {
      console.warn(
        JSON.stringify({ event: "twilio_inbound_stop_unnormalized", fromMasked: from.slice(-4) })
      );
    }
    return twimlResponse(TWILIO_INBOUND_STOP_REPLY);
  }

  if (kind === "start") {
    if (phoneE164) {
      await recordSmsOptIn(phoneE164);
    }
    return twimlResponse(TWILIO_INBOUND_START_REPLY);
  }

  if (kind === "help") {
    return twimlResponse(TWILIO_INBOUND_HELP_REPLY);
  }

  return twimlResponse(TWILIO_INBOUND_OTHER_REPLY);
}
