/**
 * Server-side validation for logo uploads (magic bytes; do not trust Content-Type alone).
 */
import "server-only";

import { MAX_BRAND_IMAGE_BYTES } from "@/lib/image-upload-constants";

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type ValidatedImage = {
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
};

export function validateImageFileBuffer(buf: Buffer): { ok: true; value: ValidatedImage } | { ok: false; error: string } {
  if (buf.length > MAX_BRAND_IMAGE_BYTES) {
    return { ok: false, error: `Image must be at most ${MAX_BRAND_IMAGE_BYTES / 1024 / 1024}MB.` };
  }
  if (buf.length < 12) {
    return { ok: false, error: "File is too small or corrupted." };
  }

  if (PNG_SIG.every((b, i) => buf[i] === b)) {
    return { ok: true, value: { contentType: "image/png", extension: "png" } };
  }

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ok: true, value: { contentType: "image/jpeg", extension: "jpg" } };
  }

  const riff = buf.subarray(0, 4).toString("ascii") === "RIFF";
  const webp = buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (riff && webp) {
    return { ok: true, value: { contentType: "image/webp", extension: "webp" } };
  }

  return {
    ok: false,
    error: "Only PNG, JPEG, or WebP images are allowed.",
  };
}
