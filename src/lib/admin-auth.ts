/**
 * Admin access for dashboard + /api/admin/*:
 * - Development: allowed without checks (existing behavior).
 * - Production: temporary ADMIN_SECRET via `mennyu_admin` cookie or `?admin=` **or**
 *   authenticated User with `isPlatformAdmin` (unified NextAuth session).
 */
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { env } from "@/lib/env";

export const ADMIN_COOKIE_NAME = "mennyu_admin";

/**
 * ADMIN_SECRET bridge only (cookie / query). Does **not** include session.
 * In development, always true.
 */
export function isAdminAllowed(cookieValue: string | null, querySecret: string | null): boolean {
  if (env.NODE_ENV === "development") return true;
  const secret = env.ADMIN_SECRET;
  if (!secret) return false;
  const match = (v: string | null) => v != null && v.trim() === secret;
  return match(cookieValue) || match(querySecret);
}

export function getAdminBridgeCredentialsFromRequest(request: Request): {
  cookie: string | null;
  querySecret: string | null;
} {
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
  return { cookie: adminCookie, querySecret };
}

/**
 * Same admin gate as admin APIs: cookie + optional `?admin=` from the request URL.
 * Does **not** check platform-admin session (sync). Prefer `isAdminApiRequestAuthorized` in route handlers.
 */
export function isAdminAccessFromRequest(request: Request): boolean {
  const { cookie, querySecret } = getAdminBridgeCredentialsFromRequest(request);
  return isAdminAllowed(cookie, querySecret);
}

/** Route handlers: dev open, secret bridge, or `User.isPlatformAdmin` session. */
export async function isAdminApiRequestAuthorized(request: Request): Promise<boolean> {
  if (env.NODE_ENV === "development") return true;
  const { cookie, querySecret } = getAdminBridgeCredentialsFromRequest(request);
  if (isAdminAllowed(cookie, querySecret)) return true;
  const session = await auth();
  return Boolean(session?.user?.isPlatformAdmin);
}

/** RSC layouts: dev open, secret cookie, or platform-admin session. */
export async function isAdminDashboardLayoutAuthorized(): Promise<boolean> {
  if (env.NODE_ENV === "development") return true;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null;
  if (isAdminAllowed(cookieValue, null)) return true;
  const session = await auth();
  return Boolean(session?.user?.isPlatformAdmin);
}

/**
 * Promote/create platform admin: **only** ADMIN_SECRET bridge (or dev).
 * Intentionally does not accept session — avoids account takeover → self-grant admin.
 */
export function isAdminBootstrapSecretAuthorized(request: Request): boolean {
  if (env.NODE_ENV === "development") return true;
  const { cookie, querySecret } = getAdminBridgeCredentialsFromRequest(request);
  return isAdminAllowed(cookie, querySecret);
}

export function buildAdminCookieHeader(secret: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(secret)}`,
    "Path=/",
    "Max-Age=86400",
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
