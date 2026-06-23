import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockAuth = vi.fn();
const mockUserFindUnique = vi.fn();
const mockVendorMembershipFindUnique = vi.fn();
const mockPodMembershipFindUnique = vi.fn();
const mockIsAdminApiRequestAuthorized = vi.fn();
const mockIsAdminDashboardLayoutAuthorized = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    vendorMembership: {
      findUnique: (...args: unknown[]) => mockVendorMembershipFindUnique(...args),
    },
    podMembership: {
      findUnique: (...args: unknown[]) => mockPodMembershipFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/admin-auth", () => ({
  isAdminApiRequestAuthorized: (...args: unknown[]) => mockIsAdminApiRequestAuthorized(...args),
  isAdminDashboardLayoutAuthorized: (...args: unknown[]) => mockIsAdminDashboardLayoutAuthorized(...args),
}));

import {
  assertPodApiAccess,
  canAccessPodDashboardLayout,
  canManagePod,
  canManageVendor,
  canViewAdmin,
  canViewPod,
  canViewVendor,
  getUserAccessContext,
  isAuthenticatedSession,
  isGuestSession,
  isPlatformAdminSession,
} from "./permissions";

const USER_CUSTOMER = "user_customer";
const USER_VENDOR = "user_vendor";
const USER_POD = "user_pod";
const USER_ADMIN = "user_admin";
const VENDOR_A = "vendor_a";
const VENDOR_B = "vendor_b";
const POD_A = "pod_a";
const POD_B = "pod_b";

function session(userId: string, isPlatformAdmin = false) {
  return { user: { id: userId, isPlatformAdmin } };
}

describe("session helpers", () => {
  it("treats missing session as guest", () => {
    expect(isGuestSession(null)).toBe(true);
    expect(isAuthenticatedSession(null)).toBe(false);
    expect(isPlatformAdminSession(null)).toBe(false);
    expect(canViewAdmin(null)).toBe(false);
  });

  it("treats signed-in user as authenticated customer by default", () => {
    const s = session(USER_CUSTOMER);
    expect(isGuestSession(s)).toBe(false);
    expect(isAuthenticatedSession(s)).toBe(true);
    expect(isPlatformAdminSession(s)).toBe(false);
  });

  it("identifies platform admin session flag", () => {
    expect(isPlatformAdminSession(session(USER_ADMIN, true))).toBe(true);
  });
});

describe("canViewVendor / canManageVendor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows vendor membership for the requested vendor only", async () => {
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    mockVendorMembershipFindUnique.mockImplementation(async ({ where }) => {
      const { vendorId } = where.userId_vendorId;
      return vendorId === VENDOR_A ? { userId: USER_VENDOR, vendorId: VENDOR_A } : null;
    });

    await expect(canViewVendor(USER_VENDOR, VENDOR_A)).resolves.toBe(true);
    await expect(canViewVendor(USER_VENDOR, VENDOR_B)).resolves.toBe(false);
  });

  it("denies customer without vendor membership", async () => {
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    mockVendorMembershipFindUnique.mockResolvedValue(null);

    await expect(canViewVendor(USER_CUSTOMER, VENDOR_A)).resolves.toBe(false);
    await expect(canManageVendor(USER_CUSTOMER, VENDOR_A)).resolves.toBe(false);
  });

  it("allows platform admin to view any vendor", async () => {
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: true });

    await expect(canViewVendor(USER_ADMIN, VENDOR_B)).resolves.toBe(true);
    expect(mockVendorMembershipFindUnique).not.toHaveBeenCalled();
  });
});

