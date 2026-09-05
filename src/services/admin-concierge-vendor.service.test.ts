import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const podFindUnique = vi.fn();
const vendorCreate = vi.fn();
const podVendorAggregate = vi.fn();
const podVendorCreate = vi.fn();
const audit = vi.fn();
const revalidate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: { findUnique: (...args: unknown[]) => podFindUnique(...args) },
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        vendor: { create: (...args: unknown[]) => vendorCreate(...args) },
        podVendor: {
          aggregate: (...args: unknown[]) => podVendorAggregate(...args),
          create: (...args: unknown[]) => podVendorCreate(...args),
        },
      }),
  },
}));
vi.mock("@/lib/slug-server", () => ({
  uniqueVendorSlugFromName: vi.fn().mockResolvedValue("new-kitchen"),
}));
vi.mock("@/services/admin-audit-log.service", () => ({
  createAdminAuditLog: (...args: unknown[]) => audit(...args),
}));
vi.mock("@/lib/revalidate-vendor-pod-surfaces.server", () => ({
  revalidateVendorPodMembershipSurfaces: (...args: unknown[]) => revalidate(...args),
}));

import { adminCreateUnclaimedVendor } from "@/services/admin-concierge-vendor.service";
import { ADMIN_AUDIT_ACTION } from "@/lib/admin-audit-log";

beforeEach(() => {
  vi.clearAllMocks();
  podFindUnique.mockResolvedValue({ id: "pod_1", name: "Test Pod", vendors: [] });
  podVendorAggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
  vendorCreate.mockResolvedValue({ id: "vendor_1", name: "New Kitchen", slug: "new-kitchen" });
  podVendorCreate.mockResolvedValue({ id: "pv_1" });
  audit.mockResolvedValue(undefined);
  revalidate.mockResolvedValue(undefined);
});

describe("adminCreateUnclaimedVendor", () => {
  it("creates a menu-only vendor and attaches it to the selected pod", async () => {
    const result = await adminCreateUnclaimedVendor({
      podId: "pod_1",
      name: " New   Kitchen ",
      contactEmail: "OWNER@EXAMPLE.COM",
      adminUserId: "admin_1",
      reason: "Concierge onboarding",
    });

    expect(result.ok).toBe(true);
    expect(vendorCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "New Kitchen",
        slug: "new-kitchen",
        contactEmail: "owner@example.com",
        orderingEnabled: false,
      }),
      select: { id: true, name: true, slug: true },
    });
    expect(podVendorCreate).toHaveBeenCalledWith({
      data: { podId: "pod_1", vendorId: "vendor_1", sortOrder: 3, isActive: true },
    });
  });

  it("creates no user or owner membership and writes no integration fields", async () => {
    await adminCreateUnclaimedVendor({
      podId: "pod_1",
      name: "New Kitchen",
      adminUserId: "admin_1",
      reason: "Concierge onboarding",
    });
    const data = vendorCreate.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty("vendorMemberships");
    expect(data).not.toHaveProperty("user");
    for (const field of [
      "stripeConnectedAccountId",
      "squareMerchantId",
      "deliverectChannelLinkId",
      "orderRoutingMode",
      "menuSource",
    ]) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it("warns before creating an exact normalized duplicate in the pod", async () => {
    podFindUnique.mockResolvedValue({
      id: "pod_1",
      name: "Test Pod",
      vendors: [{ vendor: { id: "existing_1", name: "New Kitchen" } }],
    });
    const result = await adminCreateUnclaimedVendor({
      podId: "pod_1",
      name: " new   kitchen ",
      adminUserId: "admin_1",
      reason: "Concierge onboarding",
    });
    expect(result).toMatchObject({
      ok: false,
      duplicateWarning: { vendorId: "existing_1", vendorName: "New Kitchen" },
    });
    expect(vendorCreate).not.toHaveBeenCalled();
  });

  it("allows an explicit duplicate override", async () => {
    podFindUnique.mockResolvedValue({
      id: "pod_1",
      name: "Test Pod",
      vendors: [{ vendor: { id: "existing_1", name: "New Kitchen" } }],
    });
    const result = await adminCreateUnclaimedVendor({
      podId: "pod_1",
      name: "New Kitchen",
      adminUserId: "admin_1",
      reason: "Separate business",
      allowDuplicateName: true,
    });
    expect(result.ok).toBe(true);
  });

  it("audits creation without a raw token or fake owner", async () => {
    await adminCreateUnclaimedVendor({
      podId: "pod_1",
      name: "New Kitchen",
      adminUserId: "admin_1",
      reason: "Concierge onboarding",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: ADMIN_AUDIT_ACTION.UNCLAIMED_VENDOR_CREATED,
        targetId: "vendor_1",
        newValue: expect.objectContaining({ ownerMembershipCount: 0, orderingEnabled: false }),
      })
    );
  });
});
