import { NextRequest, NextResponse } from "next/server";

import { applyTwilioSmsStatusCallback } from "@/services/sms-status-update.service";
import { readTwilioWebhookParams, resolveTwilioWebhookRequestUrl, validateTwilioWebhookRequest } from "@/lib/twilio-webhook";

export const runtime = "nodejs";

/**
 * Twilio outbound SMS status callback.
 * Set TWILIO_STATUS_CALLBACK_URL or allow default: {PUBLIC_APP_URL}/api/twilio/sms-status
 * Also passed on each messages.create via statusCallback when configured.
 */
export async function POST(request: NextRequest) {
  const params = await readTwilioWebhookParams(request);
  const signature = request.headers.get("x-twilio-signature");
  const requestUrl = resolveTwilioWebhookRequestUrl(request);

  if (!validateTwilioWebhookRequest(requestUrl, params, signature)) {
    return NextResponse.json({ error: "Invalid Twilio signature" }, { status: 403 });
  }

  const messageSid = params.MessageSid?.trim() ?? params.SmsSid?.trim() ?? "";
  const messageStatus = params.MessageStatus?.trim() ?? params.SmsStatus?.trim() ?? "";

  await applyTwilioSmsStatusCallback({
    messageSid,
    messageStatus,
    to: params.To ?? null,
    from: params.From ?? null,
    errorCode: params.ErrorCode ?? null,
    errorMessage: params.ErrorMessage ?? null,
  });

  return new NextResponse(null, { status: 200 });
}
