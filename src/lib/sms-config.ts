/**
 * SMS feature flags — SMS_MODE is the primary control; legacy SMS_* vars remain supported.
 */
import "server-only";

import { env } from "@/lib/env";

export type SmsMode = "log" | "twilio" | "disabled";

function parseTriState(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function legacySmsEnabled(): boolean {
  if (process.env.NODE_ENV === "test") {
    return parseTriState(env.SMS_ENABLED) === true;
  }
  const explicit = parseTriState(env.SMS_ENABLED);
  if (explicit !== undefined) return explicit;
  return env.NODE_ENV === "production";
}

function legacySmsDryRun(): boolean {
  const explicit = parseTriState(env.SMS_DRY_RUN);
  if (explicit !== undefined) return explicit;
  return env.NODE_ENV !== "production";
}

function legacySmsLogOnly(): boolean {
  return parseTriState(env.SMS_LOG_ONLY) === true;
}

/** Primary SMS mode (SMS_MODE env). Falls back to legacy SMS_ENABLED / SMS_DRY_RUN. */
export function resolveSmsMode(): SmsMode {
  const raw = env.SMS_MODE?.trim().toLowerCase();
  if (raw === "log" || raw === "twilio" || raw === "disabled") {
    return raw;
  }

  if (!legacySmsEnabled()) return "disabled";
  if (legacySmsDryRun() || legacySmsLogOnly()) return "log";
  return "twilio";
}

export function hasTwilioCredentials(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID?.trim() &&
      env.TWILIO_AUTH_TOKEN?.trim() &&
      env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  );
}

/** @deprecated Use resolveSmsMode() */
export function isSmsEnabled(): boolean {
  return resolveSmsMode() !== "disabled";
}

/** @deprecated Use resolveSmsMode() */
export function isSmsDryRun(): boolean {
  return resolveSmsMode() === "log";
}

/** @deprecated Use resolveSmsMode() */
export function isSmsLogOnly(): boolean {
  return resolveSmsMode() === "log";
}

/** True when we should call Twilio Messages API. */
export function shouldSendViaTwilio(): boolean {
  return resolveSmsMode() === "twilio" && hasTwilioCredentials();
}

export function smsOperationalError(): string | null {
  if (resolveSmsMode() !== "twilio") return null;
  if (hasTwilioCredentials()) return null;
  if (env.NODE_ENV === "production") {
    return "Twilio credentials or TWILIO_MESSAGING_SERVICE_SID missing in production.";
  }
  return "twilio_not_configured";
}

export function twilioStatusCallbackUrl(): string | null {
  const explicit = env.TWILIO_STATUS_CALLBACK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const base =
    env.PUBLIC_APP_URL?.replace(/\/$/, "") ??
    env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    env.NEXTAUTH_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/api/twilio/sms-status`;
}
