/**
 * Email feature flags and provider credential presence (server-only).
 */
import "server-only";

import { env } from "@/lib/env";

function parseTriState(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function hasResendCredentials(): boolean {
  return Boolean(env.RESEND_API_KEY?.trim() && env.EMAIL_FROM?.trim());
}

export function isEmailEnabled(): boolean {
  if (process.env.NODE_ENV === "test") {
    return parseTriState(env.EMAIL_ENABLED) === true;
  }
  const explicit = parseTriState(env.EMAIL_ENABLED);
  if (explicit !== undefined) return explicit;
  return env.NODE_ENV === "production";
}

export function isEmailDryRun(): boolean {
  const explicit = parseTriState(env.EMAIL_DRY_RUN);
  if (explicit !== undefined) return explicit;
  return env.NODE_ENV !== "production";
}

export function isEmailLogOnly(): boolean {
  return parseTriState(env.EMAIL_LOG_ONLY) === true;
}

export function shouldSendViaResend(): boolean {
  if (!isEmailEnabled()) return false;
  if (isEmailDryRun()) return false;
  if (isEmailLogOnly()) return false;
  return hasResendCredentials();
}

export function emailOperationalError(): string | null {
  if (!isEmailEnabled()) return null;
  if (isEmailDryRun() || isEmailLogOnly()) return null;
  if (hasResendCredentials()) return null;
  if (env.NODE_ENV === "production") {
    return "RESEND_API_KEY and EMAIL_FROM are required in production when EMAIL_DRY_RUN=false.";
  }
  return null;
}
