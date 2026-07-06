import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const PAYLOAD_VERSION = 1 as const;
const TTL_SEC = 60 * 15;

export type SquareOAuthStatePayload = {
  vendorId: string;
  userId: string;
};

function getSigningSecret(): string {
  const fromEnv = env.AUTH_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 32) return fromEnv;
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return "dev-only-square-oauth-state-signing-secret-32";
  }
  throw new Error("AUTH_SECRET is required for Square OAuth state signing.");
}

export function signSquareOAuthState(vendorId: string, userId: string): string {
  const secret = getSigningSecret();
  const exp = Math.floor(Date.now() / 1000) + TTL_SEC;
  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify({
    v: PAYLOAD_VERSION,
    vendorId: vendorId.trim(),
    userId: userId.trim(),
    exp,
    nonce,
  });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}~${sig}`;
}

export function verifySquareOAuthState(state: string): SquareOAuthStatePayload {
  const secret = getSigningSecret();
  const tilde = state.lastIndexOf("~");
  if (tilde <= 0) throw new Error("invalid_oauth_state");

  const payloadB64 = state.slice(0, tilde);
  const sig = state.slice(tilde + 1);
  const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("bad_oauth_state_signature");
    }
  } catch {
    throw new Error("bad_oauth_state_signature");
  }

  const raw = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
    v: number;
    vendorId: string;
    userId: string;
    exp: number;
  };
  if (raw.v !== PAYLOAD_VERSION) throw new Error("bad_oauth_state_version");
  if (typeof raw.exp !== "number" || raw.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("oauth_state_expired");
  }
  if (!raw.vendorId?.trim() || !raw.userId?.trim()) throw new Error("oauth_state_incomplete");

  return { vendorId: raw.vendorId.trim(), userId: raw.userId.trim() };
}
