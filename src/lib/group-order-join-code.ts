/** Normalize user-entered join code to six digits (client + server safe). */
export function normalizeGroupOrderJoinCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6).padStart(6, "0");
}
