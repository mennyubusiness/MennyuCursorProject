import { describe, expect, it } from "vitest";
import { payloadFingerprint, stableStringify } from "./menu-import-payload-hash";

describe("menu-import-payload-hash", () => {
  it("stableStringify sorts object keys", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it("payloadFingerprint is stable for equivalent objects", () => {
    expect(payloadFingerprint({ z: 1, y: { c: 3, b: 2 } })).toBe(
      payloadFingerprint({ y: { b: 2, c: 3 }, z: 1 })
    );
  });

  it("payloadFingerprint differs for different payloads", () => {
    expect(payloadFingerprint({ a: 1 })).not.toBe(payloadFingerprint({ a: 2 }));
  });
});
