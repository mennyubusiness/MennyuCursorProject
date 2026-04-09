import "server-only";

import { headers } from "next/headers";

/**
 * Resolves the public https (or http for local) origin for links and QR codes.
 * Prefer request headers when available (correct host behind proxies); fall back to env.
 */
export async function getPublicSiteOrigin(): Promise<string> {
  const h = await headers();
  const hostRaw = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host")?.trim();
  if (hostRaw) {
    const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto =
      forwardedProto ||
      (hostRaw.startsWith("localhost") || hostRaw.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${hostRaw}`.replace(/\/$/, "");
  }
  return getPublicSiteOriginFromEnv();
}

/** Use when `headers()` is unavailable (e.g. some scripts) or as fallback. */
export function getPublicSiteOriginFromEnv(): string {
  const u =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  return "http://localhost:3000";
}
