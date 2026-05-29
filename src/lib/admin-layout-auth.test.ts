import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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

vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "production",
    ADMIN_SECRET: undefined,
  },
}));

import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";

describe("isAdminDashboardLayoutAuthorized production fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockCookiesGet.mockReturnValue(undefined);
  });

  it("returns false in production without admin cookie or platform-admin session", async () => {
    const allowed = await isAdminDashboardLayoutAuthorized();
    expect(allowed).toBe(false);
  });
});
