import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransaction = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    podMembershipRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { acceptPodMembershipRequest } from "./pod-membership-request-accept";

describe("acceptPodMembershipRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-pending requests", async () => {
    mockFindUnique.mockResolvedValue({
      id: "req_1",
      podId: "pod_1",
      vendorId: "vendor_1",
      status: "accepted",
      pod: { id: "pod_1", name: "Pod" },
    });

    const result = await acceptPodMembershipRequest("req_1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toMatch(/already been responded/i);
    }
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("creates pod vendor membership for pending request", async () => {
    mockFindUnique.mockResolvedValue({
      id: "req_1",
      podId: "pod_1",
      vendorId: "vendor_1",
      status: "pending",
      pod: { id: "pod_1", name: "Pod" },
    });

    const tx = {
      podVendor: {
        findFirst: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: 2 } }),
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn(),
      },
      podMembershipRequest: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    mockTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));

    const result = await acceptPodMembershipRequest("req_1");
    expect(result.ok).toBe(true);
    expect(tx.podVendor.create).toHaveBeenCalledWith({
      data: { podId: "pod_1", vendorId: "vendor_1", sortOrder: 3 },
    });
  });
});
