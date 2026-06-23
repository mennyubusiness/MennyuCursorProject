import { beforeEach, describe, expect, it, vi } from "vitest";

const findUniquePod = vi.fn();
const findUniqueVendor = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: { findUnique: findUniquePod },
    vendor: { findUnique: findUniqueVendor },
  },
}));

describe("slug-server", () => {
  beforeEach(() => {
    findUniquePod.mockReset();
    findUniqueVendor.mockReset();
  });

  it("generates unique pod slugs and skips reserved names", async () => {
    const { uniquePodSlugFromName } = await import("./slug-server");
    findUniquePod.mockImplementation(async ({ where }: { where: { slug: string } }) => {
      if (where.slug === "cart") return { slug: "cart" };
      if (where.slug === "cart-1") return { slug: "cart-1" };
      if (where.slug === "downtown-food-pod") return { slug: "downtown-food-pod" };
      return null;
    });

    await expect(uniquePodSlugFromName("Cart")).resolves.toBe("cart-2");
    await expect(uniquePodSlugFromName("Downtown Food Pod")).resolves.toBe("downtown-food-pod-1");
  });

  it("generates unique vendor slugs globally", async () => {
    const { uniqueVendorSlugFromName } = await import("./slug-server");
    findUniqueVendor.mockImplementation(async ({ where }: { where: { slug: string } }) => {
      if (where.slug === "taco-fiesta") return { slug: "taco-fiesta" };
      return null;
    });

    await expect(uniqueVendorSlugFromName("Taco Fiesta")).resolves.toBe("taco-fiesta-1");
  });
});
