import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegistrationIntent } from "@prisma/client";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import {
  ensureVendorRegistrationIntent,
  getPendingAccountSetupRedirect,
} from "@/lib/auth/account-setup";
import { ACCOUNT_SETUP_VENDOR_PATH } from "@/lib/auth/account-paths";

describe("getPendingAccountSetupRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes vendor intent without membership to vendor setup", async () => {
    mockFindUnique.mockResolvedValue({
      isPlatformAdmin: false,
      needsAccountRoleSelection: false,
      registrationIntent: RegistrationIntent.vendor,
      customerProfile: null,
      vendorMemberships: [],
      podMemberships: [],
    });

    await expect(getPendingAccountSetupRedirect("user_1")).resolves.toBe(
      ACCOUNT_SETUP_VENDOR_PATH
    );
  });

  it("returns null when vendor intent has membership", async () => {
    mockFindUnique.mockResolvedValue({
      isPlatformAdmin: false,
      needsAccountRoleSelection: false,
      registrationIntent: RegistrationIntent.vendor,
      customerProfile: null,
      vendorMemberships: [{ id: "vm_1" }],
      podMemberships: [],
    });

    await expect(getPendingAccountSetupRedirect("user_1")).resolves.toBeNull();
  });
});

describe("ensureVendorRegistrationIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
  });

  it("is idempotent when vendor intent already set", async () => {
    mockFindUnique.mockResolvedValue({
      registrationIntent: RegistrationIntent.vendor,
      vendorMemberships: [],
    });

    await expect(ensureVendorRegistrationIntent("user_1")).resolves.toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets vendor intent when missing", async () => {
    mockFindUnique.mockResolvedValue({
      registrationIntent: null,
      vendorMemberships: [],
    });

    await expect(ensureVendorRegistrationIntent("user_1")).resolves.toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: {
        registrationIntent: RegistrationIntent.vendor,
        needsAccountRoleSelection: false,
      },
    });
  });
});
