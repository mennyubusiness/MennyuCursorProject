/**
 * Minimal admin gate for dashboard access.
 * TODO: Replace with proper auth (e.g. NextAuth, role-based access) when available.
 * - In development: access allowed without secret.
 * - In production: require ADMIN_SECRET env and match via query ?admin=SECRET or cookie.
 */
import { env } from "@/lib/env";

export const ADMIN_COOKIE_NAME = "mennyu_admin";

export function isAdminAllowed(cookieValue: string | null, querySecret: string | null): boolean {
  if (env.NODE_ENV === "development") return true;
  const secret = env.ADMIN_SECRET;
  if (!secret) return false;
  const match = (v: string | null) => v != null && v.trim() === secret;
  return match(cookieValue) || match(querySecret);
}

export function buildAdminCookieHeader(secret: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(secret)}`,
    "Path=/admin",
    "Max-Age=86400",
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
