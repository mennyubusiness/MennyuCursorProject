import { describe, expect, it } from "vitest";
import {
  signSquareOAuthState,
  verifySquareOAuthState,
} from "@/lib/integrations/square/square-oauth-state";

describe("square oauth state", () => {
  it("signs and verifies state with vendor and user", () => {
    const state = signSquareOAuthState("vendor_1", "user_1");
    const payload = verifySquareOAuthState(state);
    expect(payload.vendorId).toBe("vendor_1");
    expect(payload.userId).toBe("user_1");
  });

  it("rejects tampered state", () => {
    const state = signSquareOAuthState("vendor_1", "user_1");
    const tilde = state.lastIndexOf("~");
    const tampered = `${state.slice(0, tilde)}~${"0".repeat(64)}`;
    expect(() => verifySquareOAuthState(tampered)).toThrow();
  });
});
