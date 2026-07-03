import { describe, expect, it } from "vitest";

import {
  buildDeletedUserEmail,
  isBlockingPodPayoutTransferStatus,
  isBlockingVendorPayoutTransferStatus,
  isDeletedPlaceholderEmail,
} from "@/lib/entity-deletion/entity-deletion.constants";
import {
  precheckAccountDeletion,
  precheckPodDeletion,
  precheckVendorDeletion,
  type EntityDeletionGuardDeps,
} from "@/lib/entity-deletion/entity-deletion-guards";
import {
  cartLineOrderabilityCode,
  getVendorOrderabilityInPod,
} from "@/lib/vendor-orderability-in-pod";

function mockDeps(overrides: Partial<EntityDeletionGuardDeps>): EntityDeletionGuardDeps {
  return {
    countActiveCustomerOrdersForUser: async () => 0,
    countOwnedVendors: async () => 0,
    countOwnedPods: async () => 0,
    countActiveVendorOrders: async () => 0,
    countBlockingVendorPayoutTransfers: async () => 0,
    countActiveVendorIssues: async () => 0,
    countActivePodOrders: async () => 0,
    countBlockingPodPayoutTransfers: async () => 0,
    countActivePodVendorMemberships: async () => 0,
    ...overrides,
  };
}

describe("entity deletion constants", () => {
  it("builds stable deleted-user placeholder email", () => {
    const email = buildDeletedUserEmail("user_123");
    expect(email).toBe("deleted+user_123@accounts.deleted.openorder");
    expect(isDeletedPlaceholderEmail(email)).toBe(true);
  });

  it("treats pending vendor payout transfers as blocking", () => {
    expect(isBlockingVendorPayoutTransferStatus("pending")).toBe(true);
    expect(isBlockingVendorPayoutTransferStatus("paid")).toBe(false);
    expect(isBlockingVendorPayoutTransferStatus("failed")).toBe(true);
    expect(isBlockingVendorPayoutTransferStatus("blocked_insufficient_balance")).toBe(true);
    expect(isBlockingVendorPayoutTransferStatus("blocked_idempotency_mismatch")).toBe(true);
  });

  it("treats unresolved pod payout transfers as blocking", () => {
    expect(isBlockingPodPayoutTransferStatus("failed")).toBe(true);
    expect(isBlockingPodPayoutTransferStatus("blocked_partial_refund_review")).toBe(true);
    expect(isBlockingPodPayoutTransferStatus("paid")).toBe(false);
    expect(isBlockingPodPayoutTransferStatus("cancelled_due_to_refund")).toBe(false);
  });
});

describe("entity deletion prechecks", () => {
  it("blocks account deletion when user has active orders", async () => {
    const result = await precheckAccountDeletion(
      "user_1",
      mockDeps({ countActiveCustomerOrdersForUser: async () => 2 })
    );
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.code === "active_customer_orders")).toBe(true);
  });

  it("blocks account deletion when user owns vendors", async () => {
    const result = await precheckAccountDeletion(
      "user_1",
      mockDeps({ countOwnedVendors: async () => 1 })
    );
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.code === "owned_vendors")).toBe(true);
  });

  it("blocks vendor deletion when active orders exist", async () => {
    const result = await precheckVendorDeletion(
      "vendor_1",
      mockDeps({ countActiveVendorOrders: async () => 1 })
    );
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.code === "active_vendor_orders")).toBe(true);
  });

  it("blocks vendor deletion when blocking payout transfers exist", async () => {
    const result = await precheckVendorDeletion(
      "vendor_1",
      mockDeps({ countBlockingVendorPayoutTransfers: async () => 2 })
    );
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.code === "pending_vendor_payouts")).toBe(true);
  });

  it("blocks pod deletion when blocking payout transfers exist", async () => {
    const result = await precheckPodDeletion(
      "pod_1",
      mockDeps({ countBlockingPodPayoutTransfers: async () => 1 })
    );
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.code === "pending_pod_payouts")).toBe(true);
  });

  it("blocks pod deletion until active vendors are acknowledged", async () => {
    const result = await precheckPodDeletion(
      "pod_1",
      mockDeps({ countActivePodVendorMemberships: async () => 3 })
    );
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.code === "active_pod_vendors")).toBe(true);

    const acknowledged = await precheckPodDeletion(
      "pod_1",
      mockDeps({ countActivePodVendorMemberships: async () => 3 }),
      { acknowledgeActiveVendors: true }
    );
    expect(acknowledged.ok).toBe(true);
  });
});

describe("deleted vendor/pod public visibility", () => {
  it("blocks cart orderability for inactive (deleted) vendor", () => {
    const result = getVendorOrderabilityInPod({
      podActive: true,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: false, mennyuOrdersPaused: false },
    });
    expect(result.orderable).toBe(false);
    expect(cartLineOrderabilityCode(result)).toBe("VENDOR_INACTIVE");
  });

  it("blocks cart orderability for inactive pod", () => {
    const result = getVendorOrderabilityInPod({
      podActive: false,
      podVendorExists: true,
      podVendorActive: true,
      vendor: { isActive: true, mennyuOrdersPaused: false },
    });
    expect(result.orderable).toBe(false);
    expect(cartLineOrderabilityCode(result)).toBe("POD_INACTIVE");
  });
});
