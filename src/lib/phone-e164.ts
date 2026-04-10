/**
 * Minimal US-focused E.164 normalization for group-order joiners (MVP).
 * Extend for international prefixes in a later pass.
 */

export type PhoneNormalizeResult = { ok: true; e164: string } | { ok: false; error: string };

/** Strips to digits; accepts 10-digit US or 11 with leading 1. */
export function normalizePhoneToE164US(input: string): PhoneNormalizeResult {
  const raw = input.trim();
  if (!raw) {
    return { ok: false, error: "Phone number is required." };
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return { ok: true, e164: `+${digits}` };
  }
  if (digits.length === 10) {
    return { ok: true, e164: `+1${digits}` };
  }
  return { ok: false, error: "Enter a valid 10-digit US mobile number." };
}
