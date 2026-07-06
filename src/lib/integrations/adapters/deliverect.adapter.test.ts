import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: { findUnique: vi.fn() },
  },
}));

vi.mock("@/services/deliverect-channel-registration-retry.service", () => ({
  hasUnmatchedChannelRegistrationForVendorById: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/services/deliverect-menu-integrity.service", () => ({
  evaluateDeliverectMenuIntegrityForVendor: vi.fn().mockResolvedValue({
    deliverectReady: true,
    criticalCount: 0,
  }),
}));

vi.mock("@/services/deliverect.service", () => ({
  submitVendorOrderToDeliverect: vi.fn().mockResolvedValue({
    success: true,
    deliverectOrderId: "dlv_123",
  }),
}));

import { prisma } from "@/lib/db";
import { deliverectOrderAdapter } from "@/lib/integrations/adapters/deliverect.adapter";
import { submitVendorOrderToDeliverect } from "@/services/deliverect.service";

describe("deliverect adapter wrapper", () => {
  it("validateConnection delegates to legacy POS fields without throwing", async () => {
    vi.mocked(prisma.vendor.findUnique).mockResolvedValue({
      deliverectChannelLinkId: "cl_1",
      deliverectLocationId: "loc_1",
      deliverectAccountId: "acc_1",
      posConnectionStatus: "connected",
      deliverectAutoMapLastOutcome: "success",
      pendingDeliverectConnectionKey: null,
      orderRoutingMode: "deliverect",
      menuSource: "deliverect",
    } as never);

    const health = await deliverectOrderAdapter.validateConnection({ vendorId: "v1" });
    expect(health.provider).toBe("deliverect");
    expect(health.isReady).toBe(true);
  });

  it("submitOrder wraps existing service unchanged", async () => {
    const result = await deliverectOrderAdapter.submitOrder({
      vendorOrderId: "vo1",
      customer: { phone: "+15551234567", email: "a@b.com" },
    } as never);

    expect(submitVendorOrderToDeliverect).toHaveBeenCalledWith(
      "vo1",
      "+15551234567",
      "a@b.com"
    );
    expect(result.success).toBe(true);
    expect(result.externalOrderId).toBe("dlv_123");
  });
});
