import { createHash, randomBytes } from "crypto";

/** Email verification links expire after 24 hours. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Minimum time between resend attempts for the same user. */
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

/** 32-byte opaque token (base64url). */
export function generateEmailVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function emailVerificationTokenHashPrefix(token: string): string {
  return hashEmailVerificationToken(token).slice(0, 12);
}

export function normalizeEmailVerificationTokenFromRequest(raw: string): string {
  return raw.trim().replace(/ /g, "+");
}

export function isUrlSafeEmailVerificationToken(token: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(token);
}

export function buildEmailVerificationUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}
