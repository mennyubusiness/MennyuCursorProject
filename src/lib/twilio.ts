/**
 * Lazy Twilio REST client (server-only). Not instantiated when SMS mode is not twilio.
 */
import "server-only";

import twilio from "twilio";
import type { Twilio } from "twilio";
import { env } from "@/lib/env";
import { shouldSendViaTwilio, twilioStatusCallbackUrl } from "@/lib/sms-config";

let client: Twilio | null | undefined;

export function getTwilioClient(): Twilio | null {
  if (!shouldSendViaTwilio()) return null;
  if (client !== undefined) return client;

  if (!env.TWILIO_ACCOUNT_SID?.trim() || !env.TWILIO_AUTH_TOKEN?.trim()) {
    client = null;
    return null;
  }

  client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return client;
}

export type TwilioSendParams = {
  to: string;
  body: string;
};

export async function sendTwilioMessage(
  params: TwilioSendParams
): Promise<{ sid: string; status?: string } | { error: string; code?: string }> {
  const twilioClient = getTwilioClient();
  if (!twilioClient) {
    return { error: "Twilio client not available" };
  }

  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (!messagingServiceSid) {
    return { error: "TWILIO_MESSAGING_SERVICE_SID is required for outbound SMS" };
  }

  const statusCallback = twilioStatusCallbackUrl();

  try {
    const message = await twilioClient.messages.create({
      body: params.body,
      to: params.to,
      messagingServiceSid,
      ...(statusCallback ? { statusCallback } : {}),
    });
    if (!message.sid) {
      return { error: "Twilio returned no message SID" };
    }
    return { sid: message.sid, status: message.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const code =
      e && typeof e === "object" && "code" in e && e.code != null ? String(e.code) : undefined;
    return { error: message, code };
  }
}
