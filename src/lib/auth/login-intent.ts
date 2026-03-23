/**
 * Login context selection — affects copy and post-login routing only (same User session).
 */

export type LoginIntent = "vendor" | "pod" | "customer" | "admin";

const VALID_INTENTS: LoginIntent[] = ["vendor", "pod", "customer", "admin"];

export function isLoginIntent(value: string | null | undefined): value is LoginIntent {
  return value != null && VALID_INTENTS.includes(value as LoginIntent);
}

/** Parse ?intent= from the URL; invalid values return null. */
export function parseLoginIntentParam(raw: string | null): LoginIntent | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  return isLoginIntent(t) ? t : null;
}

/** Infer vendor intent when callback clearly targets a vendor area. */
export function inferIntentFromCallbackUrl(callbackPath: string): LoginIntent | null {
  const path = callbackPath.trim();
  if (path.startsWith("/vendor/")) return "vendor";
  return null;
}

/**
 * Resolve effective intent: explicit ?intent= wins; else infer from callback; else default vendor.
 */
export function resolveLoginIntent(intentParam: string | null, callbackPath: string): LoginIntent {
  const explicit = parseLoginIntentParam(intentParam);
  if (explicit) return explicit;
  const inferred = inferIntentFromCallbackUrl(callbackPath);
  if (inferred) return inferred;
  return "vendor";
}

/** Extract vendor id from paths like /vendor/{id} or /vendor/{id}/orders. */
export function extractVendorIdFromVendorPath(path: string): string | null {
  const clean = path.split("?")[0] ?? path;
  const parts = clean.split("/").filter(Boolean);
  if (parts[0] !== "vendor") return null;
  return parts[1] ?? null;
}
