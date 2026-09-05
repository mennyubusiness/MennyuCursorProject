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

  it("defaults plain customer to /explore when next is missing", async () => {
    const dest = await resolvePostLoginDestination("user_1", null);
    expect(dest).toEqual({ kind: "redirect", path: "/explore" });
  });

  it("defaults plain customer to /explore when next is unsafe", async () => {
    const dest = await resolvePostLoginDestination("user_1", "https://evil.com");
    expect(dest).toEqual({ kind: "redirect", path: "/explore" });
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
    expect(dest).toEqual({ kind: "redirect", path: "/explore" });
  });

  it("returns pod vendor page without pod membership check", async () => {
    mockCanViewPod.mockResolvedValue(false);

    const dest = await resolvePostLoginDestination("user_1", "/pod/pod_1/vendor/v1");
    expect(dest).toEqual({ kind: "redirect", path: "/pod/pod_1/vendor/v1" });
  });

  it("returns checkout when next=/checkout", async () => {
    const dest = await resolvePostLoginDestination("user_1", "/checkout?cartId=c1");
    expect(dest).toEqual({ kind: "redirect", path: "/checkout?cartId=c1" });
  });

  it("prioritizes pending vendor setup over default explore destination", async () => {
    mockGetPendingSetup.mockResolvedValue("/account/setup/vendor");

    const dest = await resolvePostLoginDestination("user_1", null);
    expect(dest).toEqual({ kind: "redirect", path: "/account/setup/vendor" });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("preserves invite next on pending vendor setup redirect", async () => {
    mockGetPendingSetup.mockResolvedValue("/account/setup/vendor");

    const dest = await resolvePostLoginDestination(
      "user_1",
      "/vendor/invite/tok_abc"
    );
    expect(dest).toEqual({
      kind: "redirect",
      path: "/account/setup/vendor?next=%2Fvendor%2Finvite%2Ftok_abc",
    });
  });

  it("returns directly to vendor claim instead of forcing duplicate vendor setup", async () => {
    mockGetPendingSetup.mockResolvedValue("/account/role");
    const claimPath = "/claim/vendor/secure_token";
    const dest = await resolvePostLoginDestination("user_1", claimPath);
    expect(dest).toEqual({ kind: "redirect", path: claimPath });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns directly to pod claim instead of forcing duplicate pod setup", async () => {
    mockGetPendingSetup.mockResolvedValue("/account/setup/pod");
    const claimPath = "/claim/pod/secure_token";
    const dest = await resolvePostLoginDestination("user_1", claimPath);
    expect(dest).toEqual({ kind: "redirect", path: claimPath });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
