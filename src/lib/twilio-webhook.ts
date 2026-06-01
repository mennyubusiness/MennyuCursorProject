/**
 * Twilio webhook helpers (signature validation, form parsing, TwiML).
 */
import "server-only";

import twilio from "twilio";
import { env } from "@/lib/env";

export function parseTwilioFormBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

export async function readTwilioWebhookParams(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await request.text();
    return parseTwilioFormBody(text);
  }
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const out: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  }
  try {
    const text = await request.text();
    if (text.includes("=")) return parseTwilioFormBody(text);
  } catch {
    /* ignore */
  }
  return {};
}

export function validateTwilioWebhookRequest(
  requestUrl: string,
  params: Record<string, string>,
  signature: string | null
): boolean {
  const authToken = env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken || !signature) {
    return env.NODE_ENV !== "production";
  }
  return twilio.validateRequest(authToken, signature, requestUrl, params);
}

export function twimlMessage(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

export const TWILIO_INBOUND_STOP_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
]);

export const TWILIO_INBOUND_START_KEYWORDS = new Set(["start", "yes", "unstop"]);

export const TWILIO_INBOUND_HELP_KEYWORDS = new Set(["help", "info"]);

export function classifyInboundSmsBody(body: string): "stop" | "start" | "help" | "other" {
  const normalized = body.trim().toLowerCase();
  if (TWILIO_INBOUND_STOP_KEYWORDS.has(normalized)) return "stop";
  if (TWILIO_INBOUND_START_KEYWORDS.has(normalized)) return "start";
  if (TWILIO_INBOUND_HELP_KEYWORDS.has(normalized)) return "help";
  return "other";
}

export const TWILIO_INBOUND_STOP_REPLY =
  "You have unsubscribed from Open Order text updates. You will no longer receive SMS messages. Reply START to resubscribe.";

export const TWILIO_INBOUND_START_REPLY =
  "You are subscribed to Open Order transactional text updates for verification codes and pickup order notifications. Reply STOP to opt out.";

export const TWILIO_INBOUND_HELP_REPLY =
  "Open Order sends verification codes and pickup order status notifications. For help, contact openorder.business@gmail.com. Reply STOP to opt out.";

export const TWILIO_INBOUND_OTHER_REPLY =
  "Open Order sends automated pickup order notifications only. For help, contact openorder.business@gmail.com. Reply STOP to opt out.";
