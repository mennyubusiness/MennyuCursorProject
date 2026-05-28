/**
 * SMS feature flags and Twilio credential presence (server-only).
 */
import "server-only";

import { env } from "@/lib/env";

function parseTriState(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function twilioFromPhoneNumber(): string | null {
  return env.TWILIO_FROM_PHONE_NUMBER ?? env.TWILIO_PHONE_NUMBER ?? null;
}

export function hasTwilioCredentials(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID?.trim() &&
      env.TWILIO_AUTH_TOKEN?.trim() &&
      (twilioFromPhoneNumber()?.trim() || env.TWILIO_MESSAGING_SERVICE_SID?.trim())
  );
}

/** Whether outbound SMS is allowed at all (not tests unless forced). */
export function isSmsEnabled(): boolean {
  if (process.env.NODE_ENV === "test") {
    return parseTriState(env.SMS_ENABLED) === true;
  }
  const explicit = parseTriState(env.SMS_ENABLED);
  if (explicit !== undefined) return explicit;
  return env.NODE_ENV === "production";
}

export function isSmsDryRun(): boolean {
  const explicit = parseTriState(env.SMS_DRY_RUN);
  if (explicit !== undefined) return explicit;
  return env.NODE_ENV !== "production";
}

export function isSmsLogOnly(): boolean {
  return parseTriState(env.SMS_LOG_ONLY) === true;
}

/** True when we should call Twilio Messages API. */
export function shouldSendViaTwilio(): boolean {
  if (!isSmsEnabled()) return false;
  if (isSmsDryRun()) return false;
  if (isSmsLogOnly()) return false;
  return hasTwilioCredentials();
}

export function smsOperationalError(): string | null {
  if (!isSmsEnabled()) return null;
  if (isSmsDryRun() || isSmsLogOnly()) return null;
  if (hasTwilioCredentials()) return null;
  if (env.NODE_ENV === "production") {
    return "Twilio credentials or sender (From number / Messaging Service SID) missing in production.";
  }
  return null;
}
