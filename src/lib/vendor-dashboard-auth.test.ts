import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockAuth = vi.fn();
const mockCookiesGet = vi.fn();
const mockVendorFindUnique = vi.fn();
const mockCanViewVendor = vi.fn();

const envState = vi.hoisted(() => ({
  NODE_ENV: "production" as string,
  ADMIN_SECRET: "admin_secret_test" as string | undefined,
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookiesGet,
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findUnique: (...args: unknown[]) => mockVendorFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/permissions", () => ({
  canViewVendor: (...args: unknown[]) => mockCanViewVendor(...args),
}));

import {
  canAccessVendorDashboard,
  isVendorDashboardDevOpen,
  timingSafeStringEqual,
  vendorDashboardCookieName,
  verifyVendorAccessForApi,
} from "./vendor-dashboard-auth";
import { ADMIN_COOKIE_NAME } from "./admin-auth";

const VENDOR_A = "vendor_a";
const VENDOR_B = "vendor_b";
const TOKEN_A = "dash_token_vendor_a_only";

function vendorRequest(vendorId: string, opts?: { bearer?: string; cookie?: string }) {
  const headers: Record<string, string> = {};
  if (opts?.bearer) headers.authorization = `Bearer ${opts.bearer}`;
  if (opts?.cookie) headers.cookie = opts.cookie;
  return new Request(`http://localhost/api/vendor/${vendorId}/orders`, { headers });
}

describe("isVendorDashboardDevOpen", () => {
  it("is true only in development", () => {
    envState.NODE_ENV = "development";
    expect(isVendorDashboardDevOpen()).toBe(true);
    envState.NODE_ENV = "production";
    expect(isVendorDashboardDevOpen()).toBe(false);
  });
});

describe("verifyVendorAccessForApi production", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.NODE_ENV = "production";
    envState.ADMIN_SECRET = "admin_secret_test";
    mockAuth.mockResolvedValue(null);
    mockCanViewVendor.mockResolvedValue(false);
  });

  it("denies guest without membership, admin bridge, or legacy token", async () => {
    const result = await verifyVendorAccessForApi(VENDOR_A, vendorRequest(VENDOR_A), TOKEN_A);
    expect(result).toEqual({ ok: false });
    expect(mockCanViewVendor).not.toHaveBeenCalled();
  });

  it("allows vendor member for their vendor only", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_vendor", isPlatformAdmin: false } });
    mockCanViewVendor.mockImplementation(async (_userId: string, vendorId: string) => vendorId === VENDOR_A);

    const allowed = await verifyVendorAccessForApi(VENDOR_A, vendorRequest(VENDOR_A), TOKEN_A);
    expect(allowed).toEqual({ ok: true, mode: "session", userId: "user_vendor" });

    const denied = await verifyVendorAccessForApi(VENDOR_B, vendorRequest(VENDOR_B), TOKEN_A);
    expect(denied).toEqual({ ok: false });
  });

  it("denies customer session without vendor membership", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_customer", isPlatformAdmin: false } });
    mockCanViewVendor.mockResolvedValue(false);

    const result = await verifyVendorAccessForApi(VENDOR_A, vendorRequest(VENDOR_A), TOKEN_A);
    expect(result).toEqual({ ok: false });
  });

  it("allows ADMIN_SECRET bridge without vendor membership", async () => {
    const req = vendorRequest(VENDOR_A, {
      cookie: `${ADMIN_COOKIE_NAME}=admin_secret_test`,
    });
    const result = await verifyVendorAccessForApi(VENDOR_A, req, TOKEN_A);
    expect(result).toEqual({ ok: true, mode: "admin" });
    expect(mockCanViewVendor).not.toHaveBeenCalled();
  });

  it("allows legacy dashboard token only for the matching vendor", async () => {
    const cookieName = vendorDashboardCookieName(VENDOR_A);
    const ok = await verifyVendorAccessForApi(
      VENDOR_A,
      vendorRequest(VENDOR_A, { cookie: `${cookieName}=${TOKEN_A}` }),
      TOKEN_A
    );
    expect(ok).toEqual({ ok: true, mode: "legacy" });

    const wrongVendor = await verifyVendorAccessForApi(
      VENDOR_B,
      vendorRequest(VENDOR_B, { cookie: `${cookieName}=${TOKEN_A}` }),
      "token_vendor_b"
    );
    expect(wrongVendor).toEqual({ ok: false });
  });

  it("rejects legacy bearer token for a different vendor token value", async () => {
    const result = await verifyVendorAccessForApi(
      VENDOR_B,
      vendorRequest(VENDOR_B, { bearer: TOKEN_A }),
      "token_vendor_b"
    );
    expect(result).toEqual({ ok: false });
  });
});

describe("canAccessVendorDashboard production", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.NODE_ENV = "production";
    envState.ADMIN_SECRET = undefined;
    mockCookiesGet.mockReturnValue(undefined);
    mockAuth.mockResolvedValue(null);
    mockCanViewVendor.mockResolvedValue(false);
    mockVendorFindUnique.mockResolvedValue({ vendorDashboardToken: TOKEN_A });
  });

  it("denies guest without legacy cookie", async () => {
    await expect(canAccessVendorDashboard(VENDOR_A)).resolves.toBe(false);
  });

  it("allows vendor member via session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user_vendor" } });
    mockCanViewVendor.mockResolvedValue(true);
    await expect(canAccessVendorDashboard(VENDOR_A)).resolves.toBe(true);
  });

  it("allows legacy cookie for the vendor that owns the token", async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === vendorDashboardCookieName(VENDOR_A)) {
        return { value: TOKEN_A };
      }
      return undefined;
    });
    await expect(canAccessVendorDashboard(VENDOR_A)).resolves.toBe(true);
  });
});

describe("timingSafeStringEqual", () => {
  it("compares equal strings safely", () => {
    expect(timingSafeStringEqual("abc", "abc")).toBe(true);
    expect(timingSafeStringEqual("abc", "abd")).toBe(false);
  });
});
