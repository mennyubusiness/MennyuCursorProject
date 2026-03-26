/**
 * Cart session contract (App Router — Server Components / Server Actions):
 *
 * - Read-only: `getMennyuSessionIdForRequest()` — never mints; same identity as Route Handlers
 *   when middleware echoes `x-mennyu-session` or the cookie is present.
 * - Ensure + persist cookie: `getOrCreateMennyuSessionIdForCart()` — only here (besides middleware
 *   edge path and `getOrSetSessionId` + Set-Cookie for Route Handlers).
 *
 * Do not call `crypto.randomUUID()` for cart identity outside `@/lib/session` + this module.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import {
  COOKIE_NAME,
  MENNYU_SESSION_MAX_AGE,
  createMennyuSessionId,
  getSessionIdFromHeaders,
} from "@/lib/session";

/**
 * Prefer cookies() (App Router), then fall back to Cookie header / x-mennyu-session from middleware.
 */
export async function getMennyuSessionIdForRequest(): Promise<string | null> {
  const store = await cookies();
  const fromCookiesApi = store.get(COOKIE_NAME)?.value?.trim();
  if (fromCookiesApi) return fromCookiesApi;

  const h = await headers();
  return getSessionIdFromHeaders(h);
}

/**
 * Stable anonymous session for cart: never return a random id without setting the response cookie.
 */
export async function getOrCreateMennyuSessionIdForCart(): Promise<string> {
  const existing = await getMennyuSessionIdForRequest();
  if (existing) return existing;

  const sessionId = createMennyuSessionId();
  const store = await cookies();
  store.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MENNYU_SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return sessionId;
}
