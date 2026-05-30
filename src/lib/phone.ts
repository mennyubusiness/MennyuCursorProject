/**
 * US-focused phone normalization for transactional SMS.
 */

/** Mask E.164 or raw digits for logs (e.g. +1***1234). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  const last4 = digits.slice(-4);
  if (phone.trim().startsWith("+")) {
    const cc = digits.length > 10 ? digits.slice(0, digits.length - 10) : "1";
    return `+${cc}***${last4}`;
  }
  return `***${last4}`;
}

export function phoneLast4(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

/** Customer-facing masked US phone, e.g. +1 ••• ••• 1234 */
export function formatMaskedCustomerPhone(phoneE164: string): string {
  const last4 = phoneLast4(phoneE164);
  if (!last4) return "Phone on file";
  return `+1 ••• ••• ${last4}`;
}

export function isLikelyE164Phone(phone: string): boolean {
  const t = phone.trim();
  return /^\+[1-9]\d{7,14}$/.test(t);
}

/**
 * Normalize US phone input to E.164 (+1XXXXXXXXXX).
 * Preserves valid E.164. Returns null if cannot normalize safely.
 */
export function normalizeUsPhoneToE164(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isLikelyE164Phone(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}
