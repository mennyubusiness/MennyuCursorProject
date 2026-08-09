import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

import { searchAdminVendors } from "@/services/admin-vendor-detail.service";

describe("searchAdminVendors routing filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
  });

  it("returns empty when neither query nor routing is provided", async () => {
    const rows = await searchAdminVendors("");
    expect(rows).toEqual([]);
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("filters by orderRoutingMode alone for beta migration scans", async () => {
    await searchAdminVendors("", { orderRoutingMode: "deliverect" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderRoutingMode: "deliverect" },
      })
    );
  });

  it("combines text search with Tablet routing (manual_dashboard)", async () => {
    await searchAdminVendors("Poke", { orderRoutingMode: "manual_dashboard" });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderRoutingMode: "manual_dashboard",
          OR: expect.any(Array),
        }),
      })
    );
  });

  it("does not infer routing from POS link fields when filtering Square", async () => {
    await searchAdminVendors("", { orderRoutingMode: "square" });
    const where = mockFindMany.mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ orderRoutingMode: "square" });
    expect(where).not.toHaveProperty("deliverectChannelLinkId");
    expect(where).not.toHaveProperty("menuSource");
  });

  it("keeps backward-compatible numeric limit argument", async () => {
    await searchAdminVendors("cafe", 25);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 25,
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });
});
