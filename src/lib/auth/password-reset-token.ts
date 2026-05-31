import "server-only";

import { createHash, randomBytes } from "crypto";

/** Password reset links expire after 60 minutes. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

/** 32-byte opaque token (hex-encoded). */
export function generatePasswordResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
