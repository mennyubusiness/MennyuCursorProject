import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockGetPendingSetup = vi.fn();
const mockIsAdminUser = vi.fn();
const mockCanViewPod = vi.fn();
const mockGetUserAccessContext = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
  },
}));

vi.mock("@/lib/auth/account-setup", () => ({
  getPendingAccountSetupRedirect: (...args: unknown[]) => mockGetPendingSetup(...args),
}));

vi.mock("@/lib/permissions", () => ({
  isAdminUser: (...args: unknown[]) => mockIsAdminUser(...args),
  canViewPod: (...args: unknown[]) => mockCanViewPod(...args),
  canViewVendor: vi.fn().mockResolvedValue(true),
  getUserAccessContext: (...args: unknown[]) => mockGetUserAccessContext(...args),
}));

import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";

describe("resolvePostLoginDestination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPendingSetup.mockResolvedValue(null);
    mockIsAdminUser.mockResolvedValue(false);
    mockCanViewPod.mockResolvedValue(true);
    mockGetUserAccessContext.mockResolvedValue({
      isPlatformAdmin: false,
      vendorIds: [],
      podIds: [],
    });
    mockFindUnique.mockResolvedValue({
      isPlatformAdmin: false,
      vendorMemberships: [],
      podMemberships: [],
    });
  });

  it("returns safe customer next path when allowed", async () => {
    const dest = await resolvePostLoginDestination("user_1", "/cart");
    expect(dest).toEqual({ kind: "redirect", path: "/cart" });
  });

  it("returns pod page for next=/pod/pod_1", async () => {
    const dest = await resolvePostLoginDestination("user_1", "/pod/pod_1");
    expect(dest).toEqual({ kind: "redirect", path: "/pod/pod_1" });
  });

  it("defaults plain customer to /account when next is missing", async () => {
    const dest = await resolvePostLoginDestination("user_1", null);
    expect(dest).toEqual({ kind: "redirect", path: "/account" });
  });

  it("defaults plain customer to /account when next is unsafe", async () => {
    const dest = await resolvePostLoginDestination("user_1", "https://evil.com");
    expect(dest).toEqual({ kind: "redirect", path: "/account" });
  });

  it("platform admin without next goes to /admin", async () => {
    mockFindUnique.mockResolvedValue({
      isPlatformAdmin: true,
      vendorMemberships: [],
      podMemberships: [],
    });
    mockIsAdminUser.mockResolvedValue(true);

    const dest = await resolvePostLoginDestination("admin_1", null);
    expect(dest).toEqual({ kind: "redirect", path: "/admin" });
  });

  it("platform admin with customer next still goes to /admin", async () => {
    mockFindUnique.mockResolvedValue({
      isPlatformAdmin: true,
      vendorMemberships: [],
      podMemberships: [],
    });
    mockIsAdminUser.mockResolvedValue(true);

    const dest = await resolvePostLoginDestination("admin_1", "/explore");
    expect(dest).toEqual({ kind: "redirect", path: "/admin" });
  });

  it("platform admin with next=/admin/orders goes to admin path", async () => {
    mockFindUnique.mockResolvedValue({
      isPlatformAdmin: true,
      vendorMemberships: [],
      podMemberships: [],
    });
    mockIsAdminUser.mockResolvedValue(true);

    const dest = await resolvePostLoginDestination("admin_1", "/admin/orders");
    expect(dest).toEqual({ kind: "redirect", path: "/admin/orders" });
  });

  it("non-admin cannot use next=/admin", async () => {
    mockIsAdminUser.mockResolvedValue(false);

    const dest = await resolvePostLoginDestination("user_1", "/admin");
    expect(dest).toEqual({ kind: "redirect", path: "/account" });
  });
});
