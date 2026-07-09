import { createHmac, timingSafeEqual } from "crypto";

import { env } from "@/lib/env";

export function resolveSquareWebhookNotificationUrl(): string | null {
  const explicit = env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim();
  if (explicit) return explicit;
  const base = env.PUBLIC_APP_URL ?? env.NEXT_PUBLIC_APP_URL;
  if (!base?.trim()) return null;
  return `${base.replace(/\/$/, "")}/api/webhooks/square`;
}

export function isSquareWebhookSignatureConfigured(): boolean {
  return Boolean(env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim());
}

export function verifySquareWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  notificationUrl: string;
  signatureKey?: string | null;
}): boolean {
  const signatureKey = input.signatureKey?.trim() ?? env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  const signature = input.signatureHeader?.trim();
  if (!signatureKey || !signature || !input.notificationUrl.trim()) return false;

  const payload = `${input.notificationUrl}${input.rawBody}`;
  const expected = createHmac("sha256", signatureKey).update(payload).digest("base64");

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
