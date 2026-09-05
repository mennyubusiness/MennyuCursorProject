import { createHash, randomBytes } from "crypto";

/** Pod vendor email invites expire after 14 days. */
export const POD_VENDOR_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Vendor ownership claim links expire after seven days. */
export const VENDOR_CLAIM_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Pod ownership claim links expire after seven days. */
export const POD_CLAIM_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateSecureInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecureInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function normalizeSecureInviteTokenFromRequest(raw: string): string {
  return raw.trim().replace(/ /g, "+");
}

export function isUrlSafeSecureInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(token);
}

export function buildPodVendorInviteUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/vendor/invite/${encodeURIComponent(token)}`;
}

export function buildVendorClaimInvitePath(token: string): string {
  return `/claim/vendor/${encodeURIComponent(token)}`;
}

export function buildVendorClaimInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${buildVendorClaimInvitePath(token)}`;
}

export function buildPodClaimInvitePath(token: string): string {
  return `/claim/pod/${encodeURIComponent(token)}`;
}

export function buildPodClaimInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${buildPodClaimInvitePath(token)}`;
}
