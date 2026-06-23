import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuth = vi.fn();
const mockCookiesGet = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookiesGet,
  })),
}));

const envState = vi.hoisted(() => ({
  NODE_ENV: "production" as string,
  ADMIN_SECRET: "admin_secret_test" as string | undefined,
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

import {
  ADMIN_COOKIE_NAME,
  buildAdminCookieHeader,
  getAdminBridgeCredentialsFromRequest,
  isAdminAllowed,
  isAdminApiRequestAuthorized,
  isAdminBootstrapSecretAuthorized,
  isAdminDashboardLayoutAuthorized,
  isAdminAccessFromRequest,
} from "./admin-auth";

describe("isAdminAllowed", () => {
  beforeEach(() => {
    envState.NODE_ENV = "production";
    envState.ADMIN_SECRET = "admin_secret_test";
  });

  it("is open in development regardless of secret", () => {
    envState.NODE_ENV = "development";
    expect(isAdminAllowed(null, null)).toBe(true);
    expect(isAdminAllowed("wrong", "wrong")).toBe(true);
  });

  it("fails closed in production without ADMIN_SECRET configured", () => {
    envState.ADMIN_SECRET = undefined;
    expect(isAdminAllowed("admin_secret_test", null)).toBe(false);
  });

  it("accepts matching cookie or query secret in production", () => {
    expect(isAdminAllowed("admin_secret_test", null)).toBe(true);
    expect(isAdminAllowed(null, "admin_secret_test")).toBe(true);
    expect(isAdminAllowed("wrong", null)).toBe(false);
  });
});

describe("getAdminBridgeCredentialsFromRequest", () => {
  it("parses admin cookie and query param", () => {
    const req = new Request(
      `http://localhost/admin?admin=${encodeURIComponent("admin_secret_test")}`,
      {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${encodeURIComponent("from_cookie")}`,
        },
      }
    );
    const creds = getAdminBridgeCredentialsFromRequest(req);
    expect(creds.cookie).toBe("from_cookie");
    expect(creds.querySecret).toBe("admin_secret_test");
  });
});

describe("isAdminApiRequestAuthorized production", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.NODE_ENV = "production";
    envState.ADMIN_SECRET = "admin_secret_test";
    mockAuth.mockResolvedValue(null);
  });

  it("denies guest without bridge or platform-admin session", async () => {
    const req = new Request("http://localhost/api/admin/payout-transfers");
    await expect(isAdminApiRequestAuthorized(req)).resolves.toBe(false);
  });

  it("allows ADMIN_SECRET bridge without platform-admin session", async () => {
    const req = new Request("http://localhost/api/admin/payout-transfers", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=admin_secret_test` },
    });
    await expect(isAdminApiRequestAuthorized(req)).resolves.toBe(true);
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("allows platform-admin session without ADMIN_SECRET", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_admin", isPlatformAdmin: true } });
    const req = new Request("http://localhost/api/admin/payout-transfers");
    await expect(isAdminApiRequestAuthorized(req)).resolves.toBe(true);
  });

  it("denies signed-in customer without admin privileges", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_customer", isPlatformAdmin: false } });
    const req = new Request("http://localhost/api/admin/payout-transfers");
    await expect(isAdminApiRequestAuthorized(req)).resolves.toBe(false);
  });
});

describe("isAdminDashboardLayoutAuthorized production", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.NODE_ENV = "production";
    envState.ADMIN_SECRET = undefined;
    mockAuth.mockResolvedValue(null);
    mockCookiesGet.mockReturnValue(undefined);
  });

  it("fails closed without admin cookie or platform-admin session", async () => {
    await expect(isAdminDashboardLayoutAuthorized()).resolves.toBe(false);
  });

  it("allows platform-admin session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_admin", isPlatformAdmin: true } });
    await expect(isAdminDashboardLayoutAuthorized()).resolves.toBe(true);
  });
});

describe("isAdminBootstrapSecretAuthorized", () => {
  beforeEach(() => {
    envState.NODE_ENV = "production";
    envState.ADMIN_SECRET = "admin_secret_test";
    mockAuth.mockResolvedValue({ user: { id: "user_customer", isPlatformAdmin: true } });
  });

  it("requires ADMIN_SECRET bridge even when caller has platform-admin session", () => {
    const req = new Request("http://localhost/api/admin/platform-admin/bootstrap");
    expect(isAdminBootstrapSecretAuthorized(req)).toBe(false);
  });

  it("allows ADMIN_SECRET bridge", () => {
    const req = new Request("http://localhost/api/admin/platform-admin/bootstrap", {
      headers: { cookie: `${ADMIN_COOKIE_NAME}=admin_secret_test` },
    });
    expect(isAdminBootstrapSecretAuthorized(req)).toBe(true);
  });
});

describe("isAdminAccessFromRequest", () => {
  it("does not consult session (sync bridge only)", async () => {
    envState.NODE_ENV = "production";
    envState.ADMIN_SECRET = "admin_secret_test";
    mockAuth.mockResolvedValue({ user: { id: "user_admin", isPlatformAdmin: true } });

    const req = new Request("http://localhost/api/admin/access");
    expect(isAdminAccessFromRequest(req)).toBe(false);
  });
});

describe("buildAdminCookieHeader", () => {
  it("marks cookie HttpOnly and Secure in production", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const header = buildAdminCookieHeader("secret");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    process.env.NODE_ENV = original;
  });
});
