import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifySquareOAuthState } from "@/lib/integrations/square/square-oauth-state";

vi.mock("server-only", () => ({}));

const mockGetPublicSiteOrigin = vi.fn(async () => "https://www.openorderco.com");
const mockCompleteSquareOAuth = vi.fn();
const mockConsumeNonce = vi.fn();
const mockPruneNonces = vi.fn();
const mockAuth = vi.fn();
const mockCanManageVendor = vi.fn();

vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOrigin: () => mockGetPublicSiteOrigin(),
}));

vi.mock("@/auth", () => ({
  auth: () => mockAuth(),
}));

vi.mock("@/lib/permissions", () => ({
  canManageVendor: (...args: unknown[]) => mockCanManageVendor(...args),
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  completeSquareOAuthForVendor: (...args: unknown[]) => mockCompleteSquareOAuth(...args),
}));

vi.mock("@/lib/integrations/square/square-oauth-nonce.service", () => ({
  consumeSquareOAuthStateNonce: (...args: unknown[]) => mockConsumeNonce(...args),
  pruneExpiredSquareOAuthStateNonces: () => mockPruneNonces(),
  SquareOAuthStateReplayError: class SquareOAuthStateReplayError extends Error {
    constructor() {
      super("oauth_state_reused");
    }
  },
}));

import { GET } from "@/app/api/integrations/square/oauth/callback/route";

describe("square oauth callback state validation", () => {
  it("rejects invalid state", () => {
    expect(() => verifySquareOAuthState("totally-invalid")).toThrow();
  });
});

describe("square oauth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublicSiteOrigin.mockResolvedValue("https://www.openorderco.com");
    mockConsumeNonce.mockResolvedValue(undefined);
    mockAuth.mockResolvedValue({ user: { id: "user_1" } });
    mockCanManageVendor.mockResolvedValue(true);
    mockCompleteSquareOAuth.mockResolvedValue({
      connectionId: "conn_1",
      needsLocationSelection: false,
    });
  });

  it("redirects with missing_code_or_state to vendor select", async () => {
    const res = await GET(
      new NextRequest("https://www.openorderco.com/api/integrations/square/oauth/callback")
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toContain("square_error=missing_code_or_state");
  });

  it("redirects expired state to vendor integration page when vendorId known", async () => {
    const state = signSquareOAuthStateForTest("vendor_1", "user_1", -120);
    const res = await GET(
      new NextRequest(
        `https://www.openorderco.com/api/integrations/square/oauth/callback?code=abc&state=${encodeURIComponent(state)}`
      )
    );
    const location = res.headers.get("location")!;
    expect(location).toContain("/vendor/vendor_1/integrations/square");
    expect(location).toContain("square_error=oauth_state_expired");
  });

  it("redirects successful callback to integration page", async () => {
    const state = signSquareOAuthStateForTest("vendor_1", "user_1", 900);
    const res = await GET(
      new NextRequest(
        `https://www.openorderco.com/api/integrations/square/oauth/callback?code=abc&state=${encodeURIComponent(state)}`
      )
    );
    expect(res.headers.get("location")).toContain("/vendor/vendor_1/integrations/square");
    expect(res.headers.get("location")).toContain("square_connected=1");
  });

  it("maps SquareApiError to a safe oauth redirect code (not raw provider detail)", async () => {
    const { SquareApiError } = await import("@/lib/integrations/square/square-api.client");
    mockCompleteSquareOAuth.mockRejectedValue(
      new SquareApiError("Square locations fetch failed: secret_token_xyz leaked detail", 401)
    );
    const state = signSquareOAuthStateForTest("vendor_1", "user_1", 900);
    const res = await GET(
      new NextRequest(
        `https://www.openorderco.com/api/integrations/square/oauth/callback?code=abc&state=${encodeURIComponent(state)}`
      )
    );
    const location = res.headers.get("location")!;
    expect(location).toContain("square_error=locations_fetch_failed");
    expect(location).not.toContain("secret_token");
  });
});

function signSquareOAuthStateForTest(vendorId: string, userId: string, ttlSec: number): string {
  const { createHmac, randomBytes } = require("crypto");
  const secret = "dev-only-square-oauth-state-signing-secret-32";
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify({ v: 1, vendorId, userId, exp, nonce });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}~${sig}`;
}
