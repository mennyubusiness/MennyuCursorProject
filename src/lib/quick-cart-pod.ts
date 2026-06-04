/** Client-side pod hints for Quick Cart (browsing = route only; assigned = cookie). */
import { CURRENT_POD_COOKIE } from "@/lib/session";

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Pod id from `/pod/[podId]/…` when present — browsing context only (not cart assignment). */
export function getRoutePodIdFromClient(): string | null {
  if (typeof window === "undefined") return null;
  const podPage = window.location.pathname.match(/^\/pod\/([^/]+)/);
  const id = podPage?.[1]?.trim();
  return id ? decodeCookieValue(id) : null;
}

/** Cookie set when cart is assigned (first item, group join, reorder) — not on passive pod visits. */
export function getAssignedPodIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CURRENT_POD_COOKIE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  const fromCookie = match?.[1]?.trim();
  return fromCookie ? decodeCookieValue(fromCookie) : null;
}

/** Browsing pod for Quick Cart API (`browsePodId` query) — route wins; never stale cookie alone. */
export function getBrowsingPodIdFromClient(): string | null {
  return getRoutePodIdFromClient();
}

/**
 * @deprecated Use getBrowsingPodIdFromClient or getAssignedPodIdFromCookie explicitly.
 * Returns browsing route pod only (no cookie fallback) so neutral carts stay neutral.
 */
export function getCurrentPodIdFromClient(): string | null {
  return getBrowsingPodIdFromClient();
}

/** Pure resolver for tests. */
export function resolveBrowsingPodId(params: {
  routePodId: string | null;
}): string | null {
  return params.routePodId;
}

/** @deprecated Prefer resolveBrowsingPodId — cookie is not used for browsing scope. */
export function resolveCurrentPodId(params: {
  routePodId: string | null;
  cookiePodId: string | null;
}): string | null {
  return params.routePodId ?? params.cookiePodId;
}
