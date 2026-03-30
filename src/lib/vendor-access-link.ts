/**
 * Signed, time-limited tokens for vendor dashboard magic links.
 * Does not contain the long-lived Vendor.vendorDashboardToken — only proves Mennyu issued access for this vendor.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const PAYLOAD_VERSION = 1 as const;
const DEFAULT_TTL_SEC = 60 * 60 * 24; // 24h

export type VendorAccessLinkPayload = {
  vendorId: string;
  exp: number;
  redirectPath: string | null;
};

function getSigningSecret(): string {
  const fromEnv = env.VENDOR_ACCESS_SIGNING_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return "dev-only-vendor-access-signing-secret-min-32-chars!";
  }
  throw new Error(
    "VENDOR_ACCESS_SIGNING_SECRET is required in production (min 32 chars) for vendor magic links."
  );
}

/**
 * Build a signed token. `redirectPath` must be validated at consume time.
 */
export function signVendorAccessLinkToken(
  vendorId: string,
  options?: { expiresInSec?: number; redirectPath?: string | null }
): string {
  const secret = getSigningSecret();
  const exp = Math.floor(Date.now() / 1000) + (options?.expiresInSec ?? DEFAULT_TTL_SEC);
  const payload = JSON.stringify({
    v: PAYLOAD_VERSION,
    vendorId: vendorId.trim(),
    exp,
    rp: options?.redirectPath ?? null,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}~${sig}`;
}

export function verifyVendorAccessLinkToken(token: string): VendorAccessLinkPayload {
  const secret = getSigningSecret();
  const tilde = token.lastIndexOf("~");
  if (tilde <= 0) {
    throw new Error("invalid_token_format");
  }
  const payloadB64 = token.slice(0, tilde);
  const sig = token.slice(tilde + 1);
  const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("bad_signature");
    }
  } catch {
    throw new Error("bad_signature");
  }

  const raw = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
    v: number;
    vendorId: string;
    exp: number;
    rp: string | null;
  };
  if (raw.v !== PAYLOAD_VERSION) throw new Error("bad_version");
  if (typeof raw.exp !== "number" || raw.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("expired");
  }
  if (!raw.vendorId?.trim()) throw new Error("missing_vendor");

  return {
    vendorId: raw.vendorId.trim(),
    exp: raw.exp,
    redirectPath: raw.rp,
  };
}

/** Only allow redirects under this vendor's dashboard path. */
export function safeVendorDashboardRedirectPath(vendorId: string, path: string | null | undefined): string {
  const base = `/vendor/${vendorId}`;
  const fallback = `${base}/menu`;
  if (!path || typeof path !== "string") return fallback;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (!trimmed.startsWith(`${base}/`) && trimmed !== base) return fallback;
  return trimmed;
}
