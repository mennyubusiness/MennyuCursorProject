import { isReservedPublicSlug } from "@/lib/reserved-slugs";
import { POD_QR_ENTRY_PARAM, POD_QR_ENTRY_VALUE } from "@/lib/pod-ordering-url";

export type CustomerPodPath = {
  podSlug: string;
  vendorSlug?: string;
};

/** Relative customer pod page path (canonical public URL). */
export function buildPodCustomerPath(
  podSlug: string,
  opts?: { entry?: typeof POD_QR_ENTRY_VALUE }
): string {
  const slug = podSlug.trim();
  const base = `/${slug}`;
  if (opts?.entry === POD_QR_ENTRY_VALUE) {
    return `${base}?${POD_QR_ENTRY_PARAM}=${POD_QR_ENTRY_VALUE}`;
  }
  return base;
}

/** Relative nested vendor menu path under a pod. */
export function buildVendorMenuCustomerPath(podSlug: string, vendorSlug: string): string {
  return `/${podSlug.trim()}/${vendorSlug.trim()}`;
}

/** Absolute URL for QR encoding (pod slug canonical path + entry=qr). */
export function buildPodOrderingAbsoluteUrl(origin: string, podSlug: string): string {
  const o = origin.replace(/\/$/, "");
  return `${o}${buildPodCustomerPath(podSlug, { entry: POD_QR_ENTRY_VALUE })}`;
}

/**
 * Parse a root-level customer pod or pod/vendor slug path.
 * Returns null for reserved segments and known app prefixes.
 */
export function parseCustomerPodSlugPath(pathname: string): CustomerPodPath | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/") return null;

  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0 || segments.length > 2) return null;

  const podSlug = segments[0]!.toLowerCase();
  if (isReservedPublicSlug(podSlug)) return null;

  if (segments.length === 1) {
    return { podSlug: segments[0]! };
  }

  const vendorSlug = segments[1]!;
  if (isReservedPublicSlug(vendorSlug.toLowerCase())) return null;
  return { podSlug: segments[0]!, vendorSlug };
}

/** True when pathname is a canonical customer pod or pod/vendor slug route. */
export function isCustomerPodSlugPath(pathname: string): boolean {
  return parseCustomerPodSlugPath(pathname) != null;
}
