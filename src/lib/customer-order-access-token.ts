/**
 * Signed, time-limited tokens for customer order status links (SMS, checkout redirect).
 */
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const PAYLOAD_VERSION = 1 as const;
/** SMS / order links remain valid long enough to track multi-vendor pickup windows. */
const DEFAULT_TTL_SEC = 60 * 60 * 24 * 90; // 90 days

export const ORDER_ACCESS_QUERY_PARAM = "access";

function getSigningSecret(): string {
  const dedicated = env.ORDER_ACCESS_SIGNING_SECRET?.trim();
  if (dedicated && dedicated.length >= 32) return dedicated;
  const authSecret = env.AUTH_SECRET?.trim();
  if (authSecret && authSecret.length >= 32) return authSecret;
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return "dev-only-order-access-signing-secret-min-32-chars!";
  }
  throw new Error(
    "ORDER_ACCESS_SIGNING_SECRET or AUTH_SECRET (min 32 chars) is required in production for order access links."
  );
}

export function createCustomerOrderAccessToken(
  orderId: string,
  options?: { expiresInSec?: number }
): string {
  const secret = getSigningSecret();
  const exp = Math.floor(Date.now() / 1000) + (options?.expiresInSec ?? DEFAULT_TTL_SEC);
  const payload = JSON.stringify({
    v: PAYLOAD_VERSION,
    orderId: orderId.trim(),
    exp,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}~${sig}`;
}

export function verifyCustomerOrderAccessToken(orderId: string, token: string): boolean {
  if (!token?.trim()) return false;
  try {
    const secret = getSigningSecret();
    const tilde = token.lastIndexOf("~");
    if (tilde <= 0) return false;
    const payloadB64 = token.slice(0, tilde);
    const sig = token.slice(tilde + 1);
    const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { v?: number; orderId?: string; exp?: number };
    if (payload.v !== PAYLOAD_VERSION) return false;
    if (payload.orderId !== orderId.trim()) return false;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function orderStatusUrlWithAccess(orderId: string, baseUrl: string): string {
  const token = createCustomerOrderAccessToken(orderId);
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/order/${orderId}?${ORDER_ACCESS_QUERY_PARAM}=${encodeURIComponent(token)}`;
}
