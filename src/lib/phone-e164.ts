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

/** US display format for verified account phone prefill, e.g. (503) 348-6843 */
export function formatUsPhoneDisplayFromE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length === 10 ? digits : null;
  if (!ten) return e164;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}
