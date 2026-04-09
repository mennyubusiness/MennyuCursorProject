/**
 * Lightweight client-side retention: favorites and recently viewed pods/vendors.
 * Stored only in localStorage — no server sync (honest, low-risk polish).
 */

export const MENNYU_LOCAL_RETENTION_EVENT = "mennyu:local-retention-updated";

const KEY_FAV_PODS = "mennyu_favorite_pods_v1";
const KEY_FAV_VENDORS = "mennyu_favorite_vendors_v1";
const KEY_RECENT = "mennyu_recent_views_v1";

const MAX_FAVORITES = 32;
const MAX_RECENT = 6;

export type FavoritePodEntry = { id: string; name: string; savedAt: number };
export type FavoriteVendorEntry = { id: string; podId: string; name: string; savedAt: number };

export type RecentViewEntry =
  | { kind: "pod"; id: string; name: string; viewedAt: number }
  | { kind: "vendor"; id: string; podId: string; name: string; viewedAt: number };

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(MENNYU_LOCAL_RETENTION_EVENT));
  } catch {
    // ignore quota / private mode
  }
}

export function getFavoritePods(): FavoritePodEntry[] {
  return readJson<FavoritePodEntry[]>(KEY_FAV_PODS, []);
}

export function getFavoriteVendors(): FavoriteVendorEntry[] {
  return readJson<FavoriteVendorEntry[]>(KEY_FAV_VENDORS, []);
}

export function isFavoritePod(podId: string): boolean {
  return getFavoritePods().some((p) => p.id === podId);
}

export function isFavoriteVendor(vendorId: string, podId: string): boolean {
  return getFavoriteVendors().some((v) => v.id === vendorId && v.podId === podId);
}

export function toggleFavoritePod(podId: string, podName: string): boolean {
  const list = getFavoritePods();
  const idx = list.findIndex((p) => p.id === podId);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeJson(KEY_FAV_PODS, list);
    return false;
  }
  const next = [{ id: podId, name: podName, savedAt: Date.now() }, ...list.filter((p) => p.id !== podId)];
  writeJson(KEY_FAV_PODS, next.slice(0, MAX_FAVORITES));
  return true;
}

export function toggleFavoriteVendor(vendorId: string, podId: string, vendorName: string): boolean {
  const list = getFavoriteVendors();
  const idx = list.findIndex((v) => v.id === vendorId && v.podId === podId);
  if (idx >= 0) {
    list.splice(idx, 1);
    writeJson(KEY_FAV_VENDORS, list);
    return false;
  }
  const next = [
    { id: vendorId, podId, name: vendorName, savedAt: Date.now() },
    ...list.filter((v) => !(v.id === vendorId && v.podId === podId)),
  ];
  writeJson(KEY_FAV_VENDORS, next.slice(0, MAX_FAVORITES));
  return true;
}

function recentKey(entry: RecentViewEntry): string {
  return entry.kind === "pod" ? `pod:${entry.id}` : `vendor:${entry.podId}:${entry.id}`;
}

export function getRecentViews(): RecentViewEntry[] {
  return readJson<RecentViewEntry[]>(KEY_RECENT, []);
}

function pushRecent(entry: RecentViewEntry): void {
  const list = getRecentViews();
  const k = recentKey(entry);
  const filtered = list.filter((e) => recentKey(e) !== k);
  const next = [entry, ...filtered].slice(0, MAX_RECENT);
  writeJson(KEY_RECENT, next);
}

export function recordPodView(podId: string, podName: string): void {
  pushRecent({ kind: "pod", id: podId, name: podName, viewedAt: Date.now() });
}

export function recordVendorView(vendorId: string, podId: string, vendorName: string): void {
  pushRecent({ kind: "vendor", id: vendorId, podId, name: vendorName, viewedAt: Date.now() });
}