describe("canViewPod / canManagePod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows pod membership for the requested pod only", async () => {
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    mockPodMembershipFindUnique.mockResolvedValue({ userId: USER_POD, podId: POD_A });

    await expect(canViewPod(USER_POD, POD_A)).resolves.toBe(true);
    await expect(canManagePod(USER_POD, POD_A)).resolves.toBe(true);
  });

  it("denies customer without pod membership", async () => {
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    mockPodMembershipFindUnique.mockResolvedValue(null);

    await expect(canViewPod(USER_CUSTOMER, POD_A)).resolves.toBe(false);
  });

  it("denies pod owner access to unrelated pods", async () => {
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    mockPodMembershipFindUnique.mockResolvedValue(null);

    await expect(canViewPod(USER_POD, POD_B)).resolves.toBe(false);
  });

  it("allows platform admin to view any pod", async () => {
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: true });

    await expect(canViewPod(USER_ADMIN, POD_B)).resolves.toBe(true);
    expect(mockPodMembershipFindUnique).not.toHaveBeenCalled();
  });
});

describe("getUserAccessContext", () => {
  it("returns membership lists for scoped authorization", async () => {
    mockUserFindUnique.mockResolvedValue({
      isPlatformAdmin: false,
      vendorMemberships: [{ vendorId: VENDOR_A }],
      podMemberships: [{ podId: POD_A }],
    });

    await expect(getUserAccessContext(USER_VENDOR)).resolves.toEqual({
      userId: USER_VENDOR,
      isPlatformAdmin: false,
      vendorIds: [VENDOR_A],
      podIds: [POD_A],
    });
  });
});

describe("assertPodApiAccess", () => {
  const request = new Request("http://localhost/api/pod/pod_a/vendors");

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdminApiRequestAuthorized.mockResolvedValue(false);
    mockAuth.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    mockPodMembershipFindUnique.mockResolvedValue(null);
  });

  it("allows admin API bridge without pod membership", async () => {
    mockIsAdminApiRequestAuthorized.mockResolvedValue(true);

    await expect(assertPodApiAccess(request, POD_A)).resolves.toEqual({ ok: true });
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it("allows platform admin session without pod membership", async () => {
    mockAuth.mockResolvedValue(session(USER_ADMIN, true));

    await expect(assertPodApiAccess(request, POD_A)).resolves.toEqual({
      ok: true,
      userId: USER_ADMIN,
    });
  });

  it("allows pod member for their pod", async () => {
    mockAuth.mockResolvedValue(session(USER_POD));
    mockPodMembershipFindUnique.mockResolvedValue({ userId: USER_POD, podId: POD_A });

    await expect(assertPodApiAccess(request, POD_A)).resolves.toEqual({
      ok: true,
      userId: USER_POD,
    });
  });

  it("returns 401 for guest callers", async () => {
    await expect(assertPodApiAccess(request, POD_A)).resolves.toEqual({
      ok: false,
      status: 401,
    });
  });

  it("returns 403 for authenticated customer without pod membership", async () => {
    mockAuth.mockResolvedValue(session(USER_CUSTOMER));

    await expect(assertPodApiAccess(request, POD_A)).resolves.toEqual({
      ok: false,
      status: 403,
    });
  });
});

describe("canAccessPodDashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdminDashboardLayoutAuthorized.mockResolvedValue(false);
    mockAuth.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ isPlatformAdmin: false });
    mockPodMembershipFindUnique.mockResolvedValue(null);
  });

  it("allows admin dashboard authorization bridge", async () => {
    mockIsAdminDashboardLayoutAuthorized.mockResolvedValue(true);

    await expect(canAccessPodDashboardLayout(POD_A)).resolves.toBe(true);
  });

  it("allows pod member and denies unrelated customer", async () => {
    mockAuth.mockResolvedValue(session(USER_POD));
    mockPodMembershipFindUnique.mockResolvedValue({ userId: USER_POD, podId: POD_A });

    await expect(canAccessPodDashboardLayout(POD_A)).resolves.toBe(true);

    mockPodMembershipFindUnique.mockResolvedValue(null);
    mockAuth.mockResolvedValue(session(USER_CUSTOMER));
    await expect(canAccessPodDashboardLayout(POD_A)).resolves.toBe(false);
  });
});
