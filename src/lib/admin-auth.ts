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

/**
 * Same admin gate as admin APIs, for vendor routes that must allow Mennyu staff to help any vendor.
 * Reads `mennyu_admin` cookie and optional `?admin=` from the request URL (Fetch from browser sends cookies).
 */
export function isAdminAccessFromRequest(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  let adminCookie: string | null = null;
  const prefix = `${ADMIN_COOKIE_NAME}=`;
  for (const part of cookieHeader.split(";")) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      adminCookie = decodeURIComponent(p.slice(prefix.length));
      break;
    }
  }
  let querySecret: string | null = null;
  try {
    querySecret = new URL(request.url).searchParams.get("admin");
  } catch {
    querySecret = null;
  }
  return isAdminAllowed(adminCookie, querySecret);
}

export function buildAdminCookieHeader(secret: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(secret)}`,
    // Must be / so the browser sends this cookie on same-origin fetches to /api/admin/* (Path=/admin does not match /api/...).
    "Path=/",
    "Max-Age=86400",
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
