/** Client-side pod scope for quick cart (matches mennyu_current_pod cookie + URL). */
import { CURRENT_POD_COOKIE } from "@/lib/session";

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Pod id from `/pod/[podId]/…` when present — authoritative for active browsing scope. */
export function getRoutePodIdFromClient(): string | null {
  if (typeof window === "undefined") return null;
  const podPage = window.location.pathname.match(/^\/pod\/([^/]+)/);
  const id = podPage?.[1]?.trim();
  return id ? decodeCookieValue(id) : null;
}

/** Pure resolver: route pod wins over cookie (one active pod cart at a time). */
export function resolveCurrentPodId(params: {
  routePodId: string | null;
  cookiePodId: string | null;
}): string | null {
  return params.routePodId ?? params.cookiePodId;
}

export function getCurrentPodIdFromClient(): string | null {
  if (typeof document === "undefined") return null;

  const routePodId = getRoutePodIdFromClient();

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CURRENT_POD_COOKIE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  const fromCookie = match?.[1]?.trim();
  const cookiePodId = fromCookie ? decodeCookieValue(fromCookie) : null;

  return resolveCurrentPodId({ routePodId, cookiePodId });
}
