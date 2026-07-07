import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifySquareOAuthState } from "@/lib/integrations/square/square-oauth-state";

vi.mock("server-only", () => ({}));

const mockGetPublicSiteOrigin = vi.fn(async () => "https://www.openorderco.com");

vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOrigin: () => mockGetPublicSiteOrigin(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  canManageVendor: vi.fn(),
}));

vi.mock("@/lib/integrations/square/square-connection.service", () => ({
  completeSquareOAuthForVendor: vi.fn(),
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
  });

  it("redirects with missing_code_or_state when code or state is absent", async () => {
    const res = await GET(
      new NextRequest("https://www.openorderco.com/api/integrations/square/oauth/callback")
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toBe(
      "https://www.openorderco.com/vendor?square_error=missing_code_or_state"
    );
  });
});
