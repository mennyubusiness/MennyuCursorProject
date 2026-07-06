/**
 * AES-256-GCM encryption for integration provider OAuth tokens.
 * Raw tokens never stored on VendorIntegrationConnection — only encrypted blobs here,
 * referenced by IntegrationProviderCredential.id via accessTokenRef / refreshTokenRef.
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_SALT = "openorder-integration-token-v1";

export class IntegrationTokenEncryptionNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationTokenEncryptionNotConfiguredError";
  }
}

function deriveKey(): Buffer {
  const secret =
    env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim() || env.AUTH_SECRET?.trim() || "";
  if (secret.length >= 32) {
    return scryptSync(secret, KEY_SALT, 32);
  }
  if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
    return scryptSync("dev-only-integration-token-key-min-32-chars!", KEY_SALT, 32);
  }
  throw new IntegrationTokenEncryptionNotConfiguredError(
    "INTEGRATION_TOKEN_ENCRYPTION_KEY (min 32 chars) or AUTH_SECRET is required in production to store Square OAuth tokens."
  );
}

/** Encrypt plaintext → base64(iv + authTag + ciphertext). */
export function encryptIntegrationSecret(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptIntegrationSecret(payloadB64: string): string {
  const key = deriveKey();
  const buf = Buffer.from(payloadB64, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = buf.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function isIntegrationTokenEncryptionConfigured(): boolean {
  try {
    deriveKey();
    return true;
  } catch {
    return false;
  }
}
