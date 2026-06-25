import { createHash, randomBytes } from "crypto";

/** Pod vendor email invites expire after 14 days. */
export const POD_VENDOR_INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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
