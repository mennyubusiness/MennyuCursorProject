/** Normalize user-entered join code to six digits (client + server safe). */
export function normalizeGroupOrderJoinCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6).padStart(6, "0");
}

/** Strict join-code parsing for lookups — rejects codes that are not exactly six digits. */
export function parseGroupOrderJoinCodeDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  return digits;
}
