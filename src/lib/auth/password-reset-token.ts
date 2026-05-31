import { createHash, randomBytes } from "crypto";

/** Password reset links expire after 60 minutes. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** Skip issuing a duplicate reset when an active token was created within this window. */
export const PASSWORD_RESET_REQUEST_DEDUPE_MS = 2 * 60 * 1000;

/** 32-byte opaque token (base64url, URL-safe — no +, /, or =). */
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Safe prefix for logs — never log the full token. */
export function passwordResetTokenHashPrefix(token: string): string {
  return hashPasswordResetToken(token).slice(0, 12);
}

/**
 * Normalize token from query string / form before hashing.
 * Repairs legacy base64 corruption where '+' became space in some clients.
 */
export function normalizePasswordResetTokenFromRequest(raw: string): string {
  return raw.trim().replace(/ /g, "+");
}

export function isUrlSafePasswordResetToken(token: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(token);
}

export function buildPasswordResetUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}
