/**
 * App Router request context: read/write mennyu_session using next/headers.
 * Centralizes session resolution for Server Components / Server Actions so we never mint a
 * throwaway UUID without also persisting Set-Cookie (see cart.actions).
 */
import "server-only";
import { cookies, headers } from "next/headers";
import {
  COOKIE_NAME,
  MENNYU_SESSION_MAX_AGE,
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

  const sessionId = crypto.randomUUID();
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
