import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  ADMIN_COOKIE_NAME: "mennyu_admin",
  isAdminAllowed: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { NODE_ENV: "production" },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    vendorMembership: {
      findUnique: vi.fn(),
    },
    podMembership: {
      findUnique: vi.fn(),
    },
  },
}));

import { cookies } from "next/headers";
import { isAdminAllowed } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  getPlatformAdminEmailVerificationRedirect,
  getPodDashboardEmailVerificationRedirect,
  getVendorDashboardEmailVerificationRedirect,
  shouldSkipEmailVerificationGate,
  VERIFY_EMAIL_REQUIRED_PATH,
} from "@/lib/auth/email-verification-access.server";
import { isUserEmailVerified } from "@/lib/auth/email-verification-status";

describe("email-verification-access.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({
      get: () => undefined,
    } as never);
    vi.mocked(isAdminAllowed).mockReturnValue(false);
  });

  it("isUserEmailVerified treats null as unverified", () => {
    expect(isUserEmailVerified(null)).toBe(false);
    expect(isUserEmailVerified(new Date())).toBe(true);
  });

  it("redirects unverified platform admins", () => {
    expect(
      getPlatformAdminEmailVerificationRedirect({
        isPlatformAdmin: true,
        emailVerified: false,
      })
    ).toBe(VERIFY_EMAIL_REQUIRED_PATH);
    expect(
      getPlatformAdminEmailVerificationRedirect({
        isPlatformAdmin: true,
        emailVerified: true,
      })
    ).toBeNull();
  });

  it("redirects unverified vendor members", async () => {
    vi.mocked(prisma.vendorMembership.findUnique).mockResolvedValue({
      role: "owner",
    } as never);

    await expect(
      getVendorDashboardEmailVerificationRedirect({
        userId: "user_1",
        vendorId: "vendor_1",
        emailVerified: false,
      })
    ).resolves.toBe(VERIFY_EMAIL_REQUIRED_PATH);
  });

  it("redirects unverified pod owners only", async () => {
    vi.mocked(prisma.podMembership.findUnique).mockResolvedValue({
      role: "owner",
    } as never);

    await expect(
      getPodDashboardEmailVerificationRedirect({
        userId: "user_1",
        podId: "pod_1",
        emailVerified: false,
      })
    ).resolves.toBe(VERIFY_EMAIL_REQUIRED_PATH);

    vi.mocked(prisma.podMembership.findUnique).mockResolvedValue({
      role: "manager",
    } as never);

    await expect(
      getPodDashboardEmailVerificationRedirect({
        userId: "user_1",
        podId: "pod_1",
        emailVerified: false,
      })
    ).resolves.toBeNull();
  });

  it("skips gate for admin secret bridge in production", async () => {
    vi.mocked(isAdminAllowed).mockReturnValue(true);
    await expect(shouldSkipEmailVerificationGate()).resolves.toBe(true);
  });
});
