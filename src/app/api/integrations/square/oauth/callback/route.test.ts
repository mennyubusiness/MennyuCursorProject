import { describe, expect, it } from "vitest";
import { verifySquareOAuthState } from "@/lib/integrations/square/square-oauth-state";

describe("square oauth callback state validation", () => {
  it("rejects invalid state", () => {
    expect(() => verifySquareOAuthState("totally-invalid")).toThrow();
  });
});
