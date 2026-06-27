import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserFindMany = vi.fn();
const mockOrderFindUnique = vi.fn();
const mockInviteFindMany = vi.fn();
const mockCustomerAccountFindMany = vi.fn();
const mockOrderGroupBy = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    order: {
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      groupBy: (...args: unknown[]) => mockOrderGroupBy(...args),
    },
    podVendorInvite: {
      findMany: (...args: unknown[]) => mockInviteFindMany(...args),
    },
    customerAccount: {
      findMany: (...args: unknown[]) => mockCustomerAccountFindMany(...args),
    },
  },
}));

import { searchAdminUsers } from "@/services/admin-user-search.service";

describe("searchAdminUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrderFindUnique.mockResolvedValue(null);
    mockInviteFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([
      {
        id: "user_1",
        name: "Sam Vendor",
        email: "sam@example.com",
        emailVerified: new Date(),
        disabledAt: null,
        isPlatformAdmin: false,
        registrationIntent: "vendor",
        createdAt: new Date("2026-01-01"),
        customerProfile: { phone: "+15551234567" },
        customerAccount: null,
        vendorMemberships: [{ vendor: { name: "Taco Truck" } }],
        podMemberships: [],
        _count: { vendorMemberships: 1, podMemberships: 0 },
      },
    ]);
    mockCustomerAccountFindMany.mockResolvedValue([{ id: "acct_1", userId: "user_1" }]);
    mockOrderGroupBy.mockResolvedValue([{ customerAccountId: "acct_1", _count: { _all: 2 } }]);
  });

  it("returns empty for blank query", async () => {
    expect(await searchAdminUsers("   ")).toEqual([]);
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });

  it("searches by email", async () => {
    const rows = await searchAdminUsers("sam@example.com");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("sam@example.com");
    expect(mockUserFindMany).toHaveBeenCalled();
  });

  it("includes vendor names and order count in results", async () => {
    const rows = await searchAdminUsers("sam@example.com");
    expect(rows[0]?.vendorNames).toEqual(["Taco Truck"]);
    expect(rows[0]?.recentOrderCount).toBe(2);
  });
});

describe("admin user search service source", () => {
  it("supports order id and invite email lookups", () => {
    const src = readFileSync(join(process.cwd(), "src/services/admin-user-search.service.ts"), "utf8");
    expect(src).toContain("findUserIdsByOrderQuery");
    expect(src).toContain("findUserIdsByInviteEmail");
  });
});
