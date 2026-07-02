import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { attachVendorToPod } from "./attach-vendor-to-pod";

describe("attachVendorToPod", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves vendor from old pod to new pod and marks membership accepted", async () => {
    const tx = {
      podVendor: {
        findFirst: vi.fn().mockResolvedValue({ podId: "pod_a" }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 2 } }),
        create: vi.fn().mockResolvedValue({ id: "pv_new" }),
      },
      podMembershipRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockTransaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));

    const result = await attachVendorToPod("pod_b", "vendor_1");

    expect(result).toEqual({ ok: true, alreadyAttached: false, previousPodId: "pod_a" });
    expect(tx.podVendor.deleteMany).toHaveBeenCalledWith({ where: { vendorId: "vendor_1" } });
    expect(tx.podVendor.create).toHaveBeenCalledWith({
      data: { podId: "pod_b", vendorId: "vendor_1", sortOrder: 3, isActive: true },
    });
  });

  it("is idempotent when vendor is already in the target pod", async () => {
    const tx = {
      podVendor: {
        findFirst: vi.fn().mockResolvedValue({ podId: "pod_b" }),
        deleteMany: vi.fn(),
        aggregate: vi.fn(),
        create: vi.fn(),
      },
      podMembershipRequest: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockTransaction.mockImplementation(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));

    const result = await attachVendorToPod("pod_b", "vendor_1");

    expect(result).toEqual({ ok: true, alreadyAttached: true, previousPodId: null });
    expect(tx.podVendor.deleteMany).not.toHaveBeenCalled();
    expect(tx.podVendor.create).not.toHaveBeenCalled();
  });
});
