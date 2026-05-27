/** Client-side pod scope for quick cart (matches mennyu_current_pod cookie + URL). */
import { CURRENT_POD_COOKIE } from "@/lib/session";

export function getCurrentPodIdFromClient(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CURRENT_POD_COOKIE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  const fromCookie = match?.[1]?.trim();
  if (fromCookie) {
    try {
      return decodeURIComponent(fromCookie);
    } catch {
      return fromCookie;
    }
  }

  const path = window.location.pathname;
  const podPage = path.match(/^\/pod\/([^/]+)/);
  if (podPage?.[1]) return podPage[1];

  return null;
}
