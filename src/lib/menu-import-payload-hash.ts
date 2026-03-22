import { createHash } from "node:crypto";

/**
 * Deterministic JSON serialization for hashing (sorted object keys).
 * Use for payload dedupe fingerprints — not for cryptographic security alone.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`);
  return `{${parts.join(",")}}`;
}

export function sha256HexUtf8(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Fingerprint of an arbitrary JSON-compatible payload (import raw body or canonical menu). */
export function payloadFingerprint(value: unknown): string {
  return sha256HexUtf8(stableStringify(value));
}
