/** Client-side pod hints for Quick Cart (browsing = route only; assigned = cookie). */
import { CURRENT_POD_COOKIE } from "@/lib/session";
import { BROWSE_POD_ID_SESSION_KEY } from "@/lib/customer-browse-pod";
import { isCustomerPodSlugPath } from "@/lib/customer-public-url";

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Pod id from `/pod/[podId]/…` or canonical `/{podSlug}` customer routes. */
export function getRoutePodIdFromClient(): string | null {
  if (typeof window === "undefined") return null;
  const legacy = window.location.pathname.match(/^\/pod\/([^/]+)/);
  const legacyId = legacy?.[1]?.trim();
  if (legacyId) return decodeCookieValue(legacyId);

  if (isCustomerPodSlugPath(window.location.pathname)) {
    const stored = sessionStorage.getItem(BROWSE_POD_ID_SESSION_KEY)?.trim();
    if (stored) return stored;
  }
  return null;
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
