import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  canManageVendor: vi.fn(),
}));

vi.mock("@/lib/integrations/square/square-config", () => ({
  getSquareConfigSnapshot: vi.fn(),
  assertSquareOAuthConfigured: vi.fn(),
  buildSquareAuthorizationUrl: vi.fn(() => "https://square.example/oauth"),
}));

vi.mock("@/lib/integrations/square/square-oauth-state", () => ({
  signSquareOAuthState: vi.fn(() => "signed_state"),
}));

import { auth } from "@/auth";
import { canManageVendor } from "@/lib/permissions";
import { getSquareConfigSnapshot } from "@/lib/integrations/square/square-config";
import { GET } from "@/app/api/vendor/[vendorId]/square/oauth/start/route";

describe("square oauth start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires vendor manager auth", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await GET(
      new NextRequest("http://localhost/api/vendor/v1/square/oauth/start"),
      { params: Promise.resolve({ vendorId: "v1" }) }
    );
    expect(res.status).toBeGreaterThanOrEqual(300);
  });

  it("returns 403 when user cannot manage vendor", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never);
    vi.mocked(canManageVendor).mockResolvedValue(false);
    vi.mocked(getSquareConfigSnapshot).mockReturnValue({
      enabled: true,
      configured: true,
      partiallyConfigured: false,
      environment: "sandbox",
      applicationId: "id",
      redirectUrl: "https://example.com/cb",
      connectBaseUrl: "https://connect.squareupsandbox.com",
      apiBaseUrl: "https://connect.squareupsandbox.com",
      tokenStorageReady: true,
      missingConfigLabels: [],
      invalidConfigLabels: [],
      disabledReasonLabels: [],
      environmentMismatchWarnings: [],
    });
    const res = await GET(
      new NextRequest("http://localhost/api/vendor/v1/square/oauth/start"),
      { params: Promise.resolve({ vendorId: "v1" }) }
    );
    expect(res.status).toBe(403);
  });
});
