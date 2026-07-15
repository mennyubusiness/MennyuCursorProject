import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    providerEntityMapping: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

import { deactivateSquareMappingsOutsideLocation } from "@/lib/integrations/provider-mapping.service";

describe("deactivateSquareMappingsOutsideLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 9 });
  });

  it("deactivates active mappings not at the selected location", async () => {
    const count = await deactivateSquareMappingsOutsideLocation({
      vendorId: "vendor_poke",
      selectedLocationId: "LN7RT05NHEW13",
    });

    expect(count).toBe(9);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        vendorId: "vendor_poke",
        provider: "square",
        isActive: true,
        OR: [
          { externalLocationId: null },
          { externalLocationId: { not: "LN7RT05NHEW13" } },
        ],
      },
      data: { isActive: false },
    });
  });

  it("returns 0 when selected location is blank", async () => {
    const count = await deactivateSquareMappingsOutsideLocation({
      vendorId: "vendor_poke",
      selectedLocationId: "  ",
    });
    expect(count).toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
