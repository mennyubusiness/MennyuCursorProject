import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockAttachVendorToPod = vi.fn();
const mockMarkPodVendorInvitesAcceptedForVendorPod = vi.fn();
const mockRevalidatePodInviteSurfaces = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    podMembershipRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/attach-vendor-to-pod", () => ({
  attachVendorToPod: (...args: unknown[]) => mockAttachVendorToPod(...args),
}));

vi.mock("@/services/pod-vendor-invite.service", () => ({
  markPodVendorInvitesAcceptedForVendorPod: (...args: unknown[]) =>
    mockMarkPodVendorInvitesAcceptedForVendorPod(...args),
  revalidatePodInviteSurfaces: (...args: unknown[]) => mockRevalidatePodInviteSurfaces(...args),
}));

import { acceptPodMembershipRequest } from "./pod-membership-request-accept";

describe("acceptPodMembershipRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkPodVendorInvitesAcceptedForVendorPod.mockResolvedValue(1);
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
    expect(mockAttachVendorToPod).not.toHaveBeenCalled();
  });

  it("attaches vendor and closes matching pod vendor invites", async () => {
    mockFindUnique.mockResolvedValue({
      id: "req_1",
      podId: "pod_1",
      vendorId: "vendor_1",
      status: "pending",
      pod: { id: "pod_1", name: "Pod" },
    });
    mockAttachVendorToPod.mockResolvedValue({ ok: true, alreadyAttached: false });

    const result = await acceptPodMembershipRequest("req_1");
    expect(result.ok).toBe(true);
    expect(mockAttachVendorToPod).toHaveBeenCalledWith("pod_1", "vendor_1");
    expect(mockMarkPodVendorInvitesAcceptedForVendorPod).toHaveBeenCalledWith({
      podId: "pod_1",
      vendorId: "vendor_1",
      membershipRequestId: "req_1",
    });
    expect(mockRevalidatePodInviteSurfaces).toHaveBeenCalledWith("pod_1", "vendor_1");
  });
});
