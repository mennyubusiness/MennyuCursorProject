import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAssertPodApiAccess = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock("@/lib/permissions", () => ({
  assertPodApiAccess: (...args: unknown[]) => mockAssertPodApiAccess(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    podVendor: {
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      deleteMany: vi.fn(),
    },
  },
}));

import { PATCH } from "./route";

describe("PATCH /api/pod/[podId]/vendors/[vendorId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertPodApiAccess.mockResolvedValue({ ok: true, userId: "user_1" });
    mockUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("updates PodVendor.isActive for authorized pod owner", async () => {
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ podId: "pod_1", vendorId: "vendor_1" }) }
    );

    expect(res.status).toBe(200);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { podId: "pod_1", vendorId: "vendor_1" },
      data: { isActive: false },
    });
  });

  it("rejects unauthorized callers", async () => {
    mockAssertPodApiAccess.mockResolvedValue({ ok: false, status: 403 });

    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      }),
      { params: Promise.resolve({ podId: "pod_1", vendorId: "vendor_1" }) }
    );

    expect(res.status).toBe(403);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("requires boolean isActive in body", async () => {
    const res = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: "yes" }),
      }),
      { params: Promise.resolve({ podId: "pod_1", vendorId: "vendor_1" }) }
    );

    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});
