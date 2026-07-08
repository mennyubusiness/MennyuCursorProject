import { describe, expect, it } from "vitest";
import {
  signSquareOAuthState,
  verifySquareOAuthState,
} from "@/lib/integrations/square/square-oauth-state";

describe("square oauth state", () => {
  it("signs and verifies state with vendor, user, nonce, and exp", () => {
    const state = signSquareOAuthState("vendor_1", "user_1");
    const payload = verifySquareOAuthState(state);
    expect(payload.vendorId).toBe("vendor_1");
    expect(payload.userId).toBe("user_1");
    expect(payload.nonce.length).toBeGreaterThan(10);
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects tampered state", () => {
    const state = signSquareOAuthState("vendor_1", "user_1");
    const tilde = state.lastIndexOf("~");
    const tampered = `${state.slice(0, tilde)}~${"00".repeat(32)}`;
    expect(() => verifySquareOAuthState(tampered)).toThrow();
  });

  it("rejects expired state", () => {
    const { createHmac, randomBytes } = require("crypto");
    const secret = "dev-only-square-oauth-state-signing-secret-32";
    const exp = Math.floor(Date.now() / 1000) - 60;
    const nonce = randomBytes(16).toString("hex");
    const payload = JSON.stringify({
      v: 1,
      vendorId: "vendor_1",
      userId: "user_1",
      exp,
      nonce,
    });
    const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
    const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");
    expect(() => verifySquareOAuthState(`${payloadB64}~${sig}`)).toThrow("oauth_state_expired");
  });
});
