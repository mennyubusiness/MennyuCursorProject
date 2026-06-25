import { sanitizeLoginReturnPath } from "@/lib/auth/login-return-path";

const VENDOR_INVITE_PREFIX = "/vendor/invite/";

export function isVendorInvitePath(path: string | null | undefined): boolean {
  const safe = sanitizeLoginReturnPath(path ?? null);
  if (!safe) return false;
  const clean = safe.split("?")[0]?.trim() ?? "";
  return clean.startsWith(VENDOR_INVITE_PREFIX);
}

export function extractInviteTokenFromPath(path: string | null | undefined): string | null {
  const safe = sanitizeLoginReturnPath(path ?? null);
  if (!safe) return null;
  const clean = safe.split("?")[0]?.trim() ?? "";
  if (!clean.startsWith(VENDOR_INVITE_PREFIX)) return null;
  const encoded = clean.slice(VENDOR_INVITE_PREFIX.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function buildVendorInvitePath(token: string): string {
  return `${VENDOR_INVITE_PREFIX}${encodeURIComponent(token)}`;
}

export function appendNextQueryParam(basePath: string, nextPath: string): string {
  const safe = sanitizeLoginReturnPath(nextPath);
  if (!safe) return basePath;
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}next=${encodeURIComponent(safe)}`;
}
