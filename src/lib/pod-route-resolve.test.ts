import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstPod = vi.fn();
const findUniquePod = vi.fn();
const findFirstVendor = vi.fn();
const findUniqueVendor = vi.fn();
const findUniquePodVendor = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: {
      findFirst: findFirstPod,
      findUnique: findUniquePod,
    },
    vendor: {
      findFirst: findFirstVendor,
      findUnique: findUniqueVendor,
    },
    podVendor: {
      findUnique: findUniquePodVendor,
    },
  },
}));

describe("pod-route-resolve", () => {
  beforeEach(() => {
    vi.resetModules();
    findFirstPod.mockReset();
    findUniquePod.mockReset();
    findFirstVendor.mockReset();
    findUniqueVendor.mockReset();
    findUniquePodVendor.mockReset();
  });

  it("looksLikePodOrVendorId detects cuid-style ids", async () => {
    const { looksLikePodOrVendorId } = await import("./pod-route-resolve");
    expect(looksLikePodOrVendorId("clxyz123456789012345678")).toBe(true);
    expect(looksLikePodOrVendorId("willamette-garage")).toBe(false);
  });

  it("resolveVendorInPodBySlugOrId requires pod membership", async () => {
    const { resolveVendorInPodBySlugOrId } = await import("./pod-route-resolve");
    findUniqueVendor.mockResolvedValue({
      id: "v1",
      slug: "billys-jams-and-crams",
      name: "Billy's",
      isActive: true,
    });
    findUniquePodVendor.mockResolvedValue(null);

    const missingMembership = await resolveVendorInPodBySlugOrId("pod_a", "billys-jams-and-crams");
    expect(missingMembership).toBeNull();

    findUniquePodVendor.mockResolvedValue({ isActive: true });
    const ok = await resolveVendorInPodBySlugOrId("pod_a", "billys-jams-and-crams");
    expect(ok?.vendor.slug).toBe("billys-jams-and-crams");
  });

  it("getPodCustomerPathForPodId returns canonical slug path", async () => {
    const { getPodCustomerPathForPodId } = await import("./pod-route-resolve");
    findUniquePod.mockResolvedValue({ slug: "willamette-garage" });
    await expect(getPodCustomerPathForPodId("pod_a")).resolves.toBe("/willamette-garage");
    findUniquePod.mockResolvedValue(null);
    await expect(getPodCustomerPathForPodId("pod_a")).resolves.toBe("/pod/pod_a");
  });
});
