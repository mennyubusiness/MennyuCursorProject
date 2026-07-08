import { describe, expect, it } from "vitest";
import {
  buildSquareOAuthErrorRedirect,
  mapSquareApiErrorToOAuthCode,
  normalizeSquareOAuthErrorCode,
  resolveSquareOAuthUserMessage,
} from "@/lib/integrations/square/square-oauth-errors";

describe("square oauth errors", () => {
  it("maps internal state errors to user-facing codes", () => {
    expect(normalizeSquareOAuthErrorCode("oauth_state_expired")).toBe("oauth_state_expired");
    expect(normalizeSquareOAuthErrorCode("bad_oauth_state_signature")).toBe("invalid_oauth_state");
  });

  it("builds vendor-specific error redirects", () => {
    const url = buildSquareOAuthErrorRedirect(
      "https://www.openorderco.com",
      "vendor_1",
      "oauth_state_expired"
    );
    expect(url).toContain("/vendor/vendor_1/integrations/square");
    expect(url).toContain("square_error=oauth_state_expired");
  });

  it("resolves friendly messages without exposing secrets", () => {
    const message = resolveSquareOAuthUserMessage("token_exchange_failed");
    expect(message).toContain("authorization code");
    expect(message.toLowerCase()).not.toContain("secret");
  });

  it("maps SquareApiError messages to safe OAuth redirect codes", () => {
    expect(mapSquareApiErrorToOAuthCode("Square OAuth token exchange failed: invalid_grant")).toBe(
      "token_exchange_failed"
    );
    expect(mapSquareApiErrorToOAuthCode("Square locations fetch failed: unauthorized")).toBe(
      "locations_fetch_failed"
    );
    expect(mapSquareApiErrorToOAuthCode("Square merchant fetch failed: not found")).toBe(
      "merchant_fetch_failed"
    );
    expect(mapSquareApiErrorToOAuthCode("unexpected provider detail with secrets")).toBe(
      "oauth_failed"
    );
  });
});
