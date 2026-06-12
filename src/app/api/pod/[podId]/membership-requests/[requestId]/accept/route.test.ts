import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsAdminApiRequestAuthorized = vi.fn();
const mockAcceptPodMembershipRequest = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
  isAdminApiRequestAuthorized: (...args: unknown[]) => mockIsAdminApiRequestAuthorized(...args),
}));

vi.mock("@/lib/pod-membership-request-accept", () => ({
  acceptPodMembershipRequest: (...args: unknown[]) => mockAcceptPodMembershipRequest(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    podMembershipRequest: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { POST } from "./route";

describe("POST /api/pod/[podId]/membership-requests/[requestId]/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ podId: "pod_1" });
    mockAcceptPodMembershipRequest.mockResolvedValue({ ok: true });
  });

  it("rejects pod owners who are not platform admins", async () => {
    mockIsAdminApiRequestAuthorized.mockResolvedValue(false);

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ podId: "pod_1", requestId: "req_1" }),
    });

    expect(res.status).toBe(403);
    expect(mockAcceptPodMembershipRequest).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toMatch(/only the vendor can accept/i);
  });

  it("allows platform admin bridge to accept on behalf of vendor", async () => {
    mockIsAdminApiRequestAuthorized.mockResolvedValue(true);

    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ podId: "pod_1", requestId: "req_1" }),
    });

    expect(res.status).toBe(200);
    expect(mockAcceptPodMembershipRequest).toHaveBeenCalledWith("req_1");
  });
});
