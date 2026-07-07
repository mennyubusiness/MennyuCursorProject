import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const envState = vi.hoisted(() => ({
  NODE_ENV: "production" as string,
  SQUARE_APPLICATION_ID: "sq0idp-test-app",
  SQUARE_APPLICATION_SECRET: "sq0csp-test-secret",
  SQUARE_OAUTH_REDIRECT_URL:
    "https://www.openorderco.com/api/integrations/square/oauth/callback",
  SQUARE_ENVIRONMENT: "sandbox" as "sandbox" | "production",
  SQUARE_MODE: undefined as "sandbox" | "production" | undefined,
  ENABLE_SQUARE_INTEGRATION: "true",
  INTEGRATION_TOKEN_ENCRYPTION_KEY: "integration-token-encryption-key-32",
  AUTH_SECRET: "auth-secret-for-square-oauth-state-signing-32",
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

const mockAuth = vi.fn();
const mockCanManageVendor = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/permissions", () => ({
  canManageVendor: (...args: unknown[]) => mockCanManageVendor(...args),
}));

import { GET } from "@/app/api/vendor/[vendorId]/square/oauth/start/route";

describe("square oauth start route debug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.SQUARE_ENVIRONMENT = "sandbox";
    mockAuth.mockResolvedValue({ user: { id: "user_1" } });
    mockCanManageVendor.mockResolvedValue(true);
  });

  it("returns debug JSON with connect.squareupsandbox.com authorize host", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const res = await GET(
      new NextRequest("https://www.openorderco.com/api/vendor/vendor_1/square/oauth/start?debug=1"),
      { params: Promise.resolve({ vendorId: "vendor_1" }) }
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      authorizeUrlHost: string;
      redirectUri: string;
      environment: string;
      scopes: string;
      hasState: boolean;
    };

    expect(body.authorizeUrlHost).toBe("connect.squareupsandbox.com");
    expect(body.authorizeUrlHost).not.toBe("squareupsandbox.com");
    expect(body.redirectUri).toBe(envState.SQUARE_OAUTH_REDIRECT_URL);
    expect(body.environment).toBe("sandbox");
    expect(body.scopes).toBe("MERCHANT_PROFILE_READ ITEMS_READ");
    expect(body.hasState).toBe(true);

    const logLine = infoSpy.mock.calls
      .map((call) => call[0])
      .find((line) => typeof line === "string" && line.includes("square_oauth_start_redirect"));
    expect(logLine).toBeDefined();
    const logged = JSON.parse(String(logLine)) as {
      event: string;
      authorizeHost: string;
      redirectUri: string;
      environment: string;
      vendorId: string;
    };
    expect(logged.event).toBe("square_oauth_start_redirect");
    expect(logged.authorizeHost).toBe("connect.squareupsandbox.com");
    expect(logged.redirectUri).toBe(envState.SQUARE_OAUTH_REDIRECT_URL);
    expect(logged.environment).toBe("sandbox");
    expect(logged.vendorId).toBe("vendor_1");
    expect(JSON.stringify(logged)).not.toMatch(/secret/i);

    infoSpy.mockRestore();
  });

  it("redirects to connect.squareupsandbox.com when debug is not set", async () => {
    const res = await GET(
      new NextRequest("https://www.openorderco.com/api/vendor/vendor_1/square/oauth/start"),
      { params: Promise.resolve({ vendorId: "vendor_1" }) }
    );

    expect(res.status).toBeGreaterThanOrEqual(300);
    const location = res.headers.get("location");
    expect(location).toBeTruthy();
    const parsed = new URL(location!);
    expect(parsed.hostname).toBe("connect.squareupsandbox.com");
    expect(parsed.pathname).toBe("/oauth2/authorize");
  });
});
