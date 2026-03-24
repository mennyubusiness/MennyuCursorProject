/**
 * Stateless cookie-based anonymous session for cart identity.
 * No auth libraries; just a UUID in a cookie.
 */
import { NextRequest } from "next/server";

export const COOKIE_NAME = "mennyu_session";
/** Cookie storing the last-visited pod so /cart can show the correct cart when multiple exist per session. */
export const CURRENT_POD_COOKIE = "mennyu_current_pod";
/** Cookie storing customer phone for order history (session-based access without full account). */
export const CUSTOMER_PHONE_COOKIE = "mennyu_customer_phone";
/** Max-Age (seconds) for mennyu_session — keep in sync with Set-Cookie and cookies().set. */
export const MENNYU_SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const COOKIE_MAX_AGE = MENNYU_SESSION_MAX_AGE;

function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Read session ID from request cookie. Returns null if not set.
 */
export function getSessionIdFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(COOKIE_NAME);
  const value = cookie?.value?.trim();
  if (!value) return null;
  return value;
}

/** Header set by middleware when it creates a new session (same request, cookie not yet on client). */
export const SESSION_HEADER = "x-mennyu-session";

/**
 * Read session ID from a Headers instance (e.g. from next/headers in server actions).
 * Uses cookie mennyu_session, or x-mennyu-session when middleware just set the cookie (first request).
 */
export function getSessionIdFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    const value = match?.[1]?.trim();
    if (value) {
      try {
        return decodeURIComponent(value);
      } catch {
        // fall through to header check
      }
    }
  }
  const headerSession = headers.get(SESSION_HEADER)?.trim();
  return headerSession || null;
}

/**
 * Read current-pod ID from request (set when user visits a pod page).
 * Used by /cart to choose which cart to show when the session has multiple carts.
 */
export function getCurrentPodIdFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${CURRENT_POD_COOKIE}=([^;]+)`));
  const value = match?.[1]?.trim();
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Read customer phone from request (for order history).
 */
export function getCustomerPhoneFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${CUSTOMER_PHONE_COOKIE}=([^;]+)`));
  const value = match?.[1]?.trim();
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Build Set-Cookie header for the customer-phone cookie. */
export function buildCustomerPhoneCookieHeader(phone: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${CUSTOMER_PHONE_COOKIE}=${encodeURIComponent(phone)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

/** Clear the customer-phone cookie (sign out of order history / phone session). */
export function buildClearCustomerPhoneCookieHeader(): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [`${CUSTOMER_PHONE_COOKIE}=`, "Path=/", "Max-Age=0", "SameSite=Lax"];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

/** Build Set-Cookie header for the current-pod cookie (used by middleware). */
export function buildCurrentPodCookieHeader(podId: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${CURRENT_POD_COOKIE}=${encodeURIComponent(podId)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "SameSite=Lax",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Get existing session ID or generate a new one.
 * Returns { sessionId, isNew } so callers can set the cookie when isNew is true.
 */
export function getOrSetSessionId(request: NextRequest): { sessionId: string; isNew: boolean } {
  const existing = getSessionIdFromRequest(request);
  if (existing) return { sessionId: existing, isNew: false };
  return { sessionId: generateSessionId(), isNew: true };
}

/**
 * Build Set-Cookie header value for the session cookie.
 * HttpOnly, SameSite=Lax, Path=/. Secure in production.
 */
export function buildSessionCookieHeader(sessionId: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}
