import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const podCreate = vi.fn();
const podFindMany = vi.fn();
const audit = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: {
      findMany: (...args: unknown[]) => podFindMany(...args),
      create: (...args: unknown[]) => podCreate(...args),
    },
  },
}));
vi.mock("@/lib/slug-server", () => ({
  uniquePodSlugFromName: vi.fn().mockResolvedValue("new-pod"),
}));
vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => audit(...args),
}));
vi.mock("@/lib/customer-public-url", () => ({
  buildPodCustomerPath: (slug: string) => `/${slug}`,
}));

import { adminCreateUnclaimedPod } from "@/services/admin-concierge-pod.service";
import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";

beforeEach(() => {
  vi.clearAllMocks();
  podFindMany.mockResolvedValue([]);
  podCreate.mockResolvedValue({ id: "pod_1", name: "New Pod", slug: "new-pod" });
  audit.mockResolvedValue(undefined);
});

describe("adminCreateUnclaimedPod", () => {
  it("creates a menu-only pod without owner membership", async () => {
    const result = await adminCreateUnclaimedPod({
      name: " New   Pod ",
      address: "123 Main",
      contactEmail: "OWNER@EXAMPLE.COM",
      adminUserId: "admin_1",
      reason: "Concierge onboarding",
    });

    expect(result.ok).toBe(true);
    expect(podCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "New Pod",
        slug: "new-pod",
        address: "123 Main",
        contactEmail: "owner@example.com",
        orderingEnabled: false,
      }),
      select: { id: true, name: true, slug: true },
    });
    const data = podCreate.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty("memberships");
  });

  it("creates no user and writes no payment or vendor fields", async () => {
    await adminCreateUnclaimedPod({
      name: "New Pod",
      adminUserId: "admin_1",
      reason: "Concierge onboarding",
    });
    const data = podCreate.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty("user");
    for (const field of ["stripeConnectedAccountId", "vendors", "payoutSettings"]) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it("warns before creating an exact normalized duplicate", async () => {
    podFindMany.mockResolvedValue([{ id: "existing_1", name: "New Pod", address: "123 Main" }]);
    const result = await adminCreateUnclaimedPod({
      name: " new   pod ",
      address: "123 Main",
      adminUserId: "admin_1",
      reason: "Concierge onboarding",
    });
    expect(result).toMatchObject({
      ok: false,
      duplicateWarning: { podId: "existing_1", podName: "New Pod" },
    });
    expect(podCreate).not.toHaveBeenCalled();
  });

  it("allows an explicit duplicate override", async () => {
    podFindMany.mockResolvedValue([{ id: "existing_1", name: "New Pod", address: null }]);
    const result = await adminCreateUnclaimedPod({
      name: "New Pod",
      adminUserId: "admin_1",
      reason: "Separate location",
      allowDuplicate: true,
    });
    expect(result.ok).toBe(true);
  });

  it("audits creation without a raw token or fake owner", async () => {
    await adminCreateUnclaimedPod({
      name: "New Pod",
      adminUserId: "admin_1",
      reason: "Concierge onboarding",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: ADMIN_AUDIT_ACTION.UNCLAIMED_POD_CREATED,
        targetId: "pod_1",
        newValue: expect.objectContaining({ ownerMembershipCount: 0, orderingEnabled: false }),
      })
    );
  });
});
